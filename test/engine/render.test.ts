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
    expect(
      parseTemplate(
        "{{login}} {{name}} {{avatar}} {{profile}} {{title}} {{commits}} {{emoji}}",
        record
      )
    ).toBe(
      "smorin Steve Morin https://avatars.githubusercontent.com/u/1 https://github.com/smorin Code Contributor 7 code"
    );
  });

  it("leaves unknown placeholders unchanged", () => {
    expect(parseTemplate("{{login}} {{unknown}}", record)).toBe(
      "smorin {{unknown}}"
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

  it("groups entries by columns-per-row", () => {
    const ada = { ...record, login: "ada", name: "Ada", commits: 4 };
    const grace = { ...record, login: "grace", name: "Grace", commits: 3 };
    const result = render({
      records: [record, ada, grace],
      config: normalizeConfig({
        entry_template: "{{login}}",
        columns_per_row: 2,
      }),
    });

    expect(result.content).toBe("smorin ada\ngrace\n");
    expect(result.count).toBe(3);
  });

  it("renders empty-text when there are no contributors", () => {
    const result = render({
      records: [],
      config: normalizeConfig({ empty_text: "No contributors yet." }),
    });

    expect(result.content).toBe("No contributors yet.\n");
    expect(result.count).toBe(0);
  });

  it("renders empty output when there are no contributors and empty-text is unset", () => {
    const result = render({
      records: [],
      config: normalizeConfig({}),
    });

    expect(result.content).toBe("");
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

  it("wraps rendered content with header only", () => {
    const result = render({
      records: [record],
      config: normalizeConfig({
        header: "# Contributors",
        entry_template: "- {{login}}",
      }),
    });

    expect(result.content).toBe("# Contributors\n\n- smorin\n");
  });

  it("wraps rendered content with footer only", () => {
    const result = render({
      records: [record],
      config: normalizeConfig({
        footer: "Thanks.",
        entry_template: "- {{login}}",
      }),
    });

    expect(result.content).toBe("- smorin\n\nThanks.\n");
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

  it("inserts rendered content into a custom template placeholder", () => {
    const result = render({
      records: [record],
      config: normalizeConfig({
        template_file: ".github/contributors.template.md",
        template_placeholder: "[[contributors]]",
        entry_template: "- {{login}}",
      }),
      templateContent: "Before\n[[contributors]]\nAfter\n",
    });

    expect(result.content).toBe("Before\n- smorin\nAfter\n");
  });

  it("fails template mode when the placeholder is missing", () => {
    expect(() =>
      render({
        records: [record],
        config: normalizeConfig({
          template_file: ".github/contributors.template.md",
          entry_template: "- {{login}}",
        }),
        templateContent: "Before\nAfter\n",
      })
    ).toThrow("template-file must contain exactly one placeholder");
  });

  it("fails template mode when the placeholder is duplicated", () => {
    expect(() =>
      render({
        records: [record],
        config: normalizeConfig({
          template_file: ".github/contributors.template.md",
          entry_template: "- {{login}}",
        }),
        templateContent:
          "Before\n<!-- CONTRIBUTORS -->\nMiddle\n<!-- CONTRIBUTORS -->\nAfter\n",
      })
    ).toThrow("template-file must contain exactly one placeholder");
  });

  it("fails template mode when template content is not provided", () => {
    expect(() =>
      render({
        records: [record],
        config: normalizeConfig({
          template_file: ".github/contributors.template.md",
        }),
      })
    ).toThrow("template-file .github/contributors.template.md was not provided");
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

  it("replaces custom in-place markers", () => {
    const result = render({
      records: [record],
      config: normalizeConfig({
        in_place: true,
        in_place_marker_start: "<!-- cp:start -->",
        in_place_marker_end: "<!-- cp:end -->",
        output_file: "README.md",
        entry_template: "- {{login}}",
      }),
      existingContent: "Before\n<!-- cp:start -->\nold\n<!-- cp:end -->\nAfter\n",
    });

    expect(result.content).toBe(
      "Before\n<!-- cp:start -->\n- smorin\n<!-- cp:end -->\nAfter\n"
    );
  });

  it("fails in-place mode when existing content is not provided", () => {
    expect(() =>
      render({
        records: [record],
        config: normalizeConfig({ in_place: true }),
      })
    ).toThrow("in-place output content was not provided");
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

  it("fails in-place mode when a marker is duplicated", () => {
    expect(() =>
      render({
        records: [record],
        config: normalizeConfig({ in_place: true }),
        existingContent:
          "<!-- contributors-please:start -->\nold\n<!-- contributors-please:start -->\n<!-- contributors-please:end -->\n",
      })
    ).toThrow("in-place output is missing marker or has duplicates");
  });

  it("fails in-place mode when end marker appears before start marker", () => {
    expect(() =>
      render({
        records: [record],
        config: normalizeConfig({ in_place: true }),
        existingContent:
          "<!-- contributors-please:end -->\nold\n<!-- contributors-please:start -->\n",
      })
    ).toThrow("in-place output end marker appears before start marker");
  });
});

describe("columns-per-row hazard warning", () => {
  const ada = { ...record, login: "ada", name: "Ada", commits: 4 };

  it("emits no warnings for a list template at columns_per_row: 1 (the safe fix)", () => {
    const result = render({
      records: [record],
      config: normalizeConfig({ entry_template: "- {{login}}", columns_per_row: 1 }),
    });
    expect(result.warnings).toEqual([]);
  });

  it("warns when a pipe-delimited entry_template is grouped onto multi-column rows", () => {
    const result = render({
      records: [record, ada],
      config: normalizeConfig({
        entry_template: "{{login}} | {{title}} | {{commits}}",
        columns_per_row: 6,
      }),
    });
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toContain("columns_per_row");
    expect(result.warnings[0]).toContain("|");
  });

  it("does not warn when a delimited template uses columns_per_row: 1", () => {
    const result = render({
      records: [record, ada],
      config: normalizeConfig({
        entry_template: "{{login}} | {{title}} | {{commits}}",
        columns_per_row: 1,
      }),
    });
    expect(result.warnings).toEqual([]);
  });

  it("does not warn for a defaults-only config (columns_per_row defaults to 1)", () => {
    // The default markdown-list template paired with the default columns_per_row: 1
    // renders one entry per row — the correct, warning-free zero-config result.
    const result = render({
      records: [record, ada],
      config: normalizeConfig({}),
    });
    expect(result.warnings).toEqual([]);
  });

  it("warns for a leading-list-marker template at columns_per_row > 1", () => {
    const result = render({
      records: [record, ada],
      config: normalizeConfig({
        entry_template: "- {{login}}",
        columns_per_row: 2,
      }),
    });
    expect(result.warnings).toHaveLength(1);
  });

  it("does not warn for a bare-token grid template at columns_per_row > 1", () => {
    const result = render({
      records: [record, ada],
      config: normalizeConfig({
        entry_template: "{{login}}",
        columns_per_row: 2,
      }),
    });
    expect(result.warnings).toEqual([]);
  });
});
