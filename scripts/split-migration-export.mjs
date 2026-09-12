#!/usr/bin/env node
/**
 * Turn the CSV exported by scripts/export-migrations.sql into migration files.
 *
 *   1. Run query 2 of scripts/export-migrations.sql in the Supabase SQL editor.
 *   2. Press "Download CSV" above the results grid.
 *   3. node scripts/split-migration-export.mjs ~/Downloads/<file>.csv
 *
 * Existing files are left alone unless --force is passed: the point is to fill
 * the gaps in supabase/migrations/, not to overwrite a file someone has since
 * commented or corrected by hand.
 *
 * The CSV is parsed properly rather than split on commas. Every one of these
 * migrations contains commas, newlines and double quotes inside the SQL, so a
 * naive split would quietly corrupt the schema — the sort of bug that only
 * surfaces months later when someone tries to rebuild the database.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve(HERE, "..", "supabase", "migrations");

const args = process.argv.slice(2);
const force = args.includes("--force");
const csvPath = args.find((a) => !a.startsWith("--"));

if (!csvPath) {
  console.error("Usage: node scripts/split-migration-export.mjs <export.csv> [--force]");
  process.exit(1);
}

/** RFC 4180: quoted fields may contain commas, newlines and "" escapes. */
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;

  // A BOM at the head of the file becomes part of the first header otherwise.
  let i = text.charCodeAt(0) === 0xfeff ? 1 : 0;

  for (; i < text.length; i++) {
    const c = text[i];

    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else quoted = false;
      } else field += c;
      continue;
    }

    if (c === '"') { quoted = true; }
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\r") { /* handled by the \n that follows */ }
    else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else field += c;
  }

  if (field !== "" || row.length > 0) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.length > 1 || r[0] !== "");
}

const rows = parseCsv(readFileSync(csvPath, "utf8"));
if (rows.length < 2) {
  console.error("That CSV has no rows. Did query 2 return results?");
  process.exit(1);
}

const header = rows[0].map((h) => h.trim().toLowerCase());
const nameCol = header.indexOf("filename");
const sqlCol = header.indexOf("sql");

if (nameCol === -1 || sqlCol === -1) {
  console.error(`Expected "filename" and "sql" columns, found: ${header.join(", ")}`);
  console.error("Run query 2 of scripts/export-migrations.sql, not query 1 or 3.");
  process.exit(1);
}

mkdirSync(OUT_DIR, { recursive: true });

let written = 0;
let skipped = 0;

for (const row of rows.slice(1)) {
  const filename = row[nameCol]?.trim();
  const sql = row[sqlCol];
  if (!filename || !sql) continue;

  // Never let a filename from the database escape the migrations directory.
  if (filename.includes("/") || filename.includes("\\") || filename.includes("..")) {
    console.error(`  refused  ${filename}  (unexpected path characters)`);
    continue;
  }

  const target = join(OUT_DIR, filename);
  if (existsSync(target) && !force) {
    console.log(`  kept     ${filename}  (already here — pass --force to replace)`);
    skipped++;
    continue;
  }

  writeFileSync(target, sql.endsWith("\n") ? sql : sql + "\n", "utf8");
  console.log(`  wrote    ${filename}  (${(sql.length / 1024).toFixed(1)} KB)`);
  written++;
}

console.log(`\n${written} written, ${skipped} left as they were.`);
console.log("Check them with: git status supabase/migrations/");
