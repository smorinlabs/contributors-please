import { describe, expect, it } from "vitest";

import { normalizeConfig } from "../../src/engine/config";
import { render, parseTemplate } from "../../src/engine/render";
import type { Contributor } from "../../src/engine/state";

const record: Contributor = {
  login: "smorin",
  name: "Steve Morin",
  profile: "https://github.com/smorin",
  avatar: "https://avatars.githubusercontent.com/u/1",
  source: "commit",
  pinned: false,
  categories: ["code"],
  title: "Code Contributor",
  emoji: "code",
  commits: 7,
  first_seen: "2024-01-10",
  last_updated: "2026-05-26",
};

describe("parseTemplate", () => {
  it("substitutes contributor placeholders", () => {
    expect(parseTemplate("{{login}} {{name}} {{title}} {{commits}}", record)).toBe(
      "smorin Steve Morin Code Contributor 7"
    );
  });
});

describe("render", () => {
  it("renders bare contributor entries by default", () => {
    const result = render({
      records: [record],
      config: normalizeConfig({
        entry_template: "- {{name}}: {{title}}",
      }),
    });

    expect(result.content).toBe("- Steve Morin: Code Contributor\n");
    expect(result.count).toBe(1);
  });

  it("renders empty-text when there are no contributors", () => {
    const result = render({
      records: [],
      config: normalizeConfig({ empty_text: "No contributors yet." }),
    });

    expect(result.content).toBe("No contributors yet.\n");
    expect(result.count).toBe(0);
  });

  it("wraps rendered content with header and footer", () => {
    const result = render({
      records: [record],
      config: normalizeConfig({
        header: "# Contributors",
        footer: "Thanks.",
        entry_template: "- {{login}}",
      }),
    });

    expect(result.content).toBe("# Contributors\n\n- smorin\n\nThanks.\n");
  });

  it("inserts rendered content into a template placeholder", () => {
    const result = render({
      records: [record],
      config: normalizeConfig({
        template_file: ".github/contributors.template.md",
        template_placeholder: "<!-- CONTRIBUTORS -->",
        entry_template: "- {{login}}",
      }),
      templateContent: "Before\n<!-- CONTRIBUTORS -->\nAfter\n",
    });

    expect(result.content).toBe("Before\n- smorin\nAfter\n");
  });

  it("replaces only the in-place marker body", () => {
    const result = render({
      records: [record],
      config: normalizeConfig({
        in_place: true,
        output_file: "README.md",
        entry_template: "- {{login}}",
      }),
      existingContent:
        "Before\n<!-- contributors-please:start -->\nold\n<!-- contributors-please:end -->\nAfter\n",
    });

    expect(result.content).toBe(
      "Before\n<!-- contributors-please:start -->\n- smorin\n<!-- contributors-please:end -->\nAfter\n"
    );
  });

  it("fails in-place mode when a marker is missing", () => {
    expect(() =>
      render({
        records: [record],
        config: normalizeConfig({ in_place: true }),
        existingContent: "Before\nAfter\n",
      })
    ).toThrow("in-place output is missing marker");
  });
});

