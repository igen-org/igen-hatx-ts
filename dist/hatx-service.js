import axios, {} from 'axios';
import { LRUCache } from 'lru-cache';
const DEFAULT_VERSION = 'v1';
const DEFAULT_CACHE_MAX_ENTRIES = 1000;
const DEFAULT_CACHE_TTL = 1000 * 60 * 60; // 1 hour
const DEFAULT_SEROLOGICAL_TTL = 1000 * 60 * 15; // 15 minutes
export class HatxService {
    client;
    basePath;
    cache;
    serologicalCache;
    constructor(options) {
        if (!options.baseUrl) {
            throw new Error('HatxService requires a baseUrl.');
        }
        const version = options.version ?? DEFAULT_VERSION;
        this.basePath = `${trimTrailingSlash(options.baseUrl)}/${trimSlashes(version)}`;
        const defaultClient = axios.create({
            baseURL: this.basePath,
            ...options.axiosConfig,
        });
        this.client = options.httpClient ?? defaultClient;
        const cacheOptions = resolveCacheOptions(options.cache);
        if (cacheOptions) {
            this.cache = new LRUCache({
                max: cacheOptions.max,
                ttl: cacheOptions.ttl,
            });
            this.serologicalCache = new LRUCache({
                max: cacheOptions.max,
                ttl: cacheOptions.serologicalTtl,
            });
        }
        else {
            this.cache = null;
            this.serologicalCache = null;
        }
    }
    async getSystemHealth() {
        return this.cacheRequest('system:health', () => this.get('/system/health'), this.cache);
    }
    async getSystemInfo() {
        return this.cacheRequest('system:info', () => this.get('/system/info'), this.cache);
    }
    async getSystemChangelog() {
        return this.cacheRequest('system:changelog', () => this.get('/system/changelog', { responseType: 'text' }), this.cache);
    }
    async getBeadByAllele(allele, options = {}) {
        this.assertRequiredString(allele, 'allele');
        const config = applyRefreshOptions(options, { params: { allele } });
        return this.cacheRequest(`bead:get:${allele}`, () => this.get('/bead', config), this.cache);
    }
    async queryBeads(payload, options = {}) {
        this.assertArray(payload.alleles, 'alleles');
        const config = applyRefreshOptions(options);
        return this.cacheRequest(`bead:query:${stableSerialize(payload)}`, () => this.post('/bead', payload, config), this.cache);
    }
    async filterBeads(payload, options = {}) {
        const body = toBeadFilterPayload(payload);
        const config = applyRefreshOptions(options);
        return this.cacheRequest(`bead:filter:${stableSerialize(body)}`, () => this.post('/bead/filter', body, config), this.cache);
    }
    async getSerologicalByAllele(allele, options = {}) {
        this.assertRequiredString(allele, 'allele');
        const config = applyRefreshOptions(options, { params: { allele } });
        return this.cacheRequest(`serological:get:${allele}`, () => this.get('/serological', config), this.serologicalCache ?? this.cache);
    }
    async querySerological(payload, options = {}) {
        this.assertArray(payload.alleles, 'alleles');
        const config = applyRefreshOptions(options);
        return this.cacheRequest(`serological:query:${stableSerialize(payload)}`, () => this.post('/serological', payload, config), this.serologicalCache ?? this.cache);
    }
    async getArdReducedByAllele(allele, options = {}) {
        this.assertRequiredString(allele, 'allele');
        const params = { allele };
        setDefined(params, 'group', options.group);
        setDefined(params, 'refresh', options.refresh);
        const headers = {};
        if (options.refreshData !== undefined && options.refreshData !== null) {
            headers['Refresh-Data'] = String(options.refreshData);
        }
        const config = {
            params,
            ...(Object.keys(headers).length ? { headers } : undefined),
        };
        const request = () => this.get('/ard/reduce', config);
        if (options.refresh === true || options.refreshData === true) {
            return request();
        }
        return this.cacheRequest(`ard:reduce:get:${allele}:${stableSerialize({ group: options.group })}`, request, this.cache);
    }
    async reduceArdAlleles(payload) {
        this.assertArray(payload.alleles, 'alleles');
        const body = {
            alleles: payload.alleles,
        };
        setDefined(body, 'group', payload.group);
        return this.cacheRequest(`ard:reduce:query:${stableSerialize(body)}`, () => this.post('/ard/reduce', body), this.cache);
    }
    async getSerotypeByAllele(allele, version, options = {}) {
        this.assertRequiredString(allele, 'allele');
        return this.cacheRequest(`serotype:get:${allele}:${version ?? 'latest'}`, async () => {
            const config = applyRefreshOptions(options, {
                params: {
                    allele,
                    ...(version !== undefined ? { version } : undefined),
                },
            });
            const data = await this.get('/serotype', config);
            return mapSerotypeResponses(data);
        }, this.cache);
    }
    async querySerotype(payload, options = {}) {
        this.assertArray(payload.alleles, 'alleles');
        return this.cacheRequest(`serotype:query:${stableSerialize(payload)}`, async () => {
            const config = applyRefreshOptions(options);
            const data = await this.post('/serotype', payload, config);
            return mapSerotypeResponses(data);
        }, this.cache);
    }
    async filterSerotype(payload, options = {}) {
        const body = toSerotypeFilterPayload(payload);
        return this.cacheRequest(`serotype:filter:${stableSerialize(body)}`, async () => {
            const config = applyRefreshOptions(options);
            const data = await this.post('/serotype/filter', body, config);
            return mapSerotypeResponses(data);
        }, this.cache);
    }
    async get(path, config) {
        const response = await this.client.get(this.buildUrl(path), config);
        return response.data;
    }
    async post(path, data, config) {
        const response = await this.client.post(this.buildUrl(path), data, config);
        return response.data;
    }
    buildUrl(path) {
        return `${this.basePath}${path}`;
    }
    cacheRequest(key, factory, cache) {
        if (!cache) {
            return factory();
        }
        const cached = cache.get(key);
        if (cached) {
            return cached;
        }
        const pending = factory().catch((error) => {
            cache.delete(key);
            throw error;
        });
        cache.set(key, pending);
        return pending;
    }
    assertRequiredString(value, field) {
        if (!value || !value.trim()) {
            throw new Error(`Expected a non-empty value for ${field}.`);
        }
    }
    assertArray(value, field) {
        if (!Array.isArray(value) || value.length === 0) {
            throw new Error(`Expected ${field} to be a non-empty array.`);
        }
    }
}
function mapSerotypeResponses(payload) {
    return payload.map((item) => ({
        allele: item.allele,
        comment: item.comment,
        serotype: item.serotype,
        inputtedAntigen: item.inputted_antigen,
        broad: item.broad,
        ciwd30: item.ciwd_3_0,
        cwd20: item.cwd_2_0,
        eurcwd: item.eurcwd,
        bw: item.bw,
        version: item.version,
    }));
}
function toSerotypeFilterPayload(payload) {
    const body = {};
    setDefined(body, 'allele', payload.allele);
    setDefined(body, 'antigen', payload.antigen);
    setDefined(body, 'serotype', payload.serotype);
    setDefined(body, 'serotype_from_allele', payload.serotypeFromAllele);
    setDefined(body, 'comment', payload.comment);
    setDefined(body, 'manufacturer', payload.manufacturer);
    setDefined(body, 'n_field', payload.nField);
    setDefined(body, 'version', payload.version);
    return body;
}
function toBeadFilterPayload(payload) {
    const body = toBeadFilterCriteriaPayload(payload);
    if (payload.conditional !== undefined) {
        body.conditional = payload.conditional ? payload.conditional.map(toBeadConditionalPayload) : null;
    }
    return body;
}
function toBeadFilterCriteriaPayload(payload) {
    const body = {};
    setDefined(body, 'allele', payload.allele);
    setDefined(body, 'alleles', payload.alleles);
    setDefined(body, 'antigen', payload.antigen);
    setDefined(body, 'serotype', payload.serotype);
    setDefined(body, 'serotype_from_allele', payload.serotypeFromAllele);
    setDefined(body, 'comment', payload.comment);
    setDefined(body, 'manufacturer', payload.manufacturer);
    setDefined(body, 'version', payload.version);
    setDefined(body, 'n_field', payload.nField);
    return body;
}
function toBeadConditionalPayload(condition) {
    return {
        when: toBeadConditionalWhenPayload(condition.when),
        filter: toBeadFilterCriteriaPayload(condition.filter),
    };
}
function toBeadConditionalWhenPayload(when) {
    const body = {};
    setDefined(body, 'allele', when.allele);
    setDefined(body, 'locus', when.locus);
    setDefined(body, 'serotype', when.serotype);
    setDefined(body, 'comment', when.comment);
    return body;
}
function setDefined(target, key, value) {
    if (value !== undefined) {
        target[key] = value;
    }
}
function trimTrailingSlash(input) {
    return input.replace(/\/+$/, '');
}
function trimSlashes(input) {
    return input.replace(/^\/+|\/+$/g, '');
}
function resolveCacheOptions(cache) {
    if (cache === false) {
        return null;
    }
    if (cache === true || cache === undefined) {
        return {
            max: DEFAULT_CACHE_MAX_ENTRIES,
            ttl: DEFAULT_CACHE_TTL,
            serologicalTtl: DEFAULT_SEROLOGICAL_TTL,
        };
    }
    return {
        max: cache.max ?? DEFAULT_CACHE_MAX_ENTRIES,
        ttl: cache.ttl ?? DEFAULT_CACHE_TTL,
        serologicalTtl: cache.serologicalTtl ?? cache.ttl ?? DEFAULT_SEROLOGICAL_TTL,
    };
}
function stableSerialize(payload) {
    const serialized = JSON.stringify(sortValue(payload));
    return serialized ?? 'undefined';
}
function applyRefreshOptions(options, config = {}) {
    if (!options) {
        return config;
    }
    const params = { ...config.params };
    const headers = { ...config.headers };
    if (options.refresh !== undefined && options.refresh !== null) {
        params.refresh = options.refresh;
    }
    if (options.refreshData !== undefined && options.refreshData !== null) {
        headers['Refresh-Data'] = String(options.refreshData);
    }
    return {
        ...config,
        ...(Object.keys(params).length ? { params } : undefined),
        ...(Object.keys(headers).length ? { headers } : undefined),
    };
}
function sortValue(value) {
    if (value === null || typeof value !== 'object') {
        return value;
    }
    if (Array.isArray(value)) {
        return value.map((item) => sortValue(item));
    }
    const sorted = {};
    for (const key of Object.keys(value).sort()) {
        const nested = value[key];
        if (nested === undefined) {
            continue;
        }
        sorted[key] = sortValue(nested);
    }
    return sorted;
}
//# sourceMappingURL=hatx-service.js.map