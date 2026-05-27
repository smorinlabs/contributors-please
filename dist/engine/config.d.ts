export type ClassifierName = "path";
export type MultiCategoryResolution = "priority" | "combine";
export interface CategoryConfig {
    id: string;
    label: string;
    emoji?: string;
    paths: string[];
}
export interface DefaultCategoryConfig {
    id: string;
    label: string;
    emoji?: string;
}
export interface CombinationConfig {
    id?: string;
    label: string;
    emoji?: string;
    when: string[];
}
export interface ClassificationConfig {
    categories: CategoryConfig[];
    default: DefaultCategoryConfig;
    combinations: CombinationConfig[];
    multiCategoryResolution: MultiCategoryResolution;
}
export interface ContributorsConfig {
    classifier: ClassifierName;
    classification: ClassificationConfig;
    identityMap: IdentityMapEntry[];
    noReplyDomain?: string;
    outputFile: string;
    stateFile: string;
    configFile: string;
    templateFile?: string;
    templatePlaceholder: string;
    header?: string;
    footer?: string;
    inPlace: boolean;
    inPlaceMarkerStart: string;
    inPlaceMarkerEnd: string;
    entryTemplate: string;
    emptyText: string;
    columnsPerRow: number;
    sort: "contributions" | "alphabetical" | "first-seen";
    minContributions: number;
    ignore: string[];
    unignore: string[];
    pinWarnOnStale: boolean;
}
export interface IdentityMapEntry {
    login: string;
    emails: string[];
}
export declare class ConfigError extends Error {
    constructor(message: string);
}
export declare function normalizeConfig(raw?: unknown): ContributorsConfig;
