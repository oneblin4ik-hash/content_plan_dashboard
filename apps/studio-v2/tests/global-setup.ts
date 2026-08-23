import { mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const appRoot = join(import.meta.dirname, "..");
const repoRoot = join(appRoot, "..", "..");

/**
 * wrangler validates `assets.directory` when the pool boots, but the client
 * bundle is a build artefact that need not exist to test the worker.
 */
export default function setup(): void {
  mkdirSync(join(appRoot, "dist", "client"), { recursive: true });
  assertRootConfigMatches();
}

/**
 * Cloudflare Workers Builds runs at the repository root, where wrangler cannot
 * see this app's config — it only searches upwards. The root `wrangler.jsonc`
 * exists to make a deploy from there work, which leaves two files describing
 * one Worker. This catches them drifting apart; the comparison is on the
 * settings that change what gets deployed, with paths normalised to the root.
 */
function assertRootConfigMatches(): void {
  const app = readConfig(join(appRoot, "wrangler.jsonc"));
  const root = readConfig(join(repoRoot, "wrangler.jsonc"));

  const rebased = {
    ...app,
    main: `apps/studio-v2/${app.main}`,
    assets: { ...app.assets, directory: rebase(app.assets.directory) },
    d1_databases: app.d1_databases.map((database) => ({
      ...database,
      migrations_dir: rebase(database.migrations_dir),
    })),
  };

  for (const key of ["name", "main", "compatibility_date", "compatibility_flags",
                     "assets", "d1_databases", "vars", "observability"] as const) {
    const expected = JSON.stringify(rebased[key]);
    const actual = JSON.stringify(root[key]);
    if (expected !== actual) {
      throw new Error(
        `wrangler.jsonc в корне разошёлся с apps/studio-v2/wrangler.jsonc в поле "${key}".\n` +
          `  корень:      ${actual}\n  apps/studio-v2: ${expected}\n` +
          "Приведи оба файла к одним настройкам — иначе выкладка из корня развернёт не то.",
      );
    }
  }
}

/** Only the fields this guard compares; wrangler validates the rest. */
interface WranglerConfig {
  name: string;
  main: string;
  compatibility_date: string;
  compatibility_flags: string[];
  assets: { directory: string; binding: string; not_found_handling: string };
  d1_databases: Array<{
    binding: string;
    database_name: string;
    database_id: string;
    migrations_dir: string;
  }>;
  vars: Record<string, string>;
  observability: { enabled: boolean };
}

/** `./dist/client` and `db/migrations` alike become `apps/studio-v2/...`. */
function rebase(path: string): string {
  return `apps/studio-v2/${path.replace(/^\.\//, "")}`;
}

function readConfig(path: string): WranglerConfig {
  // Both files are JSONC: comments and nothing else exotic.
  const source = readFileSync(path, "utf8").replace(/^\s*\/\/.*$/gm, "");
  return JSON.parse(source) as WranglerConfig;
}
