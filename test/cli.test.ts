import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";

import { isCliEntrypoint, runCli } from "../src/cli";

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

describe("runCli", () => {
  it("detects npm bin symlinks as CLI entrypoints", () => {
    expect(
      isCliEntrypoint(
        "file:///private/tmp/install/lib/node_modules/pkg/dist/cli.js",
        "/private/tmp/install/bin/contributors-please",
        path =>
          path === "/private/tmp/install/bin/contributors-please"
            ? "/private/tmp/install/lib/node_modules/pkg/dist/cli.js"
            : path
      )
    ).toBe(true);
  });

  it("prints the package version", async () => {
    const output: string[] = [];

    const code = await runCli(["--version"], {
      stdout: line => output.push(line),
    });

    expect(code).toBe(0);
    expect(output).toEqual(["1.0.0"]);
  });

  it("validates a config file", async () => {
    const dir = await mkdtemp(join(tmpdir(), "contributors-cli-"));
    try {
      await writeFile(join(dir, ".contributors.yml"), "classifier: path\n");
      const output: string[] = [];

      const code = await runCli(["validate"], {
        cwd: dir,
        stdout: line => output.push(line),
      });

      expect(code).toBe(0);
      expect(output).toEqual(["contributors-please config is valid"]);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("returns a non-zero status for invalid config", async () => {
    const dir = await mkdtemp(join(tmpdir(), "contributors-cli-"));
    try {
      await writeFile(join(dir, ".contributors.yml"), "classifier: reviews\n");
      const errors: string[] = [];

      const code = await runCli(["validate"], {
        cwd: dir,
        stderr: line => errors.push(line),
      });

      expect(code).toBe(1);
      expect(errors[0]).toContain('Unsupported classifier "reviews"');
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("renders CONTRIBUTORS.md from an existing state file", async () => {
    const dir = await mkdtemp(join(tmpdir(), "contributors-cli-"));
    try {
      await writeFile(
        join(dir, ".contributors.yml"),
        [
          "output_file: CONTRIBUTORS.md",
          "entry_template: '- {{login}} {{title}} {{commits}}'",
          "columns_per_row: 1",
          "ignore:",
          "  - ignored-human",
        ].join("\n")
      );
      const records = [
        {
          login: "ada",
          name: "Ada",
          profile: "https://github.com/ada",
          avatar: "https://avatars/ada",
          source: "commit",
          pinned: false,
          categories: ["code"],
          title: "Code Contributor",
          commits: 3,
          first_seen: "2020-01-02",
          last_updated: "2026-05-26",
        },
        {
          login: "ignored-human",
          name: "Ignored",
          profile: "https://github.com/ignored-human",
          avatar: "",
          source: "commit",
          pinned: false,
          categories: ["docs"],
          title: "Documentation Contributor",
          commits: 5,
          first_seen: "2020-01-03",
          last_updated: "2026-05-26",
        },
        {
          login: "dependabot[bot]",
          name: "dependabot[bot]",
          profile: "https://github.com/apps/dependabot",
          avatar: "",
          source: "commit",
          pinned: false,
          categories: ["code"],
          title: "Code Contributor",
          commits: 7,
          first_seen: "2020-01-04",
          last_updated: "2026-05-26",
        },
        {
          login: "low-count",
          name: "Low Count",
          profile: "https://github.com/low-count",
          avatar: "",
          source: "commit",
          pinned: false,
          categories: ["code"],
          title: "Code Contributor",
          commits: 0,
          first_seen: "2020-01-05",
          last_updated: "2026-05-26",
        },
      ];
      await writeFile(
        join(dir, ".contributors.jsonl"),
        `${records.map(record => JSON.stringify(record)).join("\n")}\n`
      );
      const output: string[] = [];

      const code = await runCli(["render"], {
        cwd: dir,
        stdout: line => output.push(line),
      });

      expect(code).toBe(0);
      await expect(readFile(join(dir, "CONTRIBUTORS.md"), "utf8")).resolves.toBe(
        "- ada Code Contributor 3\n"
      );
      expect(output).toEqual(["contributors-please rendered 1 contributor"]);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("bootstraps state and output files in non-interactive init mode", async () => {
    const dir = await mkdtemp(join(tmpdir(), "contributors-cli-"));
    try {
      await git(dir, ["init"]);
      await commit(dir);
      const output: string[] = [];

      const code = await runCli(
        [
          "init",
          "--non-interactive",
          "--owner",
          "smorinlabs",
          "--repo",
          "example",
          "--output-file",
          "CONTRIBUTORS.md",
        ],
        {
          cwd: dir,
          stdout: line => output.push(line),
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
        }
      );

      expect(code).toBe(0);
      await expect(readFile(join(dir, ".contributors.jsonl"), "utf8")).resolves.toContain(
        '"first_seen":"2020-01-02"'
      );
      await expect(readFile(join(dir, "CONTRIBUTORS.md"), "utf8")).resolves.toContain(
        "ada"
      );
      expect(output).toEqual(["contributors-please initialized 1 contributor"]);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("bootstraps interactively with title pinning and declared contributors", async () => {
    const dir = await mkdtemp(join(tmpdir(), "contributors-cli-"));
    try {
      await git(dir, ["init"]);
      await commit(dir);
      const output: string[] = [];
      const questions: string[] = [];
      const answers = [
        "y",
        "Project Lead",
        "y",
        "designer",
        "Design Partner",
        "https://example.com/designer",
        "Design Lead",
        "n",
      ];

      const code = await runCli(
        [
          "init",
          "--owner",
          "smorinlabs",
          "--repo",
          "example",
          "--output-file",
          "CONTRIBUTORS.md",
        ],
        {
          cwd: dir,
          stdout: line => output.push(line),
          prompt: question => {
            questions.push(question);
            return answers.shift() ?? "n";
          },
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
        }
      );

      expect(code).toBe(0);
      expect(questions).toEqual([
        "Pin title for ada? [y/N] ",
        "Title for ada [Code Contributor]: ",
        "Add declared contributor? [y/N] ",
        "Declared login: ",
        "Declared name [designer]: ",
        "Declared profile [https://github.com/designer]: ",
        "Declared title: ",
        "Add another declared contributor? [y/N] ",
      ]);
      const state = await readFile(join(dir, ".contributors.jsonl"), "utf8");
      expect(state).toContain('"login":"ada"');
      expect(state).toContain('"title":"Project Lead"');
      expect(state).toContain('"pinned":true');
      expect(state).toContain('"login":"designer"');
      expect(state).toContain('"source":"declared"');
      await expect(readFile(join(dir, "CONTRIBUTORS.md"), "utf8")).resolves.toContain(
        "Design Partner"
      );
      expect(output).toEqual(["contributors-please initialized 2 contributors"]);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
