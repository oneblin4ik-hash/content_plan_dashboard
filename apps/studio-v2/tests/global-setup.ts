import { mkdirSync } from "node:fs";
import { join } from "node:path";

/**
 * wrangler validates `assets.directory` when the pool boots, but the client
 * bundle is a build artefact that need not exist to test the worker.
 */
export default function setup(): void {
  mkdirSync(join(import.meta.dirname, "..", "dist", "client"), { recursive: true });
}
