import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

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

export async function isShallowRepository(repoPath: string): Promise<boolean> {
  const { stdout } = await git(repoPath, [
    "rev-parse",
    "--is-shallow-repository",
  ]);
  return stdout.trim() === "true";
}

export async function readGitContributions(
  repoPath: string,
  options: GitContributionOptions = {}
): Promise<GitContribution[]> {
  const { stdout } = await git(repoPath, [
    "log",
    "--no-merges",
    "--date=short",
    "--format=__CONTRIBUTORS_PLEASE__%aN%x00%aE%x00%ad",
    "--name-only",
  ]);

  return parseGitLog(stdout, options);
}

export function parseGitLog(
  log: string,
  options: GitContributionOptions = {}
): GitContribution[] {
  const ignoredEmails = new Set(options.ignoredEmails ?? []);
  const ignoredNames = new Set(options.ignoredNames ?? []);
  const byEmail = new Map<string, GitContribution>();
  let current:
    | {
        name: string;
        email: string;
        date: string;
        files: string[];
      }
    | undefined;

  const flush = () => {
    if (!current) {
      return;
    }
    if (ignoredEmails.has(current.email) || ignoredNames.has(current.name)) {
      current = undefined;
      return;
    }

    const existing = byEmail.get(current.email);
    if (existing) {
      existing.commits += 1;
      existing.first_seen =
        current.date < existing.first_seen ? current.date : existing.first_seen;
      existing.files = [...new Set([...existing.files, ...current.files])].sort();
    } else {
      byEmail.set(current.email, {
        name: current.name,
        email: current.email,
        commits: 1,
        first_seen: current.date,
        files: [...new Set(current.files)].sort(),
      });
    }
    current = undefined;
  };

  for (const line of log.split(/\r?\n/)) {
    if (line.startsWith("__CONTRIBUTORS_PLEASE__")) {
      flush();
      const [name, email, date] = line
        .slice("__CONTRIBUTORS_PLEASE__".length)
        .split("\0");
      current = { name, email, date, files: [] };
      continue;
    }

    const file = line.trim();
    if (current && file) {
      current.files.push(file);
    }
  }
  flush();

  return [...byEmail.values()].sort((left, right) =>
    left.email.localeCompare(right.email)
  );
}

async function git(repoPath: string, args: readonly string[]) {
  return execFileAsync("git", [...args], {
    cwd: repoPath,
    maxBuffer: 10 * 1024 * 1024,
  });
}

