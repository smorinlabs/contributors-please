import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { checkActionOutputs } from "../scripts/check-action-outputs.mjs";

describe("checkActionOutputs", () => {
  it("accepts action outputs that match core.setOutput calls", async () => {
    const repo = await fixture({
      actionYml: [
        "name: fixture",
        "outputs:",
        "  changed:",
        "    description: changed flag",
        "  commit-sha:",
        "    description: commit SHA",
        "",
      ].join("\n"),
      source: [
        'core.setOutput("changed", String(result.changed));',
        'core.setOutput("commit-sha", result.commitSha ?? "");',
        "",
      ].join("\n"),
    });
    try {
      await expect(checkActionOutputs(repo)).resolves.toEqual({
        declared: ["changed", "commit-sha"],
        emitted: ["changed", "commit-sha"],
      });
    } finally {
      await rm(repo, { recursive: true, force: true });
    }
  });

  it("rejects missing and stale action outputs", async () => {
    const repo = await fixture({
      actionYml: [
        "name: fixture",
        "outputs:",
        "  changed:",
        "    description: changed flag",
        "  stale-output:",
        "    description: stale",
        "",
      ].join("\n"),
      source: [
        'core.setOutput("changed", String(result.changed));',
        'core.setOutput("commit-sha", result.commitSha ?? "");',
        "",
      ].join("\n"),
    });
    try {
      await expect(checkActionOutputs(repo)).rejects.toThrow(
        "action.yml outputs do not match core.setOutput calls. Missing declarations: commit-sha. Stale declarations: stale-output."
      );
    } finally {
      await rm(repo, { recursive: true, force: true });
    }
  });
});

async function fixture({
  actionYml,
  source,
}: {
  actionYml: string;
  source: string;
}): Promise<string> {
  const repo = await mkdtemp(join(tmpdir(), "action-outputs-"));
  await mkdir(join(repo, "src"), { recursive: true });
  await writeFile(join(repo, "action.yml"), actionYml, "utf8");
  await writeFile(join(repo, "src", "index.ts"), source, "utf8");
  return repo;
}
