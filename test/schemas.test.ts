import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import Ajv2020 from "ajv/dist/2020";
import addFormats from "ajv-formats";

describe("schemas", () => {
  it("validates config files", async () => {
    const schema = JSON.parse(
      await readFile("schemas/config.schema.json", "utf8")
    );
    const ajv = new Ajv2020({ allErrors: true });
    const validate = ajv.compile(schema);

    expect(validate({ classifier: "path" })).toBe(true);
    expect(validate({ classifier: "reviews" })).toBe(false);
  });

  it("validates state-file records", async () => {
    const schema = JSON.parse(
      await readFile("schemas/state.schema.json", "utf8")
    );
    const ajv = new Ajv2020({ allErrors: true });
    addFormats(ajv);
    const validate = ajv.compile(schema);

    expect(
      validate({
        login: "ada",
        name: "Ada",
        profile: "https://github.com/ada",
        avatar: "https://avatars/ada",
        source: "commit",
        pinned: false,
        categories: ["code"],
        title: "Code Contributor",
        commits: 1,
        first_seen: "2020-01-02",
        last_updated: "2026-05-26",
      })
    ).toBe(true);
    expect(validate({ login: "ada" })).toBe(false);
  });

  it("permits hand-declared records to omit bootstrap fields that the engine fills", async () => {
    const schema = JSON.parse(
      await readFile("schemas/state.schema.json", "utf8")
    );
    const ajv = new Ajv2020({ allErrors: true });
    addFormats(ajv);
    const validate = ajv.compile(schema);

    expect(
      validate({
        login: "designer",
        name: "Designer",
        profile: "https://github.com/designer",
        avatar: "",
        source: "declared",
        pinned: true,
        categories: ["design"],
        title: "Design Lead",
        last_updated: "2026-05-26",
      })
    ).toBe(true);
    expect(
      validate({
        login: "ada",
        name: "Ada",
        profile: "https://github.com/ada",
        avatar: "https://avatars/ada",
        source: "commit",
        pinned: false,
        categories: ["code"],
        title: "Code Contributor",
        commits: 1,
        last_updated: "2026-05-26",
      })
    ).toBe(false);
  });
});
