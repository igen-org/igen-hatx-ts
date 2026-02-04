import axios, { type AxiosInstance, type AxiosRequestConfig } from 'axios';
import { LRUCache } from 'lru-cache';
import type {
    ArdReduceOptions,
    ArdReduceQuery,
    ArdReduceResponse,
    BeadConditional,
    BeadConditionalWhen,
    BeadFilterCriteria,
    BeadFilterQuery,
    BeadQuery,
    BeadResponse,
    Manufacturer,
    RequestOptions,
    SerologicalQuery,
    SerologicalResponse,
    SerotypeFilterQuery,
    SerotypeQuery,
    SerotypeResponse,
    SystemHealthResponse,
    SystemInfoResponse,
} from './types.js';

const DEFAULT_VERSION = 'v1';
const DEFAULT_CACHE_MAX_ENTRIES = 1000;
const DEFAULT_CACHE_TTL = 1000 * 60 * 60; // 1 hour
const DEFAULT_SEROLOGICAL_TTL = 1000 * 60 * 15; // 15 minutes

export interface HatxServiceCacheOptions {
    max?: number;
    ttl?: number;
    serologicalTtl?: number;
}

export interface HatxServiceOptions {
    baseUrl: string;
    version?: string;
    axiosConfig?: AxiosRequestConfig;
    httpClient?: AxiosInstance;
    cache?: boolean | HatxServiceCacheOptions;
}

export class HatxService {
    private readonly client: AxiosInstance;
    private readonly basePath: string;
    private readonly cache: LRUCache<string, Promise<unknown>> | null;
    private readonly serologicalCache: LRUCache<string, Promise<unknown>> | null;

