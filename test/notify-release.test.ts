import { describe, expect, it, vi } from "vitest";

import { notifyRelease } from "../scripts/notify-release.mjs";

describe("notifyRelease", () => {
  it("prints a loud, specific root cause and fails when the token is missing", async () => {
    const emit = vi.fn();
    const fetchImpl = vi.fn();

    const result = await notifyRelease({
      token: "",
      version: "v1.3.0",
      fetchImpl,
      emit,
    });

    expect(result.ok).toBe(false);
    expect(result.reason).toBe("missing-token");
    // The dispatch must never be attempted without a token.
    expect(fetchImpl).not.toHaveBeenCalled();
    const message = emit.mock.calls.at(0)?.at(0) as string;
    expect(message).toContain("::error::");
    expect(message).toContain("CONTRIBUTORS_PLEASE_ACTION_TOKEN");
    expect(message).toContain("v1.3.0");
  });

  it("prints a loud root cause with status and body on a non-204 response", async () => {
    const emit = vi.fn();
    const fetchImpl = vi.fn().mockResolvedValue({
      status: 403,
      text: async () => "Resource not accessible by personal access token",
    });

    const result = await notifyRelease({
      token: "ghp_example",
      version: "v1.3.0",
      fetchImpl,
      emit,
    });

    expect(result.ok).toBe(false);
    expect(result.reason).toBe("http-error");
    expect(result.status).toBe(403);
    const message = emit.mock.calls.at(0)?.at(0) as string;
    expect(message).toContain("::error::");
    expect(message).toContain("HTTP 403");
    expect(message).toContain("Resource not accessible by personal access token");
  });

  it("posts the repository dispatch and reports success on 204", async () => {
    const emit = vi.fn();
    const fetchImpl = vi.fn().mockResolvedValue({
      status: 204,
      text: async () => "",
    });

    const result = await notifyRelease({
      token: "ghp_example",
      version: "v1.3.0",
      fetchImpl,
      emit,
    });

    expect(result.ok).toBe(true);
    expect(fetchImpl).toHaveBeenCalledOnce();
    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(
      "https://api.github.com/repos/smorinlabs/contributors-please-action/dispatches"
    );
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>).Authorization).toBe(
      "Bearer ghp_example"
    );
    const body = JSON.parse(init.body as string);
    expect(body.event_type).toBe("contributors-please-released");
    expect(body.client_payload.version).toBe("v1.3.0");
  });
});
