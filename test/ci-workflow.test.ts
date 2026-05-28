import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";

describe("CI workflow", () => {
  it("keeps core tests in contributors-please and does not require the action repository", async () => {
    const workflow = parse(
      await readFile(".github/workflows/ci.yml", "utf8")
    ) as {
      jobs: Record<
        string,
        {
          steps: Array<{
            run?: string;
            with?: {
              repository?: string;
            };
          }>;
        }
      >;
    };

    expect(Object.keys(workflow.jobs).sort()).toEqual([
      "classifier",
      "cli",
      "discovery-identity",
      "engine-idempotency",
      "github-client",
      "package-dist",
      "public-api",
      "rendering",
      "run-result-contract",
      "schema",
      "selection",
      "state",
    ]);

    const steps = Object.values(workflow.jobs).flatMap(job => job.steps);

    expect(steps).not.toContainEqual(
      expect.objectContaining({
        with: expect.objectContaining({
          repository: "smorinlabs/contributors-please-action",
        }),
      })
    );
    expect(steps.map(step => step.run)).not.toContain(
      "node scripts/check-action-outputs.mjs contributors-please-action"
    );
  });
});
