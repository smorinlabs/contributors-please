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

interface ContributorApiRow {
  login: string;
  contributions?: number;
  avatar_url?: string;
  html_url?: string;
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

interface PullRequestApiRow {
  number: number;
  html_url: string;
}

interface IssueCommentApiRow {
  id: number;
  body?: string;
}

export class GitHubClient {
  readonly owner: string;
  readonly repo: string;
  readonly token?: string;
  readonly serverUrl: string;
  readonly apiUrl: string;
  readonly graphqlUrl: string;
  private readonly fetchImpl: typeof fetch;

  private constructor(config: Required<Pick<GitHubConfig, "owner" | "repo">> &
    GitHubUrls & {
      token?: string;
      serverUrl: string;
      fetch: typeof fetch;
    }) {
    this.owner = config.owner;
    this.repo = config.repo;
    this.token = config.token;
    this.serverUrl = config.serverUrl;
    this.apiUrl = config.apiUrl;
    this.graphqlUrl = config.graphqlUrl;
    this.fetchImpl = config.fetch;
  }

  static async create(config: GitHubConfig): Promise<GitHubClient> {
    const serverUrl = config.serverUrl ?? "https://github.com";
    const derived = GitHubClient.deriveUrls(serverUrl);
    return new GitHubClient({
      owner: config.owner,
      repo: config.repo,
      token: config.token,
      serverUrl,
      apiUrl: config.apiUrl ?? derived.apiUrl,
      graphqlUrl: config.graphqlUrl ?? derived.graphqlUrl,
      fetch: config.fetch ?? fetch,
    });
  }

  static deriveUrls(serverUrl: string): GitHubUrls {
    const normalized = serverUrl.replace(/\/$/, "");
    if (normalized === "https://github.com") {
      return {
        apiUrl: "https://api.github.com",
        graphqlUrl: "https://api.github.com/graphql",
      };
    }
    return {
      apiUrl: `${normalized}/api/v3`,
      graphqlUrl: `${normalized}/api/graphql`,
    };
  }

  async listContributors(): Promise<ApiContributor[]> {
    const rows = await this.requestJsonPages<ContributorApiRow>(
      `/repos/${this.owner}/${this.repo}/contributors?per_page=100`
    );
    return rows.map(row => ({
      login: row.login,
      name: row.login,
      avatar: row.avatar_url ?? "",
      profile:
        row.html_url ?? `${this.serverUrl.replace(/\/$/, "")}/${row.login}`,
      commits: row.contributions ?? 0,
    }));
  }

  async ensureLabel(spec: LabelSpec): Promise<void> {
    const encodedName = encodeURIComponent(spec.name);
    const response = await this.fetchImpl(
      `${this.apiUrl}/repos/${this.owner}/${this.repo}/labels/${encodedName}`,
      {
        headers: this.headers(),
      }
    );
    if (response.ok) {
      return;
    }
    if (response.status !== 404) {
      throw new Error(`GitHub label lookup failed: ${response.status}`);
    }

    const createResponse = await this.fetchImpl(
      `${this.apiUrl}/repos/${this.owner}/${this.repo}/labels`,
      {
        method: "POST",
        headers: this.headers(),
        body: JSON.stringify(spec),
      }
    );
    if (!createResponse.ok) {
      throw new Error(`GitHub label creation failed: ${createResponse.status}`);
    }
  }

  async openPullRequest(
    options: OpenPullRequestOptions
  ): Promise<PullRequestRef> {
    const existing = await this.findOpenPullRequest(options.head, options.base);
    const row = existing
      ? await this.updatePullRequest(existing.number, options)
      : await this.createPullRequest(options);
    if (options.labels?.length) {
      const labelResponse = await this.fetchImpl(
        `${this.apiUrl}/repos/${this.owner}/${this.repo}/issues/${row.number}/labels`,
        {
          method: "POST",
          headers: this.headers(),
          body: JSON.stringify({ labels: options.labels }),
        }
      );
      if (!labelResponse.ok) {
        throw new Error(`GitHub pull request labeling failed: ${labelResponse.status}`);
      }
    }
    return {
      number: row.number,
      url: row.html_url,
    };
  }

