import { type GitHubClient } from "./github.js";
import { type Contributor } from "./state.js";
export interface ContributorsOptions {
    repoPath?: string;
    bootstrap?: boolean;
    dryRun?: boolean;
    today?: string;
    committerLogin?: string;
    committerEmail?: string;
}
export interface RunResult {
    changed: boolean;
    addedLogins: string[];
    promotedLogins: string[];
    contributorsCount: number;
    contributorsJson: Contributor[];
    proposedStateFile: string;
    proposedOutputFile: string;
    warnings: string[];
}
export declare const DEFAULT_COMMIT_MESSAGE = "docs: update contributors";
export interface CommitOptions {
    message?: string;
    skipCi?: boolean;
}
export interface CommitResult extends RunResult {
    commitSha: string;
}
export interface CheckResult extends RunResult {
    diff: string;
}
export interface OpenPullRequestOptions {
    branch: string;
    base: string;
    commitMessage?: string;
    skipCi?: boolean;
    title: string;
    body: string;
    label?: string;
    skipLabeling?: boolean;
    push?: boolean;
}
export interface OpenPullRequestResult extends CommitResult {
    prOpened: boolean;
    prNumber: string;
    prUrl: string;
}
export declare class Contributors {
    private readonly github;
    private readonly config;
    private readonly classifier;
    private readonly options;
    private constructor();
    static fromConfig(github: GitHubClient, config: unknown, options?: ContributorsOptions): Promise<Contributors>;
    static fromConfigFile(github: GitHubClient, options?: ContributorsOptions & {
        configFile?: string;
        configOverrides?: unknown;
    }): Promise<Contributors>;
    run(): Promise<RunResult>;
    commit(options: CommitOptions): Promise<CommitResult>;
    check(): Promise<CheckResult>;
    openPullRequest(options: OpenPullRequestOptions): Promise<OpenPullRequestResult>;
    private writeProposedFiles;
    private diffProposedFiles;
    private isMissingStateBootstrap;
}
