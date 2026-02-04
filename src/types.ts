export type SystemHealthResponse = Record<string, string>;

export interface SystemInfoResponse {
    title?: string | null;
    description?: string | null;
    version?: string | null;
}

export interface RequestOptions {
    refresh?: boolean | null;
    refreshData?: boolean | null;
}

export type Manufacturer = 'ONE_LAMBDA' | 'IMMUCOR';
export type Kit = 'STANDARD' | 'EXPLEX';

export interface BeadResponse {
    allele: string;
    manufacturer: Manufacturer;
    kit: Kit;
}

export interface BeadQuery {
    alleles: string[];
}

export interface BeadFilterCriteria {
    allele?: string | null;
    alleles?: string[] | null;
    antigen?: string | null;
    serotype?: string | null;
    serotypeFromAllele?: string | null;
    comment?: string | null;
    manufacturer?: Manufacturer | null;
    version?: number | null;
    nField?: number | null;
}

export interface BeadConditionalWhen {
    allele?: string | null;
    locus?: string | null;
    serotype?: string | null;
    comment?: string | null;
}

export interface BeadConditional {
    when: BeadConditionalWhen;
    filter: BeadFilterCriteria;
}

export interface BeadFilterQuery extends BeadFilterCriteria {
    conditional?: BeadConditional[] | null;
}

export interface SerologicalResponse {
    allele: string;
    abhi?: string | null;
    imgt?: string | null;
}

export interface SerologicalQuery {
    alleles: string[];
}

export type ArdGroup = 'p_group' | 'g_group' | 'common_group';

export interface ArdReduceResponse {
    allele: string;
    group: ArdGroup;
    value: string;
}

export interface ArdReduceQuery {
    alleles: string[];
    group?: ArdGroup | null;
}

export interface ArdReduceOptions {
    group?: ArdGroup | null;
    refresh?: boolean | null;
    refreshData?: boolean | null;
}

export interface SerotypeResponse {
    allele: string;
    comment: string;
    serotype: string;
    inputtedAntigen: string;
    broad: string;
    ciwd30: string;
    cwd20: string;
    eurcwd: string;
    bw: string;
    version: number;
}

export interface SerotypeQuery {
    alleles: string[];
    version?: number | null;
}

export interface SerotypeFilterQuery {
    allele?: string | null;
    antigen?: string | null;
    serotype?: string | null;
    serotypeFromAllele?: string | null;
    comment?: string | null;
    manufacturer?: Manufacturer | null;
    nField?: number | null;
    version?: number | null;
}
