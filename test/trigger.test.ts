import { describe, expect, it } from "vitest";
import { dispatchRequest, triggerCollect } from "../worker/src/trigger.ts";

describe("dispatchRequest", () => {
  it("targets the collect workflow on main with the token", async () => {
    const req = dispatchRequest("tok");
    expect(req.method).toBe("POST");
    expect(req.url).toBe(
      "https://api.github.com/repos/FrancoisCordier/forever-broke/actions/workflows/collect.yml/dispatches",
    );
    expect(req.headers.get("authorization")).toBe("Bearer tok");
    expect(req.headers.get("accept")).toBe("application/vnd.github+json");
    expect(req.headers.get("user-agent")).toBeTruthy();
    expect(await req.json()).toEqual({ ref: "main" });
  });
});

describe("triggerCollect", () => {
  it("resolves on 204", async () => {
    const calls: Request[] = [];
    const fake = (async (req: Request) => {
      calls.push(req);
      return new Response(null, { status: 204 });
    }) as typeof fetch;
    await triggerCollect({ GITHUB_TOKEN: "tok" }, fake);
    expect(calls).toHaveLength(1);
  });

  it("throws with the status on an error response", async () => {
    const fake = (async () => new Response("Bad credentials", { status: 401 })) as typeof fetch;
    await expect(triggerCollect({ GITHUB_TOKEN: "bad" }, fake)).rejects.toThrow(/401.*Bad credentials/);
  });

  it("throws without calling GitHub when the secret is missing", async () => {
    let called = false;
    const fake = (async () => {
      called = true;
      return new Response(null, { status: 204 });
    }) as typeof fetch;
    await expect(triggerCollect({ GITHUB_TOKEN: "" }, fake)).rejects.toThrow(/GITHUB_TOKEN/);
    expect(called).toBe(false);
  });
});
