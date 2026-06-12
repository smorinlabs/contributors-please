import { execFile } from "node:child_process";
import { access, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";
import { createTwoFilesPatch } from "diff";
import { parse as parseYaml } from "yaml";

import {
  type ContributorsConfig,
  normalizeConfig,
} from "./config.js";
import type { Classifier } from "./classifier.js";
import { PathClassifier } from "./classifiers/path.js";
import {
  isShallowRepository,
  readGitContributions,
} from "./git.js";
import { type GitHubClient } from "./github.js";
import { joinIdentities, parseMailmap } from "./identity-join.js";
import { render } from "./render.js";
import {
  type Contributor,
  type DiscoveredContributor,
  mergeState,
  readStateFile,
  serializeState,
} from "./state.js";

const execFileAsync = promisify(execFile);

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

export const DEFAULT_COMMIT_MESSAGE: string = "docs: update contributors";

const SKIP_CI_TRAILER = "[skip ci]";

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

export class Contributors {
  private constructor(
    private readonly github: GitHubClient,
    private readonly config: ContributorsConfig,
    private readonly classifier: Classifier,
    private readonly options: Required<
      Pick<ContributorsOptions, "repoPath" | "bootstrap" | "dryRun">
    > &
      Omit<ContributorsOptions, "repoPath" | "bootstrap" | "dryRun">
  ) {}

  static async fromConfig(
    github: GitHubClient,
    config: unknown,
    options: ContributorsOptions = {}
  ): Promise<Contributors> {
    const classifier = extractClassifier(config);
    return new Contributors(
      github,
      normalizeConfig(normalizeClassifierConfig(config)),
      classifier,
      normalizeOptions(options)
    );
  }

  static async fromConfigFile(
    github: GitHubClient,
    options: ContributorsOptions & {
      configFile?: string;
      configOverrides?: unknown;
    } = {}
  ): Promise<Contributors> {
    const repoPath = options.repoPath ?? process.cwd();
    const configFile = options.configFile ?? ".contributors.yml";
    const path = join(repoPath, configFile);
    const raw = (await exists(path)) ? parseYaml(await readFile(path, "utf8")) : {};
    return Contributors.fromConfig(
      github,
      mergeConfig(raw, options.configOverrides),
      { ...options, repoPath }
    );
  }

  async run(): Promise<RunResult> {
    if (await isShallowRepository(this.options.repoPath)) {
      throw new Error(
        "contributors-please requires a full checkout. Set actions/checkout fetch-depth: 0."
      );
    }

    const statePath = join(this.options.repoPath, this.config.stateFile);
    const outputPath = join(this.options.repoPath, this.config.outputFile);
    const stateExists = await exists(statePath);
    if (!stateExists && !this.options.bootstrap) {
      throw new Error(
        `No state file found at \`${this.config.stateFile}\`. Run npx contributors-please init locally to bootstrap, then commit the result.`
      );
    }

    const existingState = stateExists ? await readStateFile(statePath) : [];
    const declaredFirstSeenWarnings = existingState
      .filter(record => record.source === "declared" && !record.first_seen)
      .map(
        record =>
          `Declared contributor \`${record.login}\` had no \`first_seen\`; set to \`${this.options.today ?? isoToday()}\`.`
      );
    const existingStateFile = stateExists ? await readFile(statePath, "utf8") : "";
    const existingOutputFile = (await exists(outputPath))
      ? await readFile(outputPath, "utf8")
      : "";
    const apiContributors = await this.github.listContributors();
    const gitContributions = await readGitContributions(this.options.repoPath, {
      ignoredEmails: this.options.committerEmail
        ? [this.options.committerEmail]
        : [],
      ignoredNames: this.options.committerLogin
        ? [this.options.committerLogin]
        : [],
    });
    const joined = joinIdentities({
      apiContributors,
      gitContributions,
      mailmap: parseMailmap(await maybeRead(".mailmap", this.options.repoPath)),
      config: this.config,
      serverUrl: this.github.serverUrl,
    });

    const discovered = joined.records.map(record => {
      const classification = this.classifier.classify(record, {
        config: this.config,
      });
      return {
        login: record.login,
        name: record.name,
        profile: record.profile,
        avatar: record.avatar,
        source: "commit",
        pinned: false,
        categories: classification.categories,
        title: classification.title,
        emoji: classification.emoji,
        commits: record.commits,
        first_seen: record.first_seen,
      } satisfies DiscoveredContributor;
    });
    const pinnedStaleWarnings = this.config.pinWarnOnStale
      ? pinnedStaleClassificationWarnings(existingState, discovered)
      : [];

    const merged = mergeState(existingState, discovered, {
      today: this.options.today,
    });
    const renderedRecords = selectRenderedRecords(
      merged,
      this.config,
      this.options.committerLogin
    );
    const rendered = render({
      records: renderedRecords,
      config: this.config,
      templateContent: await maybeRead(this.config.templateFile, this.options.repoPath),
      existingContent: this.config.inPlace ? existingOutputFile : undefined,
    });
    const proposedStateFile = serializeState(merged);
    const proposedOutputFile = rendered.content;

    return {
      changed:
        proposedStateFile !== existingStateFile ||
        proposedOutputFile !== existingOutputFile,
      addedLogins: merged
        .filter(
          record =>
            !existingState.some(existing => existing.login === record.login)
        )
        .map(record => record.login),
      promotedLogins: promotedLogins(existingState, merged),
      contributorsCount: rendered.count,
      contributorsJson: merged,
      proposedStateFile,
      proposedOutputFile,
      warnings: [
        ...declaredFirstSeenWarnings,
        ...pinnedStaleWarnings,
        ...joined.unjoined.map(
          author =>
            `Could not join git author ${author.name} <${author.email}> to a GitHub login.`
        ),
      ],
    };
  }

  async commit(options: CommitOptions): Promise<CommitResult> {
    const result = await this.run();
    if (!result.changed || this.options.dryRun) {
      return {
        ...result,
        commitSha: "",
      };
    }

    await configureCommitter(
      this.options.repoPath,
      this.options,
      this.config.noReplyDomain ?? noReplyDomainFromServerUrl(this.github.serverUrl)
    );
    await this.writeProposedFiles(result);
    await git(this.options.repoPath, [
      "add",
      this.config.stateFile,
      this.config.outputFile,
    ]);
    await git(this.options.repoPath, [
      "commit",
      "-m",
      resolveCommitMessage(options.message, options.skipCi ?? true),
    ]);
    const { stdout } = await git(this.options.repoPath, ["rev-parse", "HEAD"]);
    return {
      ...result,
      commitSha: stdout.trim(),
    };
  }

  async check(): Promise<CheckResult> {
    const result = await this.run();
    return {
      ...result,
      diff: await this.diffProposedFiles(result),
    };
  }

  async openPullRequest(
    options: OpenPullRequestOptions
  ): Promise<OpenPullRequestResult> {
    const bootstrapMissingState = await this.isMissingStateBootstrap();
    const result = await this.run();
    if (!result.changed || this.options.dryRun) {
      return {
        ...result,
        commitSha: "",
        prOpened: false,
        prNumber: "",
        prUrl: "",
      };
    }

    await assertBranchOnlyAuthoredByBot(
      this.options.repoPath,
      options.base,
      options.branch,
      this.options.committerLogin
    );
    await git(this.options.repoPath, ["checkout", "-B", options.branch]);
    await configureCommitter(
      this.options.repoPath,
      this.options,
      this.config.noReplyDomain ?? noReplyDomainFromServerUrl(this.github.serverUrl)
    );
    await this.writeProposedFiles(result);
    await git(this.options.repoPath, [
      "add",
      this.config.stateFile,
      this.config.outputFile,
    ]);
    await git(this.options.repoPath, [
      "commit",
      "-m",
      resolveCommitMessage(options.commitMessage, options.skipCi ?? false),
    ]);
    const { stdout } = await git(this.options.repoPath, ["rev-parse", "HEAD"]);
    const commitSha = stdout.trim();

    if (options.push ?? true) {
      await git(this.options.repoPath, [
        "push",
        "--force-with-lease",
        "origin",
        `${options.branch}:${options.branch}`,
      ]);
    }

    const label = options.label ?? "contributors-please: pending";
    if (!options.skipLabeling) {
      await this.github.ensureLabel({
        name: label,
        color: "0E8A16",
        description: "Pull request opened by contributors-please",
      });
    }
    const pr = await this.github.openPullRequest({
      head: options.branch,
      base: options.base,
      title: bootstrapMissingState ? "chore: bootstrap contributors" : options.title,
      body: options.body,
      labels: options.skipLabeling ? [] : [label],
    });

    return {
      ...result,
      commitSha,
      prOpened: true,
      prNumber: String(pr.number),
      prUrl: pr.url,
    };
  }

  private async writeProposedFiles(result: RunResult): Promise<void> {
    await writeFile(
      join(this.options.repoPath, this.config.stateFile),
      result.proposedStateFile,
      "utf8"
    );
    await writeFile(
      join(this.options.repoPath, this.config.outputFile),
      result.proposedOutputFile,
      "utf8"
    );
  }

  private async diffProposedFiles(result: RunResult): Promise<string> {
    const statePath = join(this.options.repoPath, this.config.stateFile);
    const outputPath = join(this.options.repoPath, this.config.outputFile);
    const currentStateFile = (await exists(statePath))
      ? await readFile(statePath, "utf8")
      : "";
    const currentOutputFile = (await exists(outputPath))
      ? await readFile(outputPath, "utf8")
      : "";

    return [
      makePatch(this.config.stateFile, currentStateFile, result.proposedStateFile),
      makePatch(this.config.outputFile, currentOutputFile, result.proposedOutputFile),
    ]
      .filter(Boolean)
      .join("\n");
  }

  private async isMissingStateBootstrap(): Promise<boolean> {
    return (
      this.options.bootstrap &&
      !(await exists(join(this.options.repoPath, this.config.stateFile)))
    );
  }
}

function resolveCommitMessage(
  message: string | undefined,
  skipCi: boolean
): string {
  const base = message ?? DEFAULT_COMMIT_MESSAGE;
  if (!skipCi || base.includes(SKIP_CI_TRAILER)) {
    return base;
  }
  return `${base}\n\n${SKIP_CI_TRAILER}`;
}

function makePatch(file: string, before: string, after: string): string {
  if (before === after) {
    return "";
  }
  return createTwoFilesPatch(file, file, before, after, "", "");
}

function normalizeOptions(options: ContributorsOptions) {
  return {
    repoPath: options.repoPath ?? process.cwd(),
    bootstrap: options.bootstrap ?? false,
    dryRun: options.dryRun ?? false,
    today: options.today,
    committerLogin: options.committerLogin,
    committerEmail: options.committerEmail,
  };
}

function mergeConfig(raw: unknown, overrides: unknown): unknown {
  if (!overrides) {
    return raw;
  }
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const rawRecord = raw as Record<string, unknown>;
    const overrideRecord = overrides as Record<string, unknown>;
    if (
      rawRecord.packages &&
      typeof rawRecord.packages === "object" &&
      !Array.isArray(rawRecord.packages)
    ) {
      const packages = rawRecord.packages as Record<string, unknown>;
      const rootPackage =
        packages["."] && typeof packages["."] === "object" && !Array.isArray(packages["."])
          ? (packages["."] as Record<string, unknown>)
          : {};
      return {
        ...rawRecord,
        packages: {
          ...packages,
          ".": {
            ...rootPackage,
            ...overrideRecord,
          },
        },
      };
    }
    return {
      ...rawRecord,
      ...overrideRecord,
    };
  }
  return overrides;
}

