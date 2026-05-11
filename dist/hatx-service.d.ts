import { type AxiosInstance, type AxiosRequestConfig } from 'axios';
import type { ArdReduceOptions, ArdReduceQuery, ArdReduceResponse, BeadFilterQuery, BeadQuery, BeadResponse, RequestOptions, SerologicalQuery, SerologicalResponse, SerotypeFilterQuery, SerotypeQuery, SerotypeResponse, SystemHealthResponse, SystemInfoResponse } from './types.js';
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
export declare class HatxService {
    private readonly client;
    private readonly basePath;
    private readonly cache;
    private readonly serologicalCache;
    constructor(options: HatxServiceOptions);
    getSystemHealth(): Promise<SystemHealthResponse>;
    getSystemInfo(): Promise<SystemInfoResponse>;
    getSystemChangelog(): Promise<string>;
    getBeadByAllele(allele: string, options?: RequestOptions): Promise<BeadResponse[]>;
    queryBeads(payload: BeadQuery, options?: RequestOptions): Promise<BeadResponse[]>;
    filterBeads(payload: BeadFilterQuery, options?: RequestOptions): Promise<BeadResponse[]>;
    getSerologicalByAllele(allele: string, options?: RequestOptions): Promise<SerologicalResponse[]>;
    querySerological(payload: SerologicalQuery, options?: RequestOptions): Promise<SerologicalResponse[]>;
    getArdReducedByAllele(allele: string, options?: ArdReduceOptions): Promise<ArdReduceResponse>;
    reduceArdAlleles(payload: ArdReduceQuery): Promise<ArdReduceResponse[]>;
    getSerotypeByAllele(allele: string, version?: number, options?: RequestOptions): Promise<SerotypeResponse[]>;
    querySerotype(payload: SerotypeQuery, options?: RequestOptions): Promise<SerotypeResponse[]>;
    filterSerotype(payload: SerotypeFilterQuery, options?: RequestOptions): Promise<SerotypeResponse[]>;
    private get;
    private post;
    private buildUrl;
    private cacheRequest;
    private assertRequiredString;
    private assertArray;
}
//# sourceMappingURL=hatx-service.d.ts.map