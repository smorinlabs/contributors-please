import { describe, expect, it } from "vitest";

import { normalizeConfig } from "../../src/engine/config";

describe("normalizeConfig", () => {
  it("uses the default path classifier and default output files for an empty config", () => {
    const config = normalizeConfig({});

    expect(config.classifier).toBe("path");
    expect(config.outputFile).toBe("contributors.md");
    expect(config.stateFile).toBe(".contributors.jsonl");
    expect(config.configFile).toBe(".contributors.yml");
  });

  it("accepts flat classifier configuration", () => {
    const config = normalizeConfig({
      classifier: "path",
      classification: {
        categories: [
          {
            id: "docs",
            label: "Docs",
            paths: ["docs/**"],
          },
        ],
        default: {
          id: "code",
          label: "Code",
        },
        combinations: [],
        multi_category_resolution: "combine",
      },
    });

    expect(config.classification.categories).toHaveLength(1);
    expect(config.classification.default.id).toBe("code");
    expect(config.classification.multiCategoryResolution).toBe("combine");
  });

  it("accepts packages root form as the same single-root configuration", () => {
    const config = normalizeConfig({
      packages: {
        ".": {
          classifier: "path",
          output_file: "CONTRIBUTORS.md",
        },
      },
    });

    expect(config.classifier).toBe("path");
    expect(config.outputFile).toBe("CONTRIBUTORS.md");
  });

  it("rejects non-root packages in v1", () => {
    expect(() =>
      normalizeConfig({
        packages: {
          ".": {},
          "packages/api": {},
        },
      })
    ).toThrow(
      'Per-package configuration (packages."packages/api") is reserved for v2'
    );
  });

  it("rejects classifiers other than path in v1", () => {
    expect(() => normalizeConfig({ classifier: "reviews" })).toThrow(
      'Unsupported classifier "reviews"; valid values for v1: path'
    );
  });

  it("rejects mutually exclusive wrapper modes", () => {
    expect(() =>
      normalizeConfig({
        template_file: ".github/contributors.md",
        header: "# Contributors",
      })
    ).toThrow(
      "Choose at most one contributors wrapper mode: template-file, header/footer, or in-place"
    );
  });
});

