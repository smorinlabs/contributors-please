import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { checkPublicApiSnapshot } from "../scripts/check-public-api.mjs";

describe("checkPublicApiSnapshot", () => {
  it("accepts matching declaration snapshots", async () => {
    const dir = await mkdtemp(join(tmpdir(), "public-api-"));
    try {
      const actual = join(dir, "actual.d.ts");
      const expected = join(dir, "expected.d.ts");
      await writeFile(actual, 'export { VERSION } from "./version.js";\n');
      await writeFile(expected, 'export { VERSION } from "./version.js";\n');

      await expect(checkPublicApiSnapshot(actual, expected)).resolves.toBeUndefined();
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("rejects declaration snapshot drift", async () => {
    const dir = await mkdtemp(join(tmpdir(), "public-api-"));
    try {
      const actual = join(dir, "actual.d.ts");
      const expected = join(dir, "expected.d.ts");
      await writeFile(actual, 'export { VERSION } from "./version.js";\n');
      await writeFile(expected, 'export { Contributors } from "./engine/contributors.js";\n');

      await expect(checkPublicApiSnapshot(actual, expected)).rejects.toThrow(
        "Public API declaration drift detected. Update test/fixtures/public-api.d.ts only with an intentional semver decision."
      );
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