function extractClassifier(config: unknown): Classifier {
  const classifier =
    config && typeof config === "object" && !Array.isArray(config)
      ? (config as Record<string, unknown>).classifier
      : undefined;
  return isClassifier(classifier) ? classifier : new PathClassifier();
}

function normalizeClassifierConfig(config: unknown): unknown {
  if (
    !config ||
    typeof config !== "object" ||
    Array.isArray(config) ||
    !isClassifier((config as Record<string, unknown>).classifier)
  ) {
    return config;
  }
  return {
    ...(config as Record<string, unknown>),
    classifier: "path",
  };
}

function isClassifier(value: unknown): value is Classifier {
  return (
    !!value &&
    typeof value === "object" &&
    typeof (value as Classifier).classify === "function"
  );
}

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function maybeRead(
  path: string | undefined,
  repoPath: string
): Promise<string | undefined> {
  if (!path) {
    return undefined;
  }
  const fullPath = join(repoPath, path);
  if (!(await exists(fullPath))) {
    return undefined;
  }
  return readFile(fullPath, "utf8");
}

function pinnedStaleClassificationWarnings(
  existing: readonly Contributor[],
  discovered: readonly DiscoveredContributor[]
): string[] {
  const discoveredByLogin = new Map(
    discovered.map(record => [record.login, record])
  );
  return existing.flatMap(record => {
    if (!record.pinned) {
      return [];
    }
    const update = discoveredByLogin.get(record.login);
    if (!update) {
      return [];
    }
    const differences: string[] = [];
    if (record.title !== update.title) {
      differences.push(`title \`${record.title}\` would be \`${update.title}\``);
    }
    if ((record.emoji ?? "") !== (update.emoji ?? "")) {
      differences.push(
        `emoji \`${record.emoji ?? ""}\` would be \`${update.emoji ?? ""}\``
      );
    }
    if (JSON.stringify(record.categories) !== JSON.stringify(update.categories)) {
      differences.push(
        `categories \`${record.categories.join(",")}\` would be \`${update.categories.join(",")}\``
      );
    }
    if (differences.length === 0) {
      return [];
    }
    return [
      `Pinned contributor \`${record.login}\` differs from current classification: ${differences.join("; ")}.`,
    ];
  });
}

