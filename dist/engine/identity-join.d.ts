import type { ContributorsConfig } from "./config.js";
import type { GitContribution } from "./git.js";
export interface ApiContributor {
    login: string;
    name?: string;
    avatar?: string;
    profile?: string;
    commits?: number;
}
export interface JoinedContributor extends ApiContributor {
    name: string;
    avatar: string;
    profile: string;
    commits: number;
    first_seen: string;
    files: string[];
}
export interface JoinIdentitiesOptions {
    apiContributors: readonly ApiContributor[];
    gitContributions: readonly GitContribution[];
    mailmap?: ReadonlyMap<string, string>;
    config: ContributorsConfig;
    serverUrl: string;
}
export interface JoinIdentitiesResult {
    records: JoinedContributor[];
    unjoined: {
        name: string;
        email: string;
    }[];
}
export declare function joinIdentities(options: JoinIdentitiesOptions): JoinIdentitiesResult;
export declare function parseMailmap(text: string | undefined): Map<string, string>;
