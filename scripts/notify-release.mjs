import { pathToFileURL } from "node:url";

const REPO = "smorinlabs/contributors-please-action";
const EVENT_TYPE = "contributors-please-released";

// Sends a repository_dispatch to the action repo so its engine-sync workflow
// reacts to the release immediately instead of waiting for its daily cron.
//
// Every failure path emits a `::error::` workflow-command annotation naming the
// exact root cause, so a broken notification is loud and diagnosable from the
// run summary rather than silently swallowed. The caller maps `ok: false` to a
// non-zero exit code.
export async function notifyRelease({
  token,
  version,
  repo = REPO,
  eventType = EVENT_TYPE,
  fetchImpl = fetch,
  emit = console.log,
} = {}) {
  if (!token) {
    const message = [
      `::error::Release notification NOT sent for ${version || "(unknown version)"}.`,
      `Root cause: the CONTRIBUTORS_PLEASE_ACTION_TOKEN secret is empty or unset in smorinlabs/contributors-please,`,
      `so the dispatch was never attempted.`,
      `Effect: ${repo} was not told about this release and will only notice on its daily engine-sync cron.`,
      `Fix: set the CONTRIBUTORS_PLEASE_ACTION_TOKEN repository secret to a token with 'contents: write' on ${repo}.`,
    ].join(" ");
    emit(message);
    return { ok: false, reason: "missing-token", message };
  }

  const response = await fetchImpl(
    `https://api.github.com/repos/${repo}/dispatches`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        event_type: eventType,
        client_payload: { version },
      }),
    }
  );

  if (response.status !== 204) {
    const body = await safeText(response);
    const message = [
      `::error::Release notification to ${repo} failed for ${version}.`,
      `Root cause: the dispatch POST returned HTTP ${response.status} (expected 204).`,
      `Response body: ${body || "(empty)"}.`,
      `Likely causes: the token lacks 'contents: write' on ${repo}, the token is expired,`,
      `or the repository / event_type is wrong.`,
    ].join(" ");
    emit(message);
    return { ok: false, reason: "http-error", status: response.status, message };
  }

  const message = `Release notification sent to ${repo} (event_type=${eventType}, version=${version}).`;
  emit(message);
  return { ok: true, message };
}

async function safeText(response) {
  try {
    return (await response.text()).slice(0, 500);
  } catch {
    return "";
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = await notifyRelease({
    token: process.env.GH_TOKEN,
    version: process.env.GITHUB_REF_NAME,
  });
  if (!result.ok) {
    process.exitCode = 1;
  }
}