function selectRenderedRecords(
  records: readonly Contributor[],
  config: ContributorsConfig,
  committerLogin?: string
): Contributor[] {
  const ignored = new Set([
    ...(committerLogin ? [committerLogin] : []),
    ...config.ignore,
  ]);
  const unignored = new Set(config.unignore);
  return records
    .filter(record => {
      if (unignored.has(record.login)) {
        return true;
      }
      if (ignored.has(record.login) || record.login.endsWith("[bot]")) {
        return false;
      }
      if (record.source === "declared") {
        return true;
      }
      return record.commits >= config.minContributions;
    })
    .sort((left, right) => {
      if (config.sort === "alphabetical") {
        return left.login.localeCompare(right.login);
      }
      if (config.sort === "first-seen") {
        return left.first_seen.localeCompare(right.first_seen);
      }
      return right.commits - left.commits || left.login.localeCompare(right.login);
    });
}

function promotedLogins(
  before: readonly Contributor[],
  after: readonly Contributor[]
): string[] {
  return after
    .filter(record => {
      const existing = before.find(candidate => candidate.login === record.login);
      return existing && existing.title !== record.title;
    })
    .map(record => record.login);
}

function isoToday(): string {
  return new Date().toISOString().slice(0, 10);
}

async function git(repoPath: string, args: readonly string[]) {
  return execFileAsync("git", [...args], {
    cwd: repoPath,
    maxBuffer: 10 * 1024 * 1024,
  });
}

