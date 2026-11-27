import { type TriggerEnv, triggerCollect } from "./trigger.ts";

/** Just the part of Cloudflare's ExecutionContext we use; avoids a dependency on @cloudflare/workers-types. */
interface Ctx {
  waitUntil(promise: Promise<unknown>): void;
}

// Cron Triggers are in wrangler.jsonc (:24 and :39, see ADR-0009). No fetch handler: the Worker has no URL to call.
export default {
  scheduled(_controller: unknown, env: TriggerEnv, ctx: Ctx): void {
    ctx.waitUntil(triggerCollect(env));
  },
};
