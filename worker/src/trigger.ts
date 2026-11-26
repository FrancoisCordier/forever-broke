/**
 * Starts the `collect` workflow through GitHub's workflow_dispatch API (ADR-0009).
 * No Cloudflare types here, so the root Vitest/tsc setup can test it.
 */

export const REPO = "FrancoisCordier/forever-broke";
export const WORKFLOW = "collect.yml";
export const REF = "main";

export interface TriggerEnv {
  /** Fine-grained PAT: this repo only, "Actions: Read and write". Set with `wrangler secret put GITHUB_TOKEN`. */
  GITHUB_TOKEN: string;
}

export function dispatchRequest(token: string): Request {
  return new Request(`https://api.github.com/repos/${REPO}/actions/workflows/${WORKFLOW}/dispatches`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
      // GitHub rejects API requests without a User-Agent.
      "User-Agent": "forever-broke-trigger",
    },
    body: JSON.stringify({ ref: REF }),
  });
}

/** Throws on a missing token or a non-2xx response, so the failure shows up in the Worker's logs. */
export async function triggerCollect(env: TriggerEnv, fetchImpl: typeof fetch = fetch): Promise<void> {
  if (!env.GITHUB_TOKEN) throw new Error("GITHUB_TOKEN secret is not set");
  const res = await fetchImpl(dispatchRequest(env.GITHUB_TOKEN));
  if (!res.ok) {
    const body = (await res.text()).slice(0, 500);
    throw new Error(`workflow_dispatch failed: ${res.status} ${res.statusText} ${body}`);
  }
}
