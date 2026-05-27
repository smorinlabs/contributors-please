import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";

describe("CI workflow", () => {
  it("does not require checking out the private action repository", async () => {
    const workflow = parse(
      await readFile(".github/workflows/ci.yml", "utf8")
    ) as {
      jobs: {
        check: {
          steps: Array<{
            run?: string;
            with?: {
              repository?: string;
            };
          }>;
        };
      };
    };

    const steps = workflow.jobs.check.steps;

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
