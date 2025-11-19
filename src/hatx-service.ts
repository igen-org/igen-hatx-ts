import axios, { type AxiosInstance, type AxiosRequestConfig } from 'axios';
import type {
    BeadFilterQuery,
    BeadQuery,
    BeadResponse,
    SerologicalQuery,
    SerologicalResponse,
    SerotypeFilterQuery,
    SerotypeQuery,
    SerotypeResponse,
    SystemHealthResponse,
    SystemInfoResponse,
} from './types.js';

const DEFAULT_VERSION = 'v1';

export interface HatxServiceOptions {
    baseURL: string;
    version?: string;
    axiosConfig?: AxiosRequestConfig;
    httpClient?: AxiosInstance;
}

export class HatxService {
    private readonly client: AxiosInstance;
    private readonly basePath: string;

    constructor(options: HatxServiceOptions) {
        if (!options.baseURL) {
            throw new Error('HatxService requires a baseURL.');
        }

        const version = options.version ?? DEFAULT_VERSION;
        this.basePath = `${trimTrailingSlash(options.baseURL)}/${trimSlashes(version)}`;
        this.client =
            options.httpClient ??
            axios.create({
                baseURL: this.basePath,
                ...options.axiosConfig,
            });
    }

    async getSystemHealth(): Promise<SystemHealthResponse> {
        return this.get<SystemHealthResponse>('/system/health');
    }

    async getSystemInfo(): Promise<SystemInfoResponse> {
        return this.get<SystemInfoResponse>('/system/info');
    }

    async getSystemChangelog(): Promise<string> {
        return this.get<string>('/system/changelog', { responseType: 'text' });
    }

    async getBeadByAllele(allele: string): Promise<BeadResponse[]> {
        this.assertRequiredString(allele, 'allele');
        return this.get<BeadResponse[]>('/bead', { params: { allele } });
    }

    async queryBeads(payload: BeadQuery): Promise<BeadResponse[]> {
        this.assertArray(payload.alleles, 'alleles');
        return this.post<BeadResponse[]>('/bead', payload);
    }

    async filterBeads(payload: BeadFilterQuery): Promise<BeadResponse[]> {
        return this.post<BeadResponse[]>('/bead/filter', toBeadFilterPayload(payload));
    }

    async getSerologicalByAllele(allele: string): Promise<SerologicalResponse[]> {
        this.assertRequiredString(allele, 'allele');
        return this.get<SerologicalResponse[]>('/serological', { params: { allele } });
    }

    async querySerological(payload: SerologicalQuery): Promise<SerologicalResponse[]> {
        this.assertArray(payload.alleles, 'alleles');
        return this.post<SerologicalResponse[]>('/serological', payload);
    }

    async getSerotypeByAllele(allele: string, version?: number): Promise<SerotypeResponse[]> {
        this.assertRequiredString(allele, 'allele');
        const data = await this.get<SerotypeResponseApi[]>('/serotype', {
            params: {
                allele,
                ...(version !== undefined ? { version } : undefined),
            },
        });
        return mapSerotypeResponses(data);
    }

    async querySerotype(payload: SerotypeQuery): Promise<SerotypeResponse[]> {
        this.assertArray(payload.alleles, 'alleles');
        const data = await this.post<SerotypeResponseApi[]>('/serotype', payload);
        return mapSerotypeResponses(data);
    }

    async filterSerotype(payload: SerotypeFilterQuery): Promise<SerotypeResponse[]> {
        const data = await this.post<SerotypeResponseApi[]>(
            '/serotype/filter',
            toSerotypeFilterPayload(payload),
        );
        return mapSerotypeResponses(data);
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
    manufacturer?: string | null;
    n_field?: number | null;
    version?: number | null;
}

interface BeadFilterQueryApi {
    allele?: string | null;
    antigen?: string | null;
    serotype?: string | null;
    serotype_from_allele?: string | null;
    comment?: string | null;
    manufacturer?: string | null;
    version?: number | null;
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
    const body: BeadFilterQueryApi = {};
    setDefined(body, 'allele', payload.allele);
    setDefined(body, 'antigen', payload.antigen);
    setDefined(body, 'serotype', payload.serotype);
    setDefined(body, 'serotype_from_allele', payload.serotypeFromAllele);
    setDefined(body, 'comment', payload.comment);
    setDefined(body, 'manufacturer', payload.manufacturer);
    setDefined(body, 'version', payload.version);
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
