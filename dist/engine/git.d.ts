export interface GitContribution {
    name: string;
    email: string;
    commits: number;
    first_seen: string;
    files: string[];
}
export interface GitContributionOptions {
    ignoredEmails?: readonly string[];
    ignoredNames?: readonly string[];
}
export declare function isShallowRepository(repoPath: string): Promise<boolean>;
export declare function readGitContributions(repoPath: string, options?: GitContributionOptions): Promise<GitContribution[]>;
export declare function parseGitLog(log: string, options?: GitContributionOptions): GitContribution[];