  async upsertIssueComment(issueNumber: number, body: string): Promise<void> {
    const comments = await this.requestJsonPages<IssueCommentApiRow>(
      `/repos/${this.owner}/${this.repo}/issues/${issueNumber}/comments?per_page=100`
    );
    const existing = comments.find(comment =>
      comment.body?.includes("<!-- contributors-please:check-comment -->")
    );
    if (existing) {
      const response = await this.fetchImpl(
        `${this.apiUrl}/repos/${this.owner}/${this.repo}/issues/comments/${existing.id}`,
        {
          method: "PATCH",
          headers: this.headers(),
          body: JSON.stringify({ body }),
        }
      );
      if (!response.ok) {
        throw new Error(`GitHub issue comment update failed: ${response.status}`);
      }
      return;
    }

    const response = await this.fetchImpl(
      `${this.apiUrl}/repos/${this.owner}/${this.repo}/issues/${issueNumber}/comments`,
      {
        method: "POST",
        headers: this.headers(),
        body: JSON.stringify({ body }),
      }
    );
    if (!response.ok) {
      throw new Error(`GitHub issue comment creation failed: ${response.status}`);
    }
  }

  private async findOpenPullRequest(
    head: string,
    base: string
  ): Promise<PullRequestApiRow | undefined> {
    const query = new URLSearchParams({
      state: "open",
      head: head.includes(":") ? head : `${this.owner}:${head}`,
      base,
      per_page: "1",
    });
    const response = await this.fetchImpl(
      `${this.apiUrl}/repos/${this.owner}/${this.repo}/pulls?${query.toString()}`,
      {
        headers: this.headers(),
      }
    );
    if (!response.ok) {
      throw new Error(`GitHub pull request lookup failed: ${response.status}`);
    }
    const rows = (await response.json()) as PullRequestApiRow[];
    return rows[0];
  }

  private async createPullRequest(
    options: OpenPullRequestOptions
  ): Promise<PullRequestApiRow> {
    const response = await this.fetchImpl(
      `${this.apiUrl}/repos/${this.owner}/${this.repo}/pulls`,
      {
        method: "POST",
        headers: this.headers(),
        body: JSON.stringify({
          head: options.head,
          base: options.base,
          title: options.title,
          body: options.body,
        }),
      }
    );
    if (!response.ok) {
      throw new Error(`GitHub pull request creation failed: ${response.status}`);
    }
    return (await response.json()) as PullRequestApiRow;
  }

  private async updatePullRequest(
    number: number,
    options: OpenPullRequestOptions
  ): Promise<PullRequestApiRow> {
    const response = await this.fetchImpl(
      `${this.apiUrl}/repos/${this.owner}/${this.repo}/pulls/${number}`,
      {
        method: "PATCH",
        headers: this.headers(),
        body: JSON.stringify({
          base: options.base,
          title: options.title,
          body: options.body,
        }),
      }
    );
    if (!response.ok) {
      throw new Error(`GitHub pull request update failed: ${response.status}`);
    }
    return (await response.json()) as PullRequestApiRow;
  }

  private async requestJson<T>(path: string): Promise<T> {
    const response = await this.fetchImpl(`${this.apiUrl}${path}`, {
      headers: this.headers(),
    });
    if (!response.ok) {
      throw new Error(`GitHub API request failed: ${response.status}`);
    }
    return (await response.json()) as T;
  }

  private async requestJsonPages<T>(path: string): Promise<T[]> {
    const rows: T[] = [];
    let nextUrl: string | undefined = `${this.apiUrl}${path}`;

    while (nextUrl) {
      const response = await this.fetchImpl(nextUrl, {
        headers: this.headers(),
      });
      if (!response.ok) {
        throw new Error(`GitHub API request failed: ${response.status}`);
      }
      rows.push(...((await response.json()) as T[]));
      nextUrl = nextLink(response.headers.get("link"));
    }

    return rows;
  }

  private headers(): Record<string, string> {
    return {
      accept: "application/vnd.github+json",
      "content-type": "application/json",
      ...(this.token ? { authorization: `Bearer ${this.token}` } : {}),
    };
  }
}

function nextLink(header: string | null): string | undefined {
  if (!header) {
    return undefined;
  }
  for (const part of header.split(",")) {
    const match = part.match(/<([^>]+)>;\s*rel="([^"]+)"/);
    if (match?.[2] === "next") {
      return match[1];
    }
  }
  return undefined;
}
