#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
import { realpathSync } from "node:fs";
import { join } from "node:path";
import { stdin as input, stdout as output } from "node:process";
import { createInterface } from "node:readline/promises";
import { fileURLToPath } from "node:url";
import { parse as parseYaml } from "yaml";

import { Contributors } from "./engine/contributors.js";
import { GitHubClient } from "./engine/github.js";
import { type ContributorsConfig, normalizeConfig } from "./engine/config.js";
import { render } from "./engine/render.js";
import {
  readStateFile,
  serializeState,
  type Contributor,
} from "./engine/state.js";
import { VERSION } from "./version.js";

type Prompt = (question: string) => Promise<string> | string;

export interface CliIo {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  fetch?: typeof fetch;
  stdout?: (line: string) => void;
  stderr?: (line: string) => void;
  prompt?: Prompt;
}

export async function runCli(argv: readonly string[], io: CliIo = {}): Promise<number> {
  const stdout = io.stdout ?? (line => console.log(line));
  const stderr = io.stderr ?? (line => console.error(line));
  const cwd = io.cwd ?? process.cwd();
  const env = io.env ?? process.env;

  try {
    if (argv.includes("--version") || argv.includes("-v")) {
      stdout(VERSION);
      return 0;
    }

    const command = argv[0];
    if (command === "validate") {
      const configFile = valueAfter(argv, "--config-file") ?? ".contributors.yml";
      const raw = parseYaml(await readFile(join(cwd, configFile), "utf8"));
      normalizeConfig(raw ?? {});
      stdout("contributors-please config is valid");
      return 0;
    }

    if (command === "render") {
      const configFile = valueAfter(argv, "--config-file") ?? ".contributors.yml";
      const raw = parseYaml(await readFile(join(cwd, configFile), "utf8"));
      const config = normalizeConfig({ ...(raw ?? {}), config_file: configFile });
      const records = await readStateFile(join(cwd, config.stateFile));
      const result = render({
        records: selectRenderedRecords(records, config),
        config,
        templateContent: config.templateFile
          ? await readFile(join(cwd, config.templateFile), "utf8")
          : undefined,
        existingContent: config.inPlace
          ? await readFile(join(cwd, config.outputFile), "utf8")
          : undefined,
      });
      await writeFile(join(cwd, config.outputFile), result.content);
      stdout(
        `contributors-please rendered ${result.count} contributor${
          result.count === 1 ? "" : "s"
        }`
      );
      return 0;
    }

    if (command === "init") {
      const nonInteractive = argv.includes("--non-interactive");
      const [envOwner, envRepo] = (env.GITHUB_REPOSITORY ?? "").split("/");
      const owner = valueAfter(argv, "--owner") ?? envOwner;
      const repo = valueAfter(argv, "--repo") ?? envRepo;
      if (!owner || !repo) {
        throw new Error("Provide --owner and --repo, or set GITHUB_REPOSITORY.");
      }
      const configFile = valueAfter(argv, "--config-file") ?? ".contributors.yml";
      const raw = (await fileExists(join(cwd, configFile)))
        ? parseYaml(await readFile(join(cwd, configFile), "utf8")) ?? {}
        : {};
      const config = {
        ...raw,
        output_file: valueAfter(argv, "--output-file") ?? raw.output_file,
        state_file: valueAfter(argv, "--state-file") ?? raw.state_file,
        config_file: configFile,
      };
      const github = await GitHubClient.create({
        owner,
        repo,
        token: valueAfter(argv, "--token") ?? env.GITHUB_TOKEN,
        serverUrl: valueAfter(argv, "--github-server-url") ?? "https://github.com",
        fetch: io.fetch,
      });
      const contributors = await Contributors.fromConfig(github, config, {
        repoPath: cwd,
        bootstrap: true,
      });
      const result = await contributors.run();
      const normalized = normalizeConfig(config);
      let reviewedRecords = result.contributorsJson;
      if (!nonInteractive) {
        const prompter = openInteractivePrompt(io.prompt);
        try {
          reviewedRecords = await promptForContributorReview(
            result.contributorsJson,
            prompter.prompt
          );
        } finally {
          prompter.close();
        }
      }
      const rendered = await renderRecords(cwd, normalized, reviewedRecords);
      await writeFile(join(cwd, normalized.stateFile), serializeState(reviewedRecords));
      await writeFile(join(cwd, normalized.outputFile), rendered.content);
      stdout(
        `contributors-please initialized ${rendered.count} contributor${
          rendered.count === 1 ? "" : "s"
        }`
      );
      return 0;
    }

    stderr(
      "Usage: contributors-please --version | contributors-please validate [--config-file .contributors.yml] | contributors-please render [--config-file .contributors.yml]"
    );
    return 1;
  } catch (error) {
    stderr(error instanceof Error ? error.message : String(error));
    return 1;
  }
}

