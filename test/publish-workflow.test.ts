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
            name?: string;
            uses?: string;
            run?: string;
            with?: Record<string, string | number>;
            env?: Record<string, string>;
            "continue-on-error"?: boolean;
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
    const actionDispatchClientToken = steps.find(
      step => step.name === "Mint contributors-please-action dispatch token (client-id)"
    );
    const actionDispatchAppToken = steps.find(
      step => step.name === "Mint contributors-please-action dispatch token (app-id, deprecated)"
    );
    expect(actionCheckoutStep?.with).toMatchObject({
      path: "contributors-please-action",
      ref: "${{ vars.CONTRIBUTORS_PLEASE_ACTION_REF || 'main' }}",
      token:
        "${{ steps.action-dispatch-token-client.outputs.token || steps.action-dispatch-token-app.outputs.token || secrets.CONTRIBUTORS_PLEASE_ACTION_TOKEN || github.token }}",
    });
    expect(actionDispatchClientToken?.uses).toBe("actions/create-github-app-token@v3");
    expect(actionDispatchClientToken?.with).toMatchObject({
      "client-id": "${{ secrets.RELEASE_PLEASE_CLIENT_ID }}",
      "private-key": "${{ secrets.RELEASE_PLEASE_PRIVATE_KEY }}",
      owner: "smorinlabs",
      repositories: "contributors-please-action",
    });
    expect(actionDispatchAppToken?.uses).toBe("actions/create-github-app-token@v3");
    expect(actionDispatchAppToken?.with).toMatchObject({
      "app-id": "${{ secrets.RELEASE_PLEASE_APP_ID }}",
      "private-key": "${{ secrets.RELEASE_PLEASE_PRIVATE_KEY }}",
      owner: "smorinlabs",
      repositories: "contributors-please-action",
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
    const preflightDispatchToken = steps.findIndex(
      step => step.name === "Preflight contributors-please-action dispatch token"
    );
    const notifyAction = steps.find(
      step => step.name === "Notify contributors-please-action of the release"
    );
    const dispatchTokenExpression =
      "${{ steps.action-dispatch-token-client.outputs.token || steps.action-dispatch-token-app.outputs.token || secrets.CONTRIBUTORS_PLEASE_ACTION_TOKEN }}";

    expect(versionCheck).toBeGreaterThanOrEqual(0);
    expect(npmCi).toBeGreaterThan(versionCheck);
    expect(outputCheck).toBeGreaterThanOrEqual(0);
    expect(distDiff).toBeGreaterThan(outputCheck);
    expect(preflightDispatchToken).toBeGreaterThan(distDiff);
    expect(preflightDispatchToken).toBeLessThan(publish);
    expect(steps[preflightDispatchToken]?.env?.GH_TOKEN).toBe(dispatchTokenExpression);
    expect(steps[preflightDispatchToken]?.run).toContain('test -n "${GH_TOKEN}"');
    expect(steps[preflightDispatchToken]?.run).toContain(
      "gh api --method GET repos/smorinlabs/contributors-please-action"
    );
    expect(steps[preflightDispatchToken]?.run).toContain(
      "Dispatch token preflight API path: REST"
    );
    expect(publish).toBeGreaterThan(distDiff);
    expect(steps[publish]?.env).toBeUndefined();
    expect(notifyAction?.["continue-on-error"]).toBeUndefined();
    expect(notifyAction?.env?.GH_TOKEN).toBe(dispatchTokenExpression);
    expect(notifyAction?.run).toContain("repos/smorinlabs/contributors-please-action/dispatches");
    expect(notifyAction?.run).toContain("for attempt in 1 2 3");
    expect(notifyAction?.run).toContain("Dispatch API path: REST");
    expect(notifyAction?.run).toContain("Manual replay command:");
    expect(notifyAction?.run).toContain("sleep_seconds=$((attempt * 10))");
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
