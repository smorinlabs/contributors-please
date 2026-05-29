import { describe, expect, it } from "vitest";

import { VERSION } from "../src/lib";

describe("public API", () => {
  it("exports VERSION", () => {
    expect(VERSION).toBe("1.0.2");
  });
});