    constructor(options: HatxServiceOptions) {
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
            this.cache = new LRUCache<string, Promise<unknown>>({
                max: cacheOptions.max,
                ttl: cacheOptions.ttl,
            });
            this.serologicalCache = new LRUCache<string, Promise<unknown>>({
                max: cacheOptions.max,
                ttl: cacheOptions.serologicalTtl,
            });
        } else {
            this.cache = null;
            this.serologicalCache = null;
        }
    }

    async getSystemHealth(): Promise<SystemHealthResponse> {
        return this.cacheRequest<SystemHealthResponse>('system:health', () => this.get<SystemHealthResponse>('/system/health'), this.cache);
    }

    async getSystemInfo(): Promise<SystemInfoResponse> {
        return this.cacheRequest<SystemInfoResponse>('system:info', () => this.get<SystemInfoResponse>('/system/info'), this.cache);
    }

    async getSystemChangelog(): Promise<string> {
        return this.cacheRequest<string>('system:changelog', () => this.get<string>('/system/changelog', { responseType: 'text' }), this.cache);
    }

    async getBeadByAllele(allele: string, options: RequestOptions = {}): Promise<BeadResponse[]> {
        this.assertRequiredString(allele, 'allele');
        const config = applyRefreshOptions(options, { params: { allele } });
        return this.cacheRequest<BeadResponse[]>(`bead:get:${allele}`, () => this.get<BeadResponse[]>('/bead', config), this.cache);
    }

    async queryBeads(payload: BeadQuery, options: RequestOptions = {}): Promise<BeadResponse[]> {
        this.assertArray(payload.alleles, 'alleles');
        const config = applyRefreshOptions(options);
        return this.cacheRequest<BeadResponse[]>(
            `bead:query:${stableSerialize(payload)}`,
            () => this.post<BeadResponse[]>('/bead', payload, config),
            this.cache,
        );
    }

    async filterBeads(payload: BeadFilterQuery, options: RequestOptions = {}): Promise<BeadResponse[]> {
        const body = toBeadFilterPayload(payload);
        const config = applyRefreshOptions(options);
        return this.cacheRequest<BeadResponse[]>(
            `bead:filter:${stableSerialize(body)}`,
            () => this.post<BeadResponse[]>('/bead/filter', body, config),
            this.cache,
        );
    }

    async getSerologicalByAllele(allele: string, options: RequestOptions = {}): Promise<SerologicalResponse[]> {
        this.assertRequiredString(allele, 'allele');
        const config = applyRefreshOptions(options, { params: { allele } });
        return this.cacheRequest<SerologicalResponse[]>(
            `serological:get:${allele}`,
            () => this.get<SerologicalResponse[]>('/serological', config),
            this.serologicalCache ?? this.cache,
        );
    }

    async querySerological(payload: SerologicalQuery, options: RequestOptions = {}): Promise<SerologicalResponse[]> {
        this.assertArray(payload.alleles, 'alleles');
        const config = applyRefreshOptions(options);
        return this.cacheRequest<SerologicalResponse[]>(
            `serological:query:${stableSerialize(payload)}`,
            () => this.post<SerologicalResponse[]>('/serological', payload, config),
            this.serologicalCache ?? this.cache,
        );
    }

    async getArdReducedByAllele(allele: string, options: ArdReduceOptions = {}): Promise<ArdReduceResponse> {
        this.assertRequiredString(allele, 'allele');
        const params: Record<string, unknown> = { allele };
        setDefined(params, 'group', options.group);
        setDefined(params, 'refresh', options.refresh);

        const headers: Record<string, string> = {};
        if (options.refreshData !== undefined && options.refreshData !== null) {
            headers['Refresh-Data'] = String(options.refreshData);
        }

        const config: AxiosRequestConfig = {
            params,
            ...(Object.keys(headers).length ? { headers } : undefined),
        };
        const request = () => this.get<ArdReduceResponse>('/ard/reduce', config);
        if (options.refresh === true || options.refreshData === true) {
            return request();
        }
        return this.cacheRequest<ArdReduceResponse>(`ard:reduce:get:${allele}:${stableSerialize({ group: options.group })}`, request, this.cache);
    }

    async reduceArdAlleles(payload: ArdReduceQuery): Promise<ArdReduceResponse[]> {
        this.assertArray(payload.alleles, 'alleles');
        const body: ArdReduceQuery = {
            alleles: payload.alleles,
        };
        setDefined(body, 'group', payload.group);
        return this.cacheRequest<ArdReduceResponse[]>(
            `ard:reduce:query:${stableSerialize(body)}`,
            () => this.post<ArdReduceResponse[]>('/ard/reduce', body),
            this.cache,
        );
    }

    async getSerotypeByAllele(allele: string, version?: number, options: RequestOptions = {}): Promise<SerotypeResponse[]> {
        this.assertRequiredString(allele, 'allele');
        return this.cacheRequest<SerotypeResponse[]>(
            `serotype:get:${allele}:${version ?? 'latest'}`,
            async () => {
                const config = applyRefreshOptions(options, {
                    params: {
                        allele,
                        ...(version !== undefined ? { version } : undefined),
                    },
                });
                const data = await this.get<SerotypeResponseApi[]>('/serotype', config);
                return mapSerotypeResponses(data);
            },
            this.cache,
        );
    }

    async querySerotype(payload: SerotypeQuery, options: RequestOptions = {}): Promise<SerotypeResponse[]> {
        this.assertArray(payload.alleles, 'alleles');
        return this.cacheRequest<SerotypeResponse[]>(
            `serotype:query:${stableSerialize(payload)}`,
            async () => {
                const config = applyRefreshOptions(options);
                const data = await this.post<SerotypeResponseApi[]>('/serotype', payload, config);
                return mapSerotypeResponses(data);
            },
            this.cache,
        );
    }

    async filterSerotype(payload: SerotypeFilterQuery, options: RequestOptions = {}): Promise<SerotypeResponse[]> {
        const body = toSerotypeFilterPayload(payload);
        return this.cacheRequest<SerotypeResponse[]>(
            `serotype:filter:${stableSerialize(body)}`,
            async () => {
                const config = applyRefreshOptions(options);
                const data = await this.post<SerotypeResponseApi[]>('/serotype/filter', body, config);
                return mapSerotypeResponses(data);
            },
            this.cache,
        );
    }

    private async get<T>(path: string, config?: AxiosRequestConfig): Promise<T> {
        const response = await this.client.get<T>(this.buildUrl(path), config);
        return response.data;
    }

    private async post<T>(path: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> {
        const response = await this.client.post<T>(this.buildUrl(path), data, config);
        return response.data;
    }

    private buildUrl(path: string): string {
        return `${this.basePath}${path}`;
    }

    private cacheRequest<T>(key: string, factory: () => Promise<T>, cache: LRUCache<string, Promise<unknown>> | null): Promise<T> {
        if (!cache) {
            return factory();
        }

        const cached = cache.get(key) as Promise<T> | undefined;
        if (cached) {
            return cached;
        }

        const pending = factory().catch((error) => {
            cache.delete(key);
            throw error;
        });
        cache.set(key, pending as Promise<unknown>);
        return pending;
    }

    private assertRequiredString(value: string | undefined, field: string): void {
        if (!value || !value.trim()) {
            throw new Error(`Expected a non-empty value for ${field}.`);
        }
    }

    private assertArray(value: unknown[], field: string): void {
        if (!Array.isArray(value) || value.length === 0) {
            throw new Error(`Expected ${field} to be a non-empty array.`);
        }
    }
}

