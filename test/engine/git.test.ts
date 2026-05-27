import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";

import { readGitContributions, isShallowRepository } from "../../src/engine/git";

const execFileAsync = promisify(execFile);

async function git(repo: string, args: string[], env: NodeJS.ProcessEnv = {}) {
  await execFileAsync("git", args, {
    cwd: repo,
    env: { ...process.env, ...env },
  });
}

async function commit(
  repo: string,
  file: string,
  content: string,
  author: { name: string; email: string; date: string }
) {
  const path = join(repo, file);
  await writeFile(path, content);
  await git(repo, ["add", file]);
  await git(repo, ["commit", "-m", `add ${file}`], {
    GIT_AUTHOR_NAME: author.name,
    GIT_AUTHOR_EMAIL: author.email,
    GIT_AUTHOR_DATE: `${author.date}T12:00:00Z`,
    GIT_COMMITTER_NAME: author.name,
    GIT_COMMITTER_EMAIL: author.email,
    GIT_COMMITTER_DATE: `${author.date}T12:00:00Z`,
  });
}

describe("git discovery", () => {
  it("detects whether the repository is shallow", async () => {
    const repo = await mkdtemp(join(tmpdir(), "contributors-git-"));
    try {
      await git(repo, ["init"]);
      await expect(isShallowRepository(repo)).resolves.toBe(false);
    } finally {
      await rm(repo, { recursive: true, force: true });
    }
  });

  it("aggregates non-merge commit counts, files, and earliest author date", async () => {
    const repo = await mkdtemp(join(tmpdir(), "contributors-git-"));
    try {
      await git(repo, ["init"]);
      await commit(repo, "docs.md", "docs", {
        name: "Ada",
        email: "ada@example.com",
        date: "2020-01-02",
      });
      await commit(repo, "src.txt", "src", {
        name: "Ada",
        email: "ada@example.com",
        date: "2020-03-04",
      });
      await commit(repo, "bot.txt", "bot", {
        name: "contributors-please-bot[bot]",
        email: "1+contributors-please-bot[bot]@users.noreply.github.com",
        date: "2020-05-06",
      });

      const contributions = await readGitContributions(repo, {
        ignoredEmails: [
          "1+contributors-please-bot[bot]@users.noreply.github.com",
        ],
      });

      expect(contributions).toEqual([
        {
          name: "Ada",
          email: "ada@example.com",
          commits: 2,
          first_seen: "2020-01-02",
          files: ["docs.md", "src.txt"],
        },
      ]);
    } finally {
      await rm(repo, { recursive: true, force: true });
    }
  });
});

