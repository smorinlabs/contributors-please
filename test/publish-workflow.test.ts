import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";

describe("publish workflow", () => {
  it("publishes the npm package from v tags after the release checks", async () => {
    const workflow = parse(
      await readFile(".github/workflows/publish.yml", "utf8")
    ) as {
      on: { push: { tags: string[] } };
      permissions: Record<string, string>;
      jobs: {
        publish: {
          environment?: string;
          steps: Array<{
            uses?: string;
            run?: string;
            with?: Record<string, string | number>;
            env?: Record<string, string>;
          }>;
        };
      };
    };

    expect(workflow.on.push.tags).toContain("v*.*.*");
    expect(workflow.on.push.tags).not.toContain("v*");
    expect(workflow.permissions).toMatchObject({
      contents: "read",
      "id-token": "write",
    });
    expect(workflow.jobs.publish.environment).toBe("npm");

    const steps = workflow.jobs.publish.steps;
    const actionCheckoutStep = steps.find(
      step =>
        step.uses === "actions/checkout@v6" &&
        step.with?.repository === "smorinlabs/contributors-please-action"
    );
    const setupNode = steps.find(step => step.with?.["registry-url"]);
    expect(actionCheckoutStep?.with).toMatchObject({
      path: "contributors-please-action",
      ref: "${{ vars.CONTRIBUTORS_PLEASE_ACTION_REF || 'main' }}",
      token: "${{ secrets.CONTRIBUTORS_PLEASE_ACTION_TOKEN || github.token }}",
    });
    expect(setupNode?.with).toMatchObject({
      "node-version": 24,
      "registry-url": "https://registry.npmjs.org",
      "package-manager-cache": false,
    });
    expect(setupNode?.with).not.toHaveProperty("cache");

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
    const publish = steps.findIndex(step => step.run === "npm publish");

    expect(versionCheck).toBeGreaterThanOrEqual(0);
    expect(npmCi).toBeGreaterThan(versionCheck);
    expect(outputCheck).toBeGreaterThanOrEqual(0);
    expect(distDiff).toBeGreaterThan(outputCheck);
    expect(publish).toBeGreaterThan(distDiff);
    expect(steps[publish]?.env).toBeUndefined();
  });

  it("notifies the action repo loudly after publishing, without swallowing failures", async () => {
    const workflow = parse(
      await readFile(".github/workflows/publish.yml", "utf8")
    ) as {
      jobs: {
        publish: {
          steps: Array<{
            run?: string;
            env?: Record<string, string>;
            ["continue-on-error"]?: boolean;
          }>;
        };
      };
    };

    const steps = workflow.jobs.publish.steps;
    const publish = steps.findIndex(step => step.run === "npm publish");
    const notify = steps.findIndex(step =>
      step.run?.includes("notify-release.mjs")
    );

    expect(notify).toBeGreaterThan(publish);
    // A failed notification must surface, not be masked as a green step.
    expect(steps[notify]?.["continue-on-error"]).toBeUndefined();
    expect(steps[notify]?.env).toMatchObject({
      GH_TOKEN: "${{ secrets.CONTRIBUTORS_PLEASE_ACTION_TOKEN }}",
    });
  });

  it("documents trusted publishing and cross-repo checkout configuration", async () => {
    const readme = await readFile("README.md", "utf8");

    expect(readme).toContain("Trusted Publishing");
    expect(readme).toContain("environment `npm`");
    expect(readme).toContain("CONTRIBUTORS_PLEASE_ACTION_TOKEN");
    expect(readme).toContain("CONTRIBUTORS_PLEASE_ACTION_REF");
    expect(readme).toContain("defaults to `main`");
  });
});