async function promptForContributorReview(
  records: readonly Contributor[],
  prompt: Prompt
): Promise<Contributor[]> {
  const reviewed = records.map(cloneContributor);
  for (const record of reviewed) {
    if (yes(await prompt(`Pin title for ${record.login}? [y/N] `))) {
      const title = (
        await prompt(`Title for ${record.login} [${record.title}]: `)
      ).trim();
      record.pinned = true;
      record.title = title || record.title;
    }
  }

  let addAnother = yes(await prompt("Add declared contributor? [y/N] "));
  while (addAnother) {
    const login = (await prompt("Declared login: ")).trim();
    if (!login) {
      throw new Error("Declared login is required.");
    }
    const name =
      (await prompt(`Declared name [${login}]: `)).trim() || login;
    const defaultProfile = `https://github.com/${login}`;
    const profile =
      (await prompt(`Declared profile [${defaultProfile}]: `)).trim() ||
      defaultProfile;
    const title = (await prompt("Declared title: ")).trim();
    if (!title) {
      throw new Error("Declared title is required.");
    }
    const today = isoToday();
    reviewed.push({
      login,
      name,
      profile,
      avatar: "",
      source: "declared",
      pinned: true,
      categories: [],
      title,
      commits: 0,
      first_seen: today,
      last_updated: today,
    });
    addAnother = yes(await prompt("Add another declared contributor? [y/N] "));
  }

  return reviewed.sort((left, right) => left.login.localeCompare(right.login));
}

function openInteractivePrompt(injected: Prompt | undefined): {
  prompt: Prompt;
  close: () => void;
} {
  if (injected) {
    return { prompt: injected, close: () => undefined };
  }
  const rl = createInterface({ input, output });
  return {
    prompt: question => rl.question(question),
    close: () => rl.close(),
  };
}

async function renderRecords(
  cwd: string,
  config: ContributorsConfig,
  records: readonly Contributor[]
) {
  return render({
    records: selectRenderedRecords(records, config),
    config,
    templateContent: config.templateFile
      ? await readFile(join(cwd, config.templateFile), "utf8")
      : undefined,
    existingContent: config.inPlace
      ? await readFile(join(cwd, config.outputFile), "utf8")
      : undefined,
  });
}

function selectRenderedRecords(
  records: readonly Contributor[],
  config: ContributorsConfig
): Contributor[] {
  const ignored = new Set(config.ignore);
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

function yes(answer: string): boolean {
  return answer.trim().toLowerCase().startsWith("y");
}

function cloneContributor(record: Contributor): Contributor {
  return {
    ...record,
    categories: [...record.categories],
  };
}

function isoToday(): string {
  return new Date().toISOString().slice(0, 10);
}

function valueAfter(argv: readonly string[], flag: string): string | undefined {
  const index = argv.indexOf(flag);
  if (index < 0) {
    return undefined;
  }
  return argv[index + 1];
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await readFile(path, "utf8");
    return true;
  } catch {
    return false;
  }
}

export function isCliEntrypoint(
  importMetaUrl: string,
  argv1: string | undefined,
  realpath: (path: string) => string = realpathSync
): boolean {
  if (!argv1) {
    return false;
  }

  try {
    return realpath(fileURLToPath(importMetaUrl)) === realpath(argv1);
  } catch {
    return fileURLToPath(importMetaUrl) === argv1;
  }
}

if (isCliEntrypoint(import.meta.url, process.argv[1])) {
  runCli(process.argv.slice(2)).then(code => {
    process.exitCode = code;
  });
}
