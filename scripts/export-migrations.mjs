/**
 * Writes every applied `edoshatch360_*` migration from Supabase's migration
 * history into supabase/migrations/ as a .sql file.
 *
 * Migrations applied through the Supabase MCP tools or the dashboard are
 * recorded in the database but never land in the repo. This pulls them back
 * so the schema can be rebuilt from source.
 *
 * Usage:
 *   SUPABASE_DB_URL="postgresql://postgres.<ref>:<password>@<host>:5432/postgres" \
 *     node scripts/export-migrations.mjs
 *
 * The connection string is on the Supabase dashboard under
 * Project settings → Database → Connection string (URI).
 */

import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const url = process.env.SUPABASE_DB_URL;
if (!url) {
  console.error(
    "SUPABASE_DB_URL is not set.\n\n" +
      "Find it under Project settings → Database → Connection string (URI),\n" +
      "then run:\n\n" +
      '  SUPABASE_DB_URL="postgresql://..." node scripts/export-migrations.mjs\n',
  );
  process.exit(1);
}

let pg;
try {
  pg = await import("pg");
} catch {
  console.error("This script needs the `pg` package:\n\n  npm i -D pg\n");
  process.exit(1);
}

const client = new pg.default.Client({
  connectionString: url,
  ssl: { rejectUnauthorized: false },
});

await client.connect();

const { rows } = await client.query(`
  select name, array_to_string(statements, E';\n\n') || ';' as sql
  from supabase_migrations.schema_migrations
  where name like 'edoshatch360%'
  order by version
`);

const dir = join(process.cwd(), "supabase", "migrations");
mkdirSync(dir, { recursive: true });

for (const row of rows) {
  // edoshatch360_0007_rpcs -> 0007_rpcs.sql
  const file = `${row.name.replace(/^edoshatch360_/, "")}.sql`;
  writeFileSync(join(dir, file), `${row.sql.replace(/;;\s*$/, ";\n")}`, "utf8");
  console.log(`✓ ${file}`);
}

await client.end();
console.log(`\n${rows.length} migration(s) written to supabase/migrations/`);
