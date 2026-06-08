import { describe, expect, it } from "vitest";

import { VERSION } from "../src/lib";

// VERSION is a hardcoded constant in src/version.ts and is intentionally NOT
// listed in release-please-config.json `extra-files` (would break the
// `git diff --exit-code -- dist` invariant on every release PR). Assert
// semver shape rather than a literal so this test doesn't need a manual edit
// each release; tightening VERSION-to-package.json coupling is deferred to a
// follow-up PR (Option H — derive VERSION at build/runtime).
describe("public API", () => {
  it("exports a semver VERSION", () => {
    expect(VERSION).toMatch(/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/);
  });
});

