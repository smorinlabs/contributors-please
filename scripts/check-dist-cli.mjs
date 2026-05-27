import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const root = new URL("..", import.meta.url);
const workspace = await mkdtemp(join(tmpdir(), "contributors-dist-cli-"));

try {
  await writeFile(
    join(workspace, ".contributors.yml"),
    [
      "classifier: path",
      "output_file: CONTRIBUTORS.md",
      "state_file: .contributors.jsonl",
      'entry_template: "- {{login}} {{title}} {{commits}}"',
      "",
    ].join("\n")
  );
  await writeFile(
    join(workspace, ".contributors.jsonl"),
    `${JSON.stringify({
      login: "ada",
      name: "Ada",
      profile: "https://github.com/ada",
      avatar: "",
      source: "commit",
      pinned: false,
      categories: ["code"],
      title: "Code Contributor",
      commits: 1,
      first_seen: "2020-01-02",
      last_updated: "2026-05-27",
    })}\n`
  );

  await execFileAsync(
    process.execPath,
    [new URL("dist/cli.js", root).pathname, "render", "--config-file", ".contributors.yml"],
    { cwd: workspace }
  );

  const rendered = await readFile(join(workspace, "CONTRIBUTORS.md"), "utf8");
  if (rendered !== "- ada Code Contributor 1\n") {
    throw new Error(`Unexpected dist CLI render output: ${JSON.stringify(rendered)}`);
  }
} finally {
  await rm(workspace, { recursive: true, force: true });
}