interface ResolvedCacheOptions {
    max: number;
    ttl: number;
    serologicalTtl: number;
}

interface SerotypeResponseApi {
    allele: string;
    comment: string;
    serotype: string;
    inputted_antigen: string;
    broad: string;
    ciwd_3_0: string;
    cwd_2_0: string;
    eurcwd: string;
    bw: string;
    version: number;
}

interface SerotypeFilterQueryApi {
    allele?: string | null;
    antigen?: string | null;
    serotype?: string | null;
    serotype_from_allele?: string | null;
    comment?: string | null;
    manufacturer?: Manufacturer | null;
    n_field?: number | null;
    version?: number | null;
}

interface BeadFilterCriteriaApi {
    allele?: string | null;
    alleles?: string[] | null;
    antigen?: string | null;
    serotype?: string | null;
    serotype_from_allele?: string | null;
    comment?: string | null;
    manufacturer?: Manufacturer | null;
    version?: number | null;
    n_field?: number | null;
}

interface BeadConditionalWhenApi {
    allele?: string | null;
    serotype?: string | null;
    comment?: string | null;
}

interface BeadConditionalApi {
    when: BeadConditionalWhenApi;
    filter: BeadFilterCriteriaApi;
}

interface BeadFilterQueryApi extends BeadFilterCriteriaApi {
    conditional?: BeadConditionalApi[] | null;
}

function mapSerotypeResponses(payload: SerotypeResponseApi[]): SerotypeResponse[] {
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

function toSerotypeFilterPayload(payload: SerotypeFilterQuery): SerotypeFilterQueryApi {
    const body: SerotypeFilterQueryApi = {};
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

function toBeadFilterPayload(payload: BeadFilterQuery): BeadFilterQueryApi {
    const body: BeadFilterQueryApi = toBeadFilterCriteriaPayload(payload);
    if (payload.conditional !== undefined) {
        body.conditional = payload.conditional ? payload.conditional.map(toBeadConditionalPayload) : null;
    }
    return body;
}

function toBeadFilterCriteriaPayload(payload: BeadFilterCriteria): BeadFilterCriteriaApi {
    const body: BeadFilterCriteriaApi = {};
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

function toBeadConditionalPayload(condition: BeadConditional): BeadConditionalApi {
    return {
        when: toBeadConditionalWhenPayload(condition.when),
        filter: toBeadFilterCriteriaPayload(condition.filter),
    };
}

function toBeadConditionalWhenPayload(when: BeadConditionalWhen): BeadConditionalWhenApi {
    const body: BeadConditionalWhenApi = {};
    setDefined(body, 'allele', when.allele);
    setDefined(body, 'locus', when.locus);
    setDefined(body, 'serotype', when.serotype);
    setDefined(body, 'comment', when.comment);
    return body;
}

function setDefined<T extends object>(target: T, key: string, value: unknown): void {
    if (value !== undefined) {
        (target as Record<string, unknown>)[key] = value;
    }
}

function trimTrailingSlash(input: string): string {
    return input.replace(/\/+$/, '');
}

function trimSlashes(input: string): string {
    return input.replace(/^\/+|\/+$/g, '');
}

function resolveCacheOptions(cache?: boolean | HatxServiceCacheOptions): ResolvedCacheOptions | null {
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

function stableSerialize(payload: unknown): string {
    const serialized = JSON.stringify(sortValue(payload));
    return serialized ?? 'undefined';
}

function applyRefreshOptions(options?: RequestOptions, config: AxiosRequestConfig = {}): AxiosRequestConfig {
    if (!options) {
        return config;
    }

    const params: Record<string, unknown> = { ...(config.params as Record<string, unknown> | undefined) };
    const headers: Record<string, string> = { ...(config.headers as Record<string, string> | undefined) };

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

function sortValue(value: unknown): unknown {
    if (value === null || typeof value !== 'object') {
        return value;
    }

    if (Array.isArray(value)) {
        return value.map((item) => sortValue(item));
    }

    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
        const nested = (value as Record<string, unknown>)[key];
        if (nested === undefined) {
            continue;
        }
        sorted[key] = sortValue(nested);
    }
    return sorted;
}
