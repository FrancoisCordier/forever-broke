/** Battle.net Game Data API client for WoW Forever. Endpoints verified in docs/api-notes.md. */
import type { Listing } from "../shared/types.ts";

const RETRY_DELAY_MS = 5000;

export class Api {
  readonly host: string;
  readonly region: string;
  private token = "";

  constructor(region: string) {
    this.region = region;
    this.host = `https://${region}.api.blizzard.com`;
  }

  async authenticate(): Promise<void> {
    const id = process.env.BNET_CLIENT_ID;
    const secret = process.env.BNET_CLIENT_SECRET;
    if (!id || !secret) throw new Error("Missing BNET_CLIENT_ID / BNET_CLIENT_SECRET");
    const res = await withRetry(() =>
      fetch("https://oauth.battle.net/token", {
        method: "POST",
        headers: {
          Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: "grant_type=client_credentials",
      }),
    );
    if (!res.ok) throw new Error(`token: HTTP ${res.status}`);
    this.token = ((await res.json()) as { access_token: string }).access_token;
  }

  private url(path: string, ns: "dynamic" | "static"): string {
    return `${this.host}${path}?namespace=${ns}-forever-${this.region}&locale=en_GB`;
  }

  /**
   * Fetch a house's commodities. The ruleset in the path is ignored by the API (A7); 1 is used.
   * Returns "unchanged" on 304. Throws on failure (after one retry).
   */
  async commodities(
    house: number,
    ifModifiedSince?: string,
  ): Promise<
    | { status: "unchanged" }
    | { status: "ok"; lastModified: string | null; raw: string; listings: Listing[] | undefined }
  > {
    const headers: Record<string, string> = { Authorization: `Bearer ${this.token}` };
    if (ifModifiedSince) headers["If-Modified-Since"] = ifModifiedSince;
    const res = await withRetry(() =>
      fetch(this.url(`/data/wow/ruleset/1/auctions/${house}/commodities`, "dynamic"), { headers }),
    );
    if (res.status === 304) {
      await res.body?.cancel();
      return { status: "unchanged" };
    }
    if (!res.ok) throw new Error(`commodities ${house}: HTTP ${res.status}`);
    const raw = await res.text();
    const body = JSON.parse(raw) as { auctions?: Listing[] };
    return { status: "ok", lastModified: res.headers.get("last-modified"), raw, listings: body.auctions };
  }

  /** Item metadata from the static namespace. Returns null on 404. */
  async item(id: number): Promise<Record<string, unknown> | null> {
    const res = await withRetry(() =>
      fetch(this.url(`/data/wow/item/${id}`, "static"), { headers: { Authorization: `Bearer ${this.token}` } }),
    );
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`item ${id}: HTTP ${res.status}`);
    return (await res.json()) as Record<string, unknown>;
  }

  /** Icon file id from the item media endpoint (A21), or 0 when there's none (404 or no icon asset). */
  async itemIcon(id: number): Promise<number> {
    const res = await withRetry(() =>
      fetch(this.url(`/data/wow/media/item/${id}`, "static"), { headers: { Authorization: `Bearer ${this.token}` } }),
    );
    if (res.status === 404) return 0;
    if (!res.ok) throw new Error(`item media ${id}: HTTP ${res.status}`);
    const body = (await res.json()) as { assets?: { key?: string; file_data_id?: number }[] };
    return body.assets?.find((a) => a.key === "icon")?.file_data_id ?? 0;
  }
}

/** Retry once on network error, 429 or 5xx. */
export async function withRetry(fn: () => Promise<Response>, delayMs = RETRY_DELAY_MS): Promise<Response> {
  try {
    const res = await fn();
    if (res.status !== 429 && res.status < 500) return res;
    await res.body?.cancel();
  } catch {
    /* fall through to the retry */
  }
  await new Promise((r) => setTimeout(r, delayMs));
  return fn();
}
