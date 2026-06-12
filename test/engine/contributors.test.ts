import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { describe, expect, it, vi } from "vitest";

import { Contributors } from "../../src/engine/contributors";
import type {
  ClassificationResult,
  Classifier,
  ClassifierContext,
  ContributorInput,
} from "../../src/engine/classifier";
import { GitHubClient } from "../../src/engine/github";

const execFileAsync = promisify(execFile);

async function git(repo: string, args: string[], env: NodeJS.ProcessEnv = {}) {
  await execFileAsync("git", args, {
    cwd: repo,
    env: { ...process.env, ...env },
  });
}

async function commit(repo: string) {
  await writeFile(join(repo, "src.ts"), "export const value = 1;\n");
  await git(repo, ["add", "src.ts"]);
  await git(repo, ["commit", "-m", "feat: add source"], {
    GIT_AUTHOR_NAME: "Ada",
    GIT_AUTHOR_EMAIL: "123+ada@users.noreply.github.com",
    GIT_AUTHOR_DATE: "2020-01-02T12:00:00Z",
    GIT_COMMITTER_NAME: "Ada",
    GIT_COMMITTER_EMAIL: "123+ada@users.noreply.github.com",
    GIT_COMMITTER_DATE: "2020-01-02T12:00:00Z",
  });
}

async function fakeGitHub() {
  return GitHubClient.create({
    owner: "smorinlabs",
    repo: "example",
    fetch: async () =>
      new Response(
        JSON.stringify([
          {
            login: "ada",
            contributions: 1,
            avatar_url: "https://avatars/ada",
            html_url: "https://github.com/ada",
          },
        ]),
        { status: 200 }
      ),
  });
}

