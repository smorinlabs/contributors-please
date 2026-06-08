import { describe, expect, it } from "vitest";

import { normalizeConfig } from "../../src/engine/config";
import { joinIdentities, parseMailmap } from "../../src/engine/identity-join";
import type { GitContribution } from "../../src/engine/git";

const apiContributors = [
  {
    login: "ada",
    name: "Ada Lovelace",
    avatar: "https://avatars.githubusercontent.com/u/2",
    profile: "https://github.com/ada",
    commits: 10,
  },
  {
    login: "grace",
    name: "Grace Hopper",
    avatar: "https://avatars.githubusercontent.com/u/3",
    profile: "https://github.com/grace",
    commits: 5,
  },
];

function gitContribution(overrides: Partial<GitContribution>): GitContribution {
  return {
    name: "Ada",
    email: "ada@example.com",
    commits: 2,
    first_seen: "2020-01-02",
    files: ["src.ts"],
    ...overrides,
  };
}

describe("joinIdentities", () => {
  it("parses simple .mailmap canonical-to-old email entries", () => {
    expect(
      parseMailmap(
        "Ada Lovelace <123+ada@users.noreply.github.com> <ada@old.example.com>\n"
      )
    ).toEqual(
      new Map([["ada@old.example.com", "123+ada@users.noreply.github.com"]])
    );
  });

  it("joins GitHub no-reply emails to API contributors", () => {
    const result = joinIdentities({
      apiContributors,
      gitContributions: [
        gitContribution({
          email: "123+ada@users.noreply.github.com",
        }),
      ],
      config: normalizeConfig({}),
      serverUrl: "https://github.com",
    });

    expect(result.records[0]).toMatchObject({
      login: "ada",
      name: "Ada Lovelace",
      commits: 2,
      first_seen: "2020-01-02",
      files: ["src.ts"],
    });
    expect(result.unjoined).toEqual([]);
  });

  it("uses configured no_reply_domain before falling through", () => {
    const result = joinIdentities({
      apiContributors,
      gitContributions: [
        gitContribution({
          email: "grace@users.noreply.github.acme.corp",
        }),
      ],
      config: normalizeConfig({
        no_reply_domain: "users.noreply.github.acme.corp",
      }),
      serverUrl: "https://github.acme.corp",
    });

    expect(result.records[0].login).toBe("grace");
  });

  it("uses identity_map when no-reply parsing does not match", () => {
    const result = joinIdentities({
      apiContributors,
      gitContributions: [gitContribution({ email: "ada@old.example.com" })],
      config: normalizeConfig({
        identity_map: [
          {
            login: "ada",
            emails: ["ada@old.example.com"],
          },
        ],
      }),
      serverUrl: "https://github.com",
    });

    expect(result.records[0].login).toBe("ada");
  });

  it("uses .mailmap canonical no-reply email before identity_map", () => {
    const result = joinIdentities({
      apiContributors,
      gitContributions: [gitContribution({ email: "ada@old.example.com" })],
      mailmap: new Map([
        ["ada@old.example.com", "123+ada@users.noreply.github.com"],
      ]),
      config: normalizeConfig({}),
      serverUrl: "https://github.com",
    });

    expect(result.records[0].login).toBe("ada");
    expect(result.unjoined).toEqual([]);
  });

  it("coalesces multiple git identities that map to the same login", () => {
    const result = joinIdentities({
      apiContributors,
      gitContributions: [
        gitContribution({
          email: "ada@example.com",
          commits: 2,
          first_seen: "2020-02-02",
          files: ["docs.md"],
        }),
        gitContribution({
          email: "ada@old.example.com",
          commits: 3,
          first_seen: "2020-01-02",
          files: ["src.ts"],
        }),
      ],
      config: normalizeConfig({
        identity_map: [
          {
            login: "ada",
            emails: ["ada@example.com", "ada@old.example.com"],
          },
        ],
      }),
      serverUrl: "https://github.com",
    });

    expect(result.records).toHaveLength(1);
    expect(result.records[0]).toMatchObject({
      login: "ada",
      commits: 5,
      first_seen: "2020-01-02",
      files: ["docs.md", "src.ts"],
    });
  });

  it("reports unjoined authors", () => {
    const result = joinIdentities({
      apiContributors,
      gitContributions: [
        gitContribution({
          name: "Unknown",
          email: "unknown@example.com",
        }),
      ],
      config: normalizeConfig({}),
      serverUrl: "https://github.com",
    });

    expect(result.records).toEqual([]);
    expect(result.unjoined).toEqual([
      {
        name: "Unknown",
        email: "unknown@example.com",
      },
    ]);
  });
});

describe("parseMailmap", () => {
  it("returns an empty map for undefined or empty input", () => {
    expect(parseMailmap(undefined)).toEqual(new Map());
    expect(parseMailmap("")).toEqual(new Map());
  });

  it("skips comment lines and blank lines", () => {
    const text = [
      "# this is a header comment",
      "",
      "Ada Lovelace <123+ada@users.noreply.github.com> <ada@old.example.com>",
      "   ",
      "  # leading-whitespace comment",
      "Grace Hopper <456+grace@users.noreply.github.com> <grace@old.example.com>",
    ].join("\n");

    expect(parseMailmap(text)).toEqual(
      new Map([
        ["ada@old.example.com", "123+ada@users.noreply.github.com"],
        ["grace@old.example.com", "456+grace@users.noreply.github.com"],
      ])
    );
  });

  it("silently skips lines with fewer than two emails", () => {
    // git mailmap supports `Name <email>` (name-only override) entries that
    // carry only a single email. This tool only maps email-to-email, so such
    // lines must be ignored rather than crashing or producing a partial entry.
    const text = [
      "Ada Lovelace <ada@example.com>",
      "Grace Hopper <456+grace@users.noreply.github.com> <grace@old.example.com>",
      "Just a stray line with no angle brackets",
    ].join("\n");

    expect(parseMailmap(text)).toEqual(
      new Map([["grace@old.example.com", "456+grace@users.noreply.github.com"]])
    );
  });

  it("handles CRLF line endings", () => {
    const text =
      "Ada Lovelace <123+ada@users.noreply.github.com> <ada@old.example.com>\r\n" +
      "Grace Hopper <456+grace@users.noreply.github.com> <grace@old.example.com>\r\n";

    expect(parseMailmap(text)).toEqual(
      new Map([
        ["ada@old.example.com", "123+ada@users.noreply.github.com"],
        ["grace@old.example.com", "456+grace@users.noreply.github.com"],
      ])
    );
  });
});