async function assertBranchOnlyAuthoredByBot(
  repoPath: string,
  base: string,
  branch: string,
  committerLogin: string | undefined
): Promise<void> {
  const refsToCheck: string[] = [];
  if (!(await branchExists(repoPath, branch))) {
    const remoteRef = await fetchRemoteBranch(repoPath, branch);
    if (remoteRef) {
      refsToCheck.push(remoteRef);
    }
  } else {
    refsToCheck.push(branch);
    const remoteRef = await fetchRemoteBranch(repoPath, branch);
    if (remoteRef) {
      refsToCheck.push(remoteRef);
    }
  }

  for (const ref of new Set(refsToCheck)) {
    await assertRefOnlyAuthoredByBot(repoPath, base, branch, ref, committerLogin);
  }
}

async function assertRefOnlyAuthoredByBot(
  repoPath: string,
  base: string,
  branch: string,
  ref: string,
  committerLogin: string | undefined
): Promise<void> {
  const { stdout } = await git(repoPath, [
    "log",
    "--format=%an",
    `${base}..${ref}`,
  ]);
  const authors = stdout
    .split(/\r?\n/)
    .map(author => author.trim())
    .filter(Boolean);
  if (authors.length === 0) {
    return;
  }
  if (!committerLogin || authors.some(author => author !== committerLogin)) {
    throw new Error(
      `branch ${branch} contains commits not authored by ${committerLogin ?? "the configured bot"}; resolve manually before next run`
    );
  }
}

async function fetchRemoteBranch(
  repoPath: string,
  branch: string
): Promise<string | undefined> {
  const remoteRef = `refs/remotes/origin/${branch}`;
  try {
    await git(repoPath, [
      "fetch",
      "--quiet",
      "origin",
      `+refs/heads/${branch}:${remoteRef}`,
    ]);
    return remoteRef;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (
      message.includes("couldn't find remote ref") ||
      message.includes("does not appear to be a git repository") ||
      message.includes("No such remote")
    ) {
      return undefined;
    }
    throw new Error(
      `Could not verify remote branch ${branch} before updating; resolve manually before next run.`
    );
  }
}

async function branchExists(repoPath: string, branch: string): Promise<boolean> {
  try {
    await git(repoPath, ["show-ref", "--verify", "--quiet", `refs/heads/${branch}`]);
    return true;
  } catch {
    return false;
  }
}

async function configureCommitter(
  repoPath: string,
  options: Pick<ContributorsOptions, "committerLogin" | "committerEmail">,
  noReplyDomain: string
): Promise<void> {
  if (!options.committerLogin) {
    return;
  }
  await git(repoPath, ["config", "user.name", options.committerLogin]);
  await git(repoPath, [
    "config",
    "user.email",
    options.committerEmail ?? `${options.committerLogin}@${noReplyDomain}`,
  ]);
}

function noReplyDomainFromServerUrl(serverUrl: string): string {
  const host = new URL(serverUrl).host;
  return host === "github.com"
    ? "users.noreply.github.com"
    : `users.noreply.${host}`;
}
