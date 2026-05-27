import type { ApiContributor } from "./identity-join.js";
export interface GitHubConfig {
    owner: string;
    repo: string;
    token?: string;
    serverUrl?: string;
    apiUrl?: string;
    graphqlUrl?: string;
    fetch?: typeof fetch;
}
export interface GitHubUrls {
    apiUrl: string;
    graphqlUrl: string;
}
export interface LabelSpec {
    name: string;
    color: string;
    description: string;
}
export interface OpenPullRequestOptions {
    head: string;
    base: string;
    title: string;
    body: string;
    labels?: string[];
}
export interface PullRequestRef {
    number: number;
    url: string;
}
export declare class GitHubClient {
    readonly owner: string;
    readonly repo: string;
    readonly token?: string;
    readonly serverUrl: string;
    readonly apiUrl: string;
    readonly graphqlUrl: string;
    private readonly fetchImpl;
    private constructor();
    static create(config: GitHubConfig): Promise<GitHubClient>;
    static deriveUrls(serverUrl: string): GitHubUrls;
    listContributors(): Promise<ApiContributor[]>;
    ensureLabel(spec: LabelSpec): Promise<void>;
    openPullRequest(options: OpenPullRequestOptions): Promise<PullRequestRef>;
    upsertIssueComment(issueNumber: number, body: string): Promise<void>;
    private findOpenPullRequest;
    private createPullRequest;
    private updatePullRequest;
    private requestJson;
    private requestJsonPages;
    private headers;
}
