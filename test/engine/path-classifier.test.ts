import { describe, expect, it } from "vitest";

import { normalizeConfig } from "../../src/engine/config";
import { PathClassifier } from "../../src/engine/classifiers/path";

const classifier = new PathClassifier();

function classify(files: string[], rawConfig: Record<string, unknown> = {}) {
  return classifier.classify(
    {
      login: "smorin",
      commits: 3,
      files,
    },
    {
      config: normalizeConfig(rawConfig),
    }
  );
}

describe("PathClassifier", () => {
  it("uses the default ruleset when no classification config is present", () => {
    expect(classify(["docs/guide.md"]).title).toBe("Documentation Super Star");
    expect(classify(["tests/test_cli.py"]).title).toBe("Quality Contributor");
    expect(classify(["src/index.ts"]).title).toBe("Code Contributor");
  });

  it("uses declaration order as per-file precedence", () => {
    const result = classify(["docs/api.md"], {
      classification: {
        categories: [
          { id: "markdown", label: "Markdown", paths: ["**/*.md"] },
          { id: "docs", label: "Docs", paths: ["docs/**"] },
        ],
        default: { id: "code", label: "Code" },
      },
    });

    expect(result.categories).toEqual(["markdown"]);
    expect(result.title).toBe("Markdown");
  });

  it("uses the first firing combination rule", () => {
    const result = classify(["src/index.ts", "tests/test_cli.py", "docs/guide.md"]);

    expect(result.categories).toEqual(["code", "docs", "quality"]);
    expect(result.title).toBe("Rockstar");
    expect(result.emoji).toBe("star");
  });

  it("resolves multiple categories by priority by default", () => {
    const result = classify(["docs/guide.md", "tests/test_cli.py"]);

    expect(result.categories).toEqual(["docs", "quality"]);
    expect(result.title).toBe("Documentation Super Star");
  });

  it("can combine multiple category titles", () => {
    const result = classify(["docs/guide.md", "tests/test_cli.py"], {
      classification: {
        categories: [
          { id: "docs", label: "Docs", paths: ["docs/**"] },
          { id: "quality", label: "Quality", paths: ["tests/**"] },
        ],
        default: { id: "code", label: "Code" },
        combinations: [],
        multi_category_resolution: "combine",
      },
    });

    expect(result.categories).toEqual(["docs", "quality"]);
    expect(result.title).toBe("Docs / Quality");
  });
});

