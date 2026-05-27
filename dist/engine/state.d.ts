export type ContributorSource = "commit" | "declared";
export interface Contributor {
    login: string;
    name: string;
    profile: string;
    avatar: string;
    source: ContributorSource;
    pinned: boolean;
    categories: string[];
    title: string;
    emoji?: string;
    commits: number;
    first_seen: string;
    last_updated: string;
}
export type StateFile = Contributor[];
export type DiscoveredContributor = Omit<Contributor, "first_seen" | "last_updated" | "pinned"> & Partial<Pick<Contributor, "first_seen" | "last_updated" | "pinned">>;
export interface MergeStateOptions {
    today?: string;
}
export declare class StateValidationError extends Error {
    constructor(message: string);
}
export declare function readStateFile(path: string): Promise<Contributor[]>;
export declare function writeStateFile(path: string, records: readonly Contributor[]): Promise<void>;
export declare function parseState(text: string): Contributor[];
export declare function serializeState(records: readonly Contributor[]): string;
export declare function mergeState(existing: readonly Contributor[], discovered: readonly DiscoveredContributor[], options?: MergeStateOptions): Contributor[];
