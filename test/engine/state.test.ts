import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  mergeState,
  readStateFile,
  serializeState,
  writeStateFile,
  type Contributor,
} from "../../src/engine/state";

const TODAY = "2026-05-26";

function contributor(overrides: Partial<Contributor> = {}): Contributor {
  return {
    login: "smorin",
    name: "Steve Morin",
    profile: "https://github.com/smorin",
    avatar: "https://avatars.githubusercontent.com/u/1",
    source: "commit",
    pinned: false,
    categories: ["code"],
    title: "Code Contributor",
    emoji: "code",
    commits: 2,
    first_seen: "2024-01-10",
    last_updated: "2024-01-10",
    ...overrides,
  };
}

describe("state file I/O", () => {
  it("writes compact JSONL and reads it back", async () => {
    const dir = await mkdtemp(join(tmpdir(), "contributors-state-"));
    const file = join(dir, ".contributors.jsonl");
    const records = [
      contributor(),
      contributor({ login: "other", name: "Other", commits: 1 }),
    ];

    try {
      await writeStateFile(file, records);

      const text = await readFile(file, "utf8");
      expect(text).toBe(`${records.map(record => JSON.stringify(record)).join("\n")}\n`);
      await expect(readStateFile(file)).resolves.toEqual(records);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("serializes an empty state file as an empty string", () => {
    expect(serializeState([])).toBe("");
  });

  it("rejects invalid state records with a line-specific validation error", async () => {
    const dir = await mkdtemp(join(tmpdir(), "contributors-state-"));
    const file = join(dir, ".contributors.jsonl");
    try {
      await writeFile(
        file,
        `${JSON.stringify(contributor())}\n${JSON.stringify({
          ...contributor({ login: "bad" }),
          commits: "many",
        })}\n`
      );

      await expect(readStateFile(file)).rejects.toThrow(
        "Invalid state file line 2: /commits must be integer"
      );
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("defaults omitted commits for hand-declared records while preserving first_seen auto-fill", async () => {
    const dir = await mkdtemp(join(tmpdir(), "contributors-state-"));
    const file = join(dir, ".contributors.jsonl");
    try {
      const declared = contributor({
        login: "designer",
        source: "declared",
        pinned: true,
        title: "Design Lead",
      });
      delete (declared as Partial<Contributor>).commits;
      delete (declared as Partial<Contributor>).first_seen;
      await writeFile(file, `${JSON.stringify(declared)}\n`);

      const [record] = await readStateFile(file);

      expect(record).toMatchObject({
        login: "designer",
        source: "declared",
        commits: 0,
      });
      expect(record.first_seen).toBeUndefined();
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});

describe("mergeState", () => {
  it("adds new commit records with pinned false and historical first_seen", () => {
    const records = mergeState(
      [],
      [contributor({ login: "new", first_seen: "2021-02-03" })],
      { today: TODAY }
    );

    expect(records[0]).toMatchObject({
      login: "new",
      source: "commit",
      pinned: false,
      first_seen: "2021-02-03",
      last_updated: TODAY,
    });
  });

  it("keeps records that are not discovered in the current run", () => {
    const existing = contributor({ login: "existing" });

    expect(mergeState([existing], [], { today: TODAY })).toEqual([existing]);
  });

  it("preserves source, pinned, and first_seen on existing records", () => {
    const existing = contributor({
      source: "declared",
      pinned: true,
      first_seen: "2020-01-01",
      title: "Design Lead",
      categories: ["design"],
    });
    const discovered = contributor({
      source: "commit",
      pinned: false,
      first_seen: "2024-04-04",
      title: "Rockstar",
      categories: ["code", "docs"],
      commits: 8,
    });

    const [record] = mergeState([existing], [discovered], { today: TODAY });

    expect(record).toMatchObject({
      source: "declared",
      pinned: true,
      first_seen: "2020-01-01",
      title: "Design Lead",
      categories: ["design"],
      commits: 8,
      last_updated: TODAY,
    });
  });

  it("updates classifier fields for unpinned records", () => {
    const [record] = mergeState(
      [contributor({ title: "Code Contributor", categories: ["code"] })],
      [
        contributor({
          title: "Rockstar",
          categories: ["code", "docs", "quality"],
          commits: 3,
        }),
      ],
      { today: TODAY }
    );

    expect(record.title).toBe("Rockstar");
    expect(record.categories).toEqual(["code", "docs", "quality"]);
    expect(record.last_updated).toBe(TODAY);
  });

  it("does not touch last_updated when a run is idempotent", () => {
    const existing = contributor({ last_updated: "2024-01-10" });

    const [record] = mergeState([existing], [existing], { today: TODAY });

    expect(record).toEqual(existing);
  });

  it("auto-fills first_seen for new declared records only when omitted", () => {
    const [record] = mergeState(
      [],
      [
        {
          ...contributor({ source: "declared", pinned: true }),
          first_seen: undefined,
        },
      ],
      { today: TODAY }
    );

    expect(record.first_seen).toBe(TODAY);
    expect(record.pinned).toBe(true);
  });

  it("auto-fills first_seen for existing declared records appended by hand", () => {
    const existing = {
      ...contributor({
        login: "designer",
        source: "declared",
        pinned: true,
        title: "Design Lead",
        last_updated: "2024-01-10",
      }),
      first_seen: undefined,
    } as unknown as Contributor;

    const [record] = mergeState([existing], [], { today: TODAY });

    expect(record).toMatchObject({
      login: "designer",
      source: "declared",
      first_seen: TODAY,
      last_updated: TODAY,
    });
  });
});
