import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

interface PackageJson {
  name: string;
  version: string;
  private?: boolean;
  publishConfig?: {
    access?: string;
  };
  repository?: {
    type?: string;
    url?: string;
  };
  main: string;
  types: string;
  bin: Record<string, string>;
  files: string[];
  scripts: Record<string, string>;
}

describe("package metadata", () => {
  it("is configured for public npm publishing", async () => {
    const pkg = JSON.parse(
      await readFile("package.json", "utf8")
    ) as PackageJson;

    expect(pkg.name).toBe("contributors-please");
    expect(pkg.version).toBe("1.0.1");
    expect(pkg.private).not.toBe(true);
    expect(pkg.publishConfig).toMatchObject({ access: "public" });
    expect(pkg.repository).toMatchObject({
      type: "git",
      url: "git+https://github.com/smorinlabs/contributors-please.git",
    });
    expect(pkg.main).toBe("./dist/lib.js");
    expect(pkg.types).toBe("./dist/lib.d.ts");
    expect(pkg.bin).toEqual({ "contributors-please": "dist/cli.js" });
    expect(pkg.files).toEqual(
      expect.arrayContaining(["dist", "schemas", "README.md", "LICENSE"])
    );
  });

  it("keeps generated files in the local check gate", async () => {
    const pkg = JSON.parse(
      await readFile("package.json", "utf8")
    ) as PackageJson;

    expect(pkg.scripts.check).toContain("npm run schema:codegen");
    expect(pkg.scripts.check).toContain("git diff --exit-code -- src/types");
    expect(pkg.scripts.check).toContain("npm run check:action-outputs");
    expect(pkg.scripts.check).toContain("git diff --exit-code -- dist");
  });
});
