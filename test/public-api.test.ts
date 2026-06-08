import { describe, expect, it } from "vitest";

import {
  Contributors,
  GitHubClient,
  PathClassifier,
  VERSION,
  mergeState,
  parseTemplate,
  readStateFile,
  render,
  writeStateFile,
} from "../src/lib";
import type {
  CheckResult,
  Contributor,
  ContributorsConfig,
  StateFile,
} from "../src/lib";

type PublicTypeSmoke = [
  CheckResult,
  Contributor,
  ContributorsConfig,
  StateFile,
];

const _publicTypeSmoke: PublicTypeSmoke | undefined = undefined;

describe("public API", () => {
  it("exports the documented runtime surface", () => {
    expect(_publicTypeSmoke).toBeUndefined();
    // VERSION is intentionally decoupled from package.json (see
    // test/version.test.ts); assert semver shape only.
    expect(VERSION).toMatch(/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/);
    expect(Contributors).toBeTypeOf("function");
    expect(GitHubClient).toBeTypeOf("function");
    expect(PathClassifier).toBeTypeOf("function");
    expect(readStateFile).toBeTypeOf("function");
    expect(writeStateFile).toBeTypeOf("function");
    expect(mergeState).toBeTypeOf("function");
    expect(render).toBeTypeOf("function");
    expect(parseTemplate).toBeTypeOf("function");
  });
});
