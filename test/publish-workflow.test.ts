import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";

describe("publish workflow", () => {
  it("publishes the npm package from v tags after the release checks", async () => {
    const workflow = parse(
      await readFile(".github/workflows/publish.yml", "utf8")
    ) as {
      on: { push: { tags: string[] } };
      jobs: {
        publish: {
          steps: Array<{
            run?: string;
            with?: Record<string, string | number>;
            env?: Record<string, string>;
          }>;
        };
      };
    };

    expect(workflow.on.push.tags).toContain("v*.*.*");
    expect(workflow.on.push.tags).not.toContain("v*");

    const steps = workflow.jobs.publish.steps;
    const setupNode = steps.find(step => step.with?.["registry-url"]);
    expect(setupNode?.with).toMatchObject({
      "node-version": 24,
      "registry-url": "https://registry.npmjs.org",
    });

    const outputCheck = steps.findIndex(step =>
      step.run?.includes("check-action-outputs.mjs")
    );
    const versionCheck = steps.findIndex(
      step =>
        step.run?.includes("PACKAGE_VERSION") &&
        step.run.includes("GITHUB_REF_NAME")
    );
    const npmCi = steps.findIndex(step => step.run === "npm ci");
    const distDiff = steps.findIndex(step => step.run === "git diff --exit-code -- dist");
    const publish = steps.findIndex(step => step.run === "npm publish --access public");

    expect(versionCheck).toBeGreaterThanOrEqual(0);
    expect(npmCi).toBeGreaterThan(versionCheck);
    expect(outputCheck).toBeGreaterThanOrEqual(0);
    expect(distDiff).toBeGreaterThan(outputCheck);
    expect(publish).toBeGreaterThan(distDiff);
    expect(steps[publish]?.env).toMatchObject({
      NODE_AUTH_TOKEN: "${{ secrets.NPM_TOKEN }}",
    });
  });
});