describe("Contributors", () => {
  it("fails fast without a state file unless bootstrap is enabled", async () => {
    const repo = await mkdtemp(join(tmpdir(), "contributors-run-"));
    try {
      await git(repo, ["init"]);
      await commit(repo);
      const contributors = await Contributors.fromConfig(
        await fakeGitHub(),
        {},
        { repoPath: repo }
      );

      await expect(contributors.run()).rejects.toThrow(
        "No state file found at `.contributors.jsonl`"
      );
    } finally {
      await rm(repo, { recursive: true, force: true });
    }
  });

  it("bootstraps, classifies, merges, and renders contributors", async () => {
    const repo = await mkdtemp(join(tmpdir(), "contributors-run-"));
    try {
      await git(repo, ["init"]);
      await commit(repo);
      const contributors = await Contributors.fromConfig(
        await fakeGitHub(),
        {
          output_file: "CONTRIBUTORS.md",
          entry_template: "- {{login}} {{title}} {{commits}}",
        },
        {
          repoPath: repo,
          bootstrap: true,
          today: "2026-05-26",
        }
      );

      const result = await contributors.run();

      expect(result.changed).toBe(true);
      expect(result.addedLogins).toEqual(["ada"]);
      expect(result.contributorsCount).toBe(1);
      expect(result.contributorsJson[0]).toMatchObject({
        login: "ada",
        source: "commit",
        pinned: false,
        title: "Code Contributor",
        first_seen: "2020-01-02",
        last_updated: "2026-05-26",
      });
      expect(result.proposedOutputFile).toBe("- ada Code Contributor 1\n");
      expect(result.proposedStateFile).toContain('"login":"ada"');
    } finally {
      await rm(repo, { recursive: true, force: true });
    }
  });

  it("fromConfig accepts a custom Classifier instance for library consumers", async () => {
    const repo = await mkdtemp(join(tmpdir(), "contributors-run-"));
    class ReviewClassifier implements Classifier {
      readonly requiredData = ["reviews"] as const;

      classify(
        contributor: ContributorInput,
        _context: ClassifierContext
      ): ClassificationResult {
        return {
          categories: [],
          title: `Top Reviewer: ${contributor.login}`,
        };
      }
    }

    try {
      await git(repo, ["init"]);
      await commit(repo);
      const contributors = await Contributors.fromConfig(
        await fakeGitHub(),
        {
          classifier: new ReviewClassifier(),
          output_file: "CONTRIBUTORS.md",
          entry_template: "- {{login}} {{title}}",
        },
        {
          repoPath: repo,
          bootstrap: true,
          today: "2026-05-26",
        }
      );

      const result = await contributors.run();

      expect(result.contributorsJson[0]).toMatchObject({
        login: "ada",
        categories: [],
        title: "Top Reviewer: ada",
      });
      expect(result.proposedOutputFile).toBe("- ada Top Reviewer: ada\n");
    } finally {
      await rm(repo, { recursive: true, force: true });
    }
  });

  it("uses .mailmap to join old author emails to GitHub no-reply identities", async () => {
    const repo = await mkdtemp(join(tmpdir(), "contributors-run-"));
    try {
      await git(repo, ["init"]);
      await writeFile(join(repo, "src.ts"), "export const value = 1;\n");
      await writeFile(
        join(repo, ".mailmap"),
        "Ada Lovelace <123+ada@users.noreply.github.com> <ada@old.example.com>\n"
      );
      await git(repo, ["add", "src.ts", ".mailmap"]);
      await git(repo, ["commit", "-m", "feat: add source"], {
        GIT_AUTHOR_NAME: "Ada Old",
        GIT_AUTHOR_EMAIL: "ada@old.example.com",
        GIT_AUTHOR_DATE: "2020-01-02T12:00:00Z",
        GIT_COMMITTER_NAME: "Ada Old",
        GIT_COMMITTER_EMAIL: "ada@old.example.com",
        GIT_COMMITTER_DATE: "2020-01-02T12:00:00Z",
      });
      const contributors = await Contributors.fromConfig(
        await fakeGitHub(),
        {
          output_file: "CONTRIBUTORS.md",
          entry_template: "- {{login}} {{title}} {{commits}}",
        },
        {
          repoPath: repo,
          bootstrap: true,
          today: "2026-05-26",
        }
      );

      const result = await contributors.run();

      expect(result.contributorsJson[0]).toMatchObject({
        login: "ada",
        first_seen: "2020-01-02",
      });
      expect(result.warnings).toEqual([]);
    } finally {
      await rm(repo, { recursive: true, force: true });
    }
  });

  it("fromConfigFile applies action-style config overrides", async () => {
    const repo = await mkdtemp(join(tmpdir(), "contributors-run-"));
    try {
      await git(repo, ["init"]);
      await commit(repo);
      await writeFile(
        join(repo, ".contributors.yml"),
        "output_file: CONTRIBUTORS.md\nstate_file: .contributors.jsonl\nentry_template: '{{login}}'\n"
      );
      const contributors = await Contributors.fromConfigFile(await fakeGitHub(), {
        repoPath: repo,
        bootstrap: true,
        today: "2026-05-26",
        committerLogin: "contributors-please-bot[bot]",
        configOverrides: {
          output_file: "TEAM.md",
          state_file: ".team-contributors.jsonl",
          entry_template: "- {{login}} {{title}}",
        },
      });

      const result = await contributors.run();

      expect(result.proposedOutputFile).toBe("- ada Code Contributor\n");
      await contributors.commit({ message: "docs: update contributors" });
      await expect(readFile(join(repo, "TEAM.md"), "utf8")).resolves.toBe(
        "- ada Code Contributor\n"
      );
      await expect(
        readFile(join(repo, ".team-contributors.jsonl"), "utf8")
      ).resolves.toContain('"login":"ada"');
    } finally {
      await rm(repo, { recursive: true, force: true });
    }
  });

  it("fromConfigFile applies action-style config overrides to packages root form", async () => {
    const repo = await mkdtemp(join(tmpdir(), "contributors-run-"));
    try {
      await git(repo, ["init"]);
      await commit(repo);
      await writeFile(
        join(repo, ".contributors.yml"),
        [
          "packages:",
          "  \".\":",
          "    entry_template: '{{login}} package-root'",
          "",
        ].join("\n")
      );
      await writeFile(
        join(repo, ".team-contributors.jsonl"),
        `${JSON.stringify({
          login: "config-tester",
          name: "Config Tester",
          profile: "https://example.com/config-tester",
          avatar: "",
          source: "commit",
          pinned: false,
          categories: ["code"],
          title: "Code Contributor",
          emoji: "code",
          commits: 2,
          first_seen: "2026-05-27",
          last_updated: "2026-05-27",
        })}\n`
      );

      const contributors = await Contributors.fromConfigFile(await fakeGitHub(), {
        repoPath: repo,
        configOverrides: {
          output_file: "TEAM.md",
          state_file: ".team-contributors.jsonl",
          min_contributions: 2,
        },
      });

      const result = await contributors.run();

      expect(result.proposedOutputFile).toBe("config-tester package-root\n");
    } finally {
      await rm(repo, { recursive: true, force: true });
    }
  });

  it("warns when declared state records are missing first_seen", async () => {
    const repo = await mkdtemp(join(tmpdir(), "contributors-run-"));
    try {
      await git(repo, ["init"]);
      await commit(repo);
      await writeFile(
        join(repo, ".contributors.jsonl"),
        `${JSON.stringify({
          login: "designer",
          name: "Designer",
          profile: "https://github.com/designer",
          avatar: "",
          source: "declared",
          pinned: true,
          categories: ["design"],
          title: "Design Lead",
          commits: 0,
          last_updated: "2024-01-10",
        })}\n`
      );
      const contributors = await Contributors.fromConfig(
        await fakeGitHub(),
        {
          output_file: "CONTRIBUTORS.md",
          entry_template: "- {{login}} {{title}}",
        },
        {
          repoPath: repo,
          today: "2026-05-26",
        }
      );

      const result = await contributors.run();

      expect(result.warnings).toContain(
        "Declared contributor `designer` had no `first_seen`; set to `2026-05-26`."
      );
      expect(result.proposedStateFile).toContain('"login":"designer"');
      expect(result.proposedStateFile).toContain('"first_seen":"2026-05-26"');
    } finally {
      await rm(repo, { recursive: true, force: true });
    }
  });

  it("renders declared contributors even when their commit count is below min_contributions", async () => {
    const repo = await mkdtemp(join(tmpdir(), "contributors-run-"));
    try {
      await git(repo, ["init"]);
      await commit(repo);
      await writeFile(
        join(repo, ".contributors.jsonl"),
        `${JSON.stringify({
          login: "designer",
          name: "Design Partner",
          profile: "https://example.com/designer",
          avatar: "",
          source: "declared",
          pinned: true,
          categories: [],
          title: "Design Lead",
          commits: 0,
          first_seen: "2026-05-26",
          last_updated: "2026-05-26",
        })}\n`
      );
      const contributors = await Contributors.fromConfig(
        await fakeGitHub(),
        {
          output_file: "CONTRIBUTORS.md",
          entry_template: "- {{login}} {{title}} {{commits}}",
          min_contributions: 1,
        },
        {
          repoPath: repo,
          today: "2026-05-26",
        }
      );

      const result = await contributors.run();

      expect(result.proposedOutputFile).toContain("- designer Design Lead 0");
      expect(result.contributorsCount).toBe(2);
    } finally {
      await rm(repo, { recursive: true, force: true });
    }
  });

  it("warns when pinned contributor classification is stale", async () => {
    const repo = await mkdtemp(join(tmpdir(), "contributors-run-"));
    try {
      await git(repo, ["init"]);
      await commit(repo);
      await writeFile(
        join(repo, ".contributors.jsonl"),
        `${JSON.stringify({
          login: "ada",
          name: "Ada",
          profile: "https://github.com/ada",
          avatar: "https://avatars/ada",
          source: "commit",
          pinned: true,
          categories: ["design"],
          title: "Design Lead",
          commits: 1,
          first_seen: "2020-01-02",
          last_updated: "2024-01-10",
        })}\n`
      );
      const contributors = await Contributors.fromConfig(
        await fakeGitHub(),
        {
          output_file: "CONTRIBUTORS.md",
          entry_template: "- {{login}} {{title}}",
          pin_warn_on_stale: true,
        },
        {
          repoPath: repo,
          today: "2026-05-26",
        }
      );

      const result = await contributors.run();

      expect(result.warnings).toContain(
        "Pinned contributor `ada` differs from current classification: title `Design Lead` would be `Code Contributor`; emoji `` would be `code`; categories `design` would be `code`."
      );
      expect(result.contributorsJson[0]).toMatchObject({
        login: "ada",
        pinned: true,
        title: "Design Lead",
        categories: ["design"],
      });
    } finally {
      await rm(repo, { recursive: true, force: true });
    }
  });

  it("excludes the current committer login from rendered output even for PAT identities", async () => {
    const repo = await mkdtemp(join(tmpdir(), "contributors-run-"));
    try {
      await git(repo, ["init"]);
      await commit(repo);
      await writeFile(
        join(repo, ".contributors.jsonl"),
        `${JSON.stringify({
          login: "pat-user",
          name: "PAT User",
          profile: "https://github.com/pat-user",
          avatar: "",
          source: "commit",
          pinned: false,
          categories: ["code"],
          title: "Code Contributor",
          commits: 99,
          first_seen: "2024-01-01",
          last_updated: "2024-01-01",
        })}\n`
      );
      const contributors = await Contributors.fromConfig(
        await fakeGitHub(),
        {
          output_file: "CONTRIBUTORS.md",
          entry_template: "- {{login}} {{title}}",
        },
        {
          repoPath: repo,
          committerLogin: "pat-user",
          today: "2026-05-26",
        }
      );

      const result = await contributors.run();

      expect(result.contributorsJson.map(record => record.login)).toContain(
        "pat-user"
      );
      expect(result.proposedOutputFile).toBe("- ada Code Contributor\n");
      expect(result.contributorsCount).toBe(1);
    } finally {
      await rm(repo, { recursive: true, force: true });
    }
  });

  it("commit writes proposed files and creates one commit when changed", async () => {
    const repo = await mkdtemp(join(tmpdir(), "contributors-run-"));
    try {
      await git(repo, ["init"]);
      await git(repo, ["config", "user.name", "Test Bot"]);
      await git(repo, ["config", "user.email", "test-bot@example.com"]);
      await commit(repo);
      const contributors = await Contributors.fromConfig(
        await fakeGitHub(),
        {
          output_file: "CONTRIBUTORS.md",
          entry_template: "- {{login}} {{title}} {{commits}}",
        },
        {
          repoPath: repo,
          bootstrap: true,
          today: "2026-05-26",
        }
      );

      const result = await contributors.commit({
        message: "docs: update contributors\n\n[skip ci]",
      });

      expect(result.commitSha).toMatch(/^[0-9a-f]{40}$/);
      await expect(readFile(join(repo, "CONTRIBUTORS.md"), "utf8")).resolves.toBe(
        "- ada Code Contributor 1\n"
      );
      await expect(readFile(join(repo, ".contributors.jsonl"), "utf8")).resolves.toContain(
        '"login":"ada"'
      );
      const { stdout } = await execFileAsync("git", ["log", "-1", "--pretty=%s"], {
        cwd: repo,
      });
      expect(stdout.trim()).toBe("docs: update contributors");
    } finally {
      await rm(repo, { recursive: true, force: true });
    }
  });

  it("commit defaults to the standard message with a [skip ci] trailer", async () => {
    const repo = await mkdtemp(join(tmpdir(), "contributors-run-"));
    try {
      await git(repo, ["init"]);
      await git(repo, ["config", "user.name", "Test Bot"]);
      await git(repo, ["config", "user.email", "test-bot@example.com"]);
      await commit(repo);
      const contributors = await Contributors.fromConfig(
        await fakeGitHub(),
        {
          output_file: "CONTRIBUTORS.md",
          entry_template: "- {{login}} {{title}} {{commits}}",
        },
        {
          repoPath: repo,
          bootstrap: true,
          today: "2026-05-26",
        }
      );

      await contributors.commit({});

      const { stdout } = await execFileAsync("git", ["log", "-1", "--pretty=%B"], {
        cwd: repo,
      });
      expect(stdout.trim()).toBe("docs: update contributors\n\n[skip ci]");
    } finally {
      await rm(repo, { recursive: true, force: true });
    }
  });

  it("commit omits the [skip ci] trailer when skipCi is false", async () => {
    const repo = await mkdtemp(join(tmpdir(), "contributors-run-"));
    try {
      await git(repo, ["init"]);
      await git(repo, ["config", "user.name", "Test Bot"]);
      await git(repo, ["config", "user.email", "test-bot@example.com"]);
      await commit(repo);
      const contributors = await Contributors.fromConfig(
        await fakeGitHub(),
        {
          output_file: "CONTRIBUTORS.md",
          entry_template: "- {{login}} {{title}} {{commits}}",
        },
        {
          repoPath: repo,
          bootstrap: true,
          today: "2026-05-26",
        }
      );

      await contributors.commit({ skipCi: false });

      const { stdout } = await execFileAsync("git", ["log", "-1", "--pretty=%B"], {
        cwd: repo,
      });
      expect(stdout.trim()).toBe("docs: update contributors");
    } finally {
      await rm(repo, { recursive: true, force: true });
    }
  });

  it("commit does not duplicate an existing [skip ci] trailer", async () => {
    const repo = await mkdtemp(join(tmpdir(), "contributors-run-"));
    try {
      await git(repo, ["init"]);
      await git(repo, ["config", "user.name", "Test Bot"]);
      await git(repo, ["config", "user.email", "test-bot@example.com"]);
      await commit(repo);
      const contributors = await Contributors.fromConfig(
        await fakeGitHub(),
        {
          output_file: "CONTRIBUTORS.md",
          entry_template: "- {{login}} {{title}} {{commits}}",
        },
        {
          repoPath: repo,
          bootstrap: true,
          today: "2026-05-26",
        }
      );

      await contributors.commit({
        message: "docs: update contributors\n\n[skip ci]",
        skipCi: true,
      });

      const { stdout } = await execFileAsync("git", ["log", "-1", "--pretty=%B"], {
        cwd: repo,
      });
      expect(stdout.trim()).toBe("docs: update contributors\n\n[skip ci]");
    } finally {
      await rm(repo, { recursive: true, force: true });
    }
  });

  it("derives default committer no-reply email from GitHub Enterprise URL", async () => {
    const repo = await mkdtemp(join(tmpdir(), "contributors-run-"));
    try {
      await git(repo, ["init"]);
      await git(repo, ["config", "user.name", "Test Bot"]);
      await git(repo, ["config", "user.email", "test-bot@example.com"]);
      await commit(repo);
      const github = await GitHubClient.create({
        owner: "smorinlabs",
        repo: "example",
        serverUrl: "https://github.acme.corp",
        fetch: async () =>
          new Response(
            JSON.stringify([
              {
                login: "ada",
                contributions: 1,
                avatar_url: "https://avatars/ada",
                html_url: "https://github.acme.corp/ada",
              },
            ]),
            { status: 200 }
          ),
      });
      const contributors = await Contributors.fromConfig(
        github,
        {
          output_file: "CONTRIBUTORS.md",
          entry_template: "- {{login}} {{title}} {{commits}}",
          identity_map: [
            {
              login: "ada",
              emails: ["123+ada@users.noreply.github.com"],
            },
          ],
        },
        {
          repoPath: repo,
          bootstrap: true,
          committerLogin: "contributors-please-bot[bot]",
          today: "2026-05-26",
        }
      );

      await contributors.commit({
        message: "docs: update contributors\n\n[skip ci]",
      });

      const { stdout } = await execFileAsync("git", ["config", "user.email"], {
        cwd: repo,
      });
      expect(stdout.trim()).toBe(
        "contributors-please-bot[bot]@users.noreply.github.acme.corp"
      );
    } finally {
      await rm(repo, { recursive: true, force: true });
    }
  });

  it("openPullRequest commits on the update branch and applies the pending label", async () => {
    const repo = await mkdtemp(join(tmpdir(), "contributors-run-"));
    try {
      await git(repo, ["init"]);
      await git(repo, ["config", "user.name", "Test Bot"]);
      await git(repo, ["config", "user.email", "test-bot@example.com"]);
      await commit(repo);
      const github = await fakeGitHub();
      const ensureLabel = vi.fn().mockResolvedValue(undefined);
      const openPullRequest = vi.fn().mockResolvedValue({
        number: 12,
        url: "https://github.com/smorinlabs/example/pull/12",
      });
      Object.assign(github, { ensureLabel, openPullRequest });
      const contributors = await Contributors.fromConfig(
        github,
        {
          output_file: "CONTRIBUTORS.md",
          entry_template: "- {{login}} {{title}} {{commits}}",
        },
        {
          repoPath: repo,
          bootstrap: true,
          today: "2026-05-26",
        }
      );

      const result = await contributors.openPullRequest({
        branch: "contributors-please/update",
        base: "main",
        commitMessage: "docs: update contributors\n\n[skip ci]",
        title: "docs: update contributors",
        body: "Generated by contributors-please.",
        label: "contributors-please: pending",
        push: false,
      });

      expect(result).toMatchObject({
        prOpened: true,
        prNumber: "12",
        prUrl: "https://github.com/smorinlabs/example/pull/12",
      });
      expect(result.commitSha).toMatch(/^[0-9a-f]{40}$/);
      expect(ensureLabel).toHaveBeenCalledWith({
        name: "contributors-please: pending",
        color: "0E8A16",
        description: "Pull request opened by contributors-please",
      });
      expect(openPullRequest).toHaveBeenCalledWith({
        head: "contributors-please/update",
        base: "main",
        title: "chore: bootstrap contributors",
        body: "Generated by contributors-please.",
        labels: ["contributors-please: pending"],
      });
      const { stdout } = await execFileAsync("git", ["branch", "--show-current"], {
        cwd: repo,
      });
      expect(stdout.trim()).toBe("contributors-please/update");
    } finally {
      await rm(repo, { recursive: true, force: true });
    }
  });

  it("openPullRequest defaults to a commit message without [skip ci]", async () => {
    const repo = await mkdtemp(join(tmpdir(), "contributors-run-"));
    try {
      await git(repo, ["init"]);
      await git(repo, ["config", "user.name", "Test Bot"]);
      await git(repo, ["config", "user.email", "test-bot@example.com"]);
      await commit(repo);
      const github = await fakeGitHub();
      Object.assign(github, {
        ensureLabel: vi.fn().mockResolvedValue(undefined),
        openPullRequest: vi.fn().mockResolvedValue({
          number: 12,
          url: "https://github.com/smorinlabs/example/pull/12",
        }),
      });
      const contributors = await Contributors.fromConfig(
        github,
        {
          output_file: "CONTRIBUTORS.md",
          entry_template: "- {{login}} {{title}} {{commits}}",
        },
        {
          repoPath: repo,
          bootstrap: true,
          today: "2026-05-26",
        }
      );

      await contributors.openPullRequest({
        branch: "contributors-please/update",
        base: "main",
        title: "docs: update contributors",
        body: "Generated by contributors-please.",
        push: false,
      });

      const { stdout } = await execFileAsync("git", ["log", "-1", "--pretty=%B"], {
        cwd: repo,
      });
      expect(stdout.trim()).toBe("docs: update contributors");
    } finally {
      await rm(repo, { recursive: true, force: true });
    }
  });

  it("openPullRequest appends [skip ci] when skipCi is true", async () => {
    const repo = await mkdtemp(join(tmpdir(), "contributors-run-"));
    try {
      await git(repo, ["init"]);
      await git(repo, ["config", "user.name", "Test Bot"]);
      await git(repo, ["config", "user.email", "test-bot@example.com"]);
      await commit(repo);
      const github = await fakeGitHub();
      Object.assign(github, {
        ensureLabel: vi.fn().mockResolvedValue(undefined),
        openPullRequest: vi.fn().mockResolvedValue({
          number: 12,
          url: "https://github.com/smorinlabs/example/pull/12",
        }),
      });
      const contributors = await Contributors.fromConfig(
        github,
        {
          output_file: "CONTRIBUTORS.md",
          entry_template: "- {{login}} {{title}} {{commits}}",
        },
        {
          repoPath: repo,
          bootstrap: true,
          today: "2026-05-26",
        }
      );

      await contributors.openPullRequest({
        branch: "contributors-please/update",
        base: "main",
        skipCi: true,
        title: "docs: update contributors",
        body: "Generated by contributors-please.",
        push: false,
      });

      const { stdout } = await execFileAsync("git", ["log", "-1", "--pretty=%B"], {
        cwd: repo,
      });
      expect(stdout.trim()).toBe("docs: update contributors\n\n[skip ci]");
    } finally {
      await rm(repo, { recursive: true, force: true });
    }
  });

  it("openPullRequest titles a missing-state bootstrap PR as bootstrap contributors", async () => {
    const repo = await mkdtemp(join(tmpdir(), "contributors-run-"));
    try {
      await git(repo, ["init"]);
      await git(repo, ["config", "user.name", "Test Bot"]);
      await git(repo, ["config", "user.email", "test-bot@example.com"]);
      await commit(repo);
      const github = await fakeGitHub();
      const openPullRequest = vi.fn().mockResolvedValue({
        number: 12,
        url: "https://github.com/smorinlabs/example/pull/12",
      });
      Object.assign(github, {
        ensureLabel: vi.fn().mockResolvedValue(undefined),
        openPullRequest,
      });
      const contributors = await Contributors.fromConfig(
        github,
        {
          output_file: "CONTRIBUTORS.md",
          entry_template: "- {{login}} {{title}} {{commits}}",
        },
        {
          repoPath: repo,
          bootstrap: true,
          today: "2026-05-26",
        }
      );

      await contributors.openPullRequest({
        branch: "contributors-please/update",
        base: "main",
        commitMessage: "docs: update contributors\n\n[skip ci]",
        title: "docs: update contributors",
        body: "Generated by contributors-please.",
        push: false,
      });

      expect(openPullRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "chore: bootstrap contributors",
        })
      );
    } finally {
      await rm(repo, { recursive: true, force: true });
    }
  });

  it("openPullRequest omits label creation and attachment when skipLabeling is true", async () => {
    const repo = await mkdtemp(join(tmpdir(), "contributors-run-"));
    try {
      await git(repo, ["init"]);
      await git(repo, ["config", "user.name", "Test Bot"]);
      await git(repo, ["config", "user.email", "test-bot@example.com"]);
      await commit(repo);
      const github = await fakeGitHub();
      const ensureLabel = vi.fn().mockResolvedValue(undefined);
      const openPullRequest = vi.fn().mockResolvedValue({
        number: 12,
        url: "https://github.com/smorinlabs/example/pull/12",
      });
      Object.assign(github, { ensureLabel, openPullRequest });
      const contributors = await Contributors.fromConfig(
        github,
        {
          output_file: "CONTRIBUTORS.md",
          entry_template: "- {{login}} {{title}} {{commits}}",
        },
        {
          repoPath: repo,
          bootstrap: true,
          today: "2026-05-26",
        }
      );

      await contributors.openPullRequest({
        branch: "contributors-please/update",
        base: "main",
        commitMessage: "docs: update contributors\n\n[skip ci]",
        title: "docs: update contributors",
        body: "Generated by contributors-please.",
        push: false,
        skipLabeling: true,
      });

      expect(ensureLabel).not.toHaveBeenCalled();
      expect(openPullRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          labels: [],
        })
      );
    } finally {
      await rm(repo, { recursive: true, force: true });
    }
  });

  it("openPullRequest refuses to overwrite an existing update branch with human commits", async () => {
    const repo = await mkdtemp(join(tmpdir(), "contributors-run-"));
    try {
      await git(repo, ["init"]);
      await git(repo, ["config", "user.name", "Test Bot"]);
      await git(repo, ["config", "user.email", "test-bot@example.com"]);
      await commit(repo);
      const { stdout: baseStdout } = await execFileAsync(
        "git",
        ["branch", "--show-current"],
        {
          cwd: repo,
        }
      );
      const baseBranch = baseStdout.trim();
      await git(repo, ["checkout", "-b", "contributors-please/update"]);
      await writeFile(join(repo, "human.txt"), "manual work\n");
      await git(repo, ["add", "human.txt"]);
      await git(repo, ["commit", "-m", "manual update"], {
        GIT_AUTHOR_NAME: "Human Maintainer",
        GIT_AUTHOR_EMAIL: "human@example.com",
        GIT_COMMITTER_NAME: "Human Maintainer",
        GIT_COMMITTER_EMAIL: "human@example.com",
      });
      await git(repo, ["checkout", baseBranch]);
      const github = await fakeGitHub();
      Object.assign(github, {
        ensureLabel: vi.fn().mockResolvedValue(undefined),
        openPullRequest: vi.fn().mockResolvedValue({
          number: 12,
          url: "https://github.com/smorinlabs/example/pull/12",
        }),
      });
      const contributors = await Contributors.fromConfig(
        github,
        {
          output_file: "CONTRIBUTORS.md",
          entry_template: "- {{login}} {{title}} {{commits}}",
        },
        {
          repoPath: repo,
          bootstrap: true,
          committerLogin: "contributors-please-bot[bot]",
          today: "2026-05-26",
        }
      );

      await expect(
        contributors.openPullRequest({
          branch: "contributors-please/update",
          base: baseBranch,
          commitMessage: "docs: update contributors\n\n[skip ci]",
          title: "docs: update contributors",
          body: "Generated by contributors-please.",
          push: false,
        })
      ).rejects.toThrow(
        "branch contributors-please/update contains commits not authored by contributors-please-bot[bot]; resolve manually before next run"
      );

      const { stdout } = await execFileAsync("git", ["branch", "--show-current"], {
        cwd: repo,
      });
      expect(stdout.trim()).toBe(baseBranch);
    } finally {
      await rm(repo, { recursive: true, force: true });
    }
  });

  it("openPullRequest refuses to overwrite a remote-only update branch with human commits", async () => {
    const root = await mkdtemp(join(tmpdir(), "contributors-remote-"));
    const repo = join(root, "repo");
    const remote = join(root, "origin.git");
    const humanClone = join(root, "human");
    try {
      await mkdir(repo);
      await git(repo, ["init"]);
      await git(repo, ["checkout", "-b", "main"]);
      await commit(repo);
      await execFileAsync("git", ["init", "--bare", remote]);
      await git(repo, ["remote", "add", "origin", remote]);
      await git(repo, ["push", "origin", "main"]);

      await execFileAsync("git", ["clone", remote, humanClone]);
      await git(humanClone, ["checkout", "-b", "contributors-please/update"]);
      await writeFile(join(humanClone, "human.txt"), "manual work\n");
      await git(humanClone, ["add", "human.txt"]);
      await git(humanClone, ["commit", "-m", "manual update"], {
        GIT_AUTHOR_NAME: "Human Maintainer",
        GIT_AUTHOR_EMAIL: "human@example.com",
        GIT_COMMITTER_NAME: "Human Maintainer",
        GIT_COMMITTER_EMAIL: "human@example.com",
      });
      await git(humanClone, [
        "push",
        "origin",
        "HEAD:contributors-please/update",
      ]);

      const github = await fakeGitHub();
      Object.assign(github, {
        ensureLabel: vi.fn().mockResolvedValue(undefined),
        openPullRequest: vi.fn().mockResolvedValue({
          number: 12,
          url: "https://github.com/smorinlabs/example/pull/12",
        }),
      });
      const contributors = await Contributors.fromConfig(
        github,
        {
          output_file: "CONTRIBUTORS.md",
          entry_template: "- {{login}} {{title}} {{commits}}",
        },
        {
          repoPath: repo,
          bootstrap: true,
          committerLogin: "contributors-please-bot[bot]",
          today: "2026-05-26",
        }
      );

      await expect(
        contributors.openPullRequest({
          branch: "contributors-please/update",
          base: "main",
          commitMessage: "docs: update contributors\n\n[skip ci]",
          title: "docs: update contributors",
          body: "Generated by contributors-please.",
          push: false,
        })
      ).rejects.toThrow(
        "branch contributors-please/update contains commits not authored by contributors-please-bot[bot]; resolve manually before next run"
      );
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("check returns a diff and does not write proposed files when changed", async () => {
    const repo = await mkdtemp(join(tmpdir(), "contributors-run-"));
    try {
      await git(repo, ["init"]);
      await commit(repo);
      const contributors = await Contributors.fromConfig(
        await fakeGitHub(),
        {
          output_file: "CONTRIBUTORS.md",
          entry_template: "- {{login}} {{title}} {{commits}}",
        },
        {
          repoPath: repo,
          bootstrap: true,
          today: "2026-05-26",
        }
      );

      const result = await contributors.check();

      expect(result.changed).toBe(true);
      expect(result.diff).toContain("--- .contributors.jsonl");
      expect(result.diff).toContain("+++ .contributors.jsonl");
      expect(result.diff).toContain("--- CONTRIBUTORS.md");
      expect(result.diff).toContain("+++ CONTRIBUTORS.md");
      await expect(readFile(join(repo, ".contributors.jsonl"), "utf8")).rejects.toThrow();
      await expect(readFile(join(repo, "CONTRIBUTORS.md"), "utf8")).rejects.toThrow();
    } finally {
      await rm(repo, { recursive: true, force: true });
    }
  });
});
