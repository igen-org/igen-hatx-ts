export type SystemHealthResponse = Record<string, string>;

export interface SystemInfoResponse {
    title?: string | null;
    description?: string | null;
    version?: string | null;
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

export interface BeadFilterQuery {
    allele?: string | null;
    antigen?: string | null;
    serotype?: string | null;
    serotypeFromAllele?: string | null;
    comment?: string | null;
    manufacturer?: Manufacturer | null;
    version?: number | null;
}

export interface SerologicalResponse {
    allele: string;
    abhi: string;
    imgt: string;
}

export interface SerologicalQuery {
    alleles: string[];
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
