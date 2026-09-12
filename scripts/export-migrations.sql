-- Export the applied migrations as files for this repository.
--
-- Run in the Supabase SQL editor (Dashboard → SQL Editor → New query).
--
-- Supabase keeps the full text of every migration it has applied in
-- supabase_migrations.schema_migrations. That is the authority on what the
-- database actually contains, and it is readable over the normal API — the
-- database password is only needed for a direct psql/pg connection, which is
-- what the older export script used and what made this look blocked.
--
-- IMPORTANT: this project is shared with another application. The filter
-- below keeps the export to edoshatch360 objects only. Do not remove it —
-- exporting the other app's migrations into this repository would put its
-- schema under this project's version control, and a later `supabase db push`
-- could then act on tables that do not belong to Hatch360.

/* -------------------------------------------------------------------------
   1. What is applied, and what this repository already has.
   ------------------------------------------------------------------------- */

select
  version,
  name,
  -- The filename this belongs in. Migrations named edoshatch360_0007_rpcs
  -- become 0007_rpcs.sql; anything without that numbering keeps its version
  -- so it still sorts correctly.
  case
    when name ~ '^edoshatch360_[0-9]{4}_'
      then regexp_replace(name, '^edoshatch360_', '') || '.sql'
    else version || '_' || regexp_replace(name, '^edoshatch360_', '') || '.sql'
  end as filename,
  length(array_to_string(statements, E'\n')) as sql_chars
from supabase_migrations.schema_migrations
where name like 'edoshatch360%'
order by version;

/* -------------------------------------------------------------------------
   2. The migrations themselves, one row per file.

   Run this on its own, then use the "Download CSV" button above the results
   grid. Each row's `sql` column is the complete file content.
   ------------------------------------------------------------------------- */

select
  case
    when name ~ '^edoshatch360_[0-9]{4}_'
      then regexp_replace(name, '^edoshatch360_', '') || '.sql'
    else version || '_' || regexp_replace(name, '^edoshatch360_', '') || '.sql'
  end as filename,
  array_to_string(statements, E'\n') as sql
from supabase_migrations.schema_migrations
where name like 'edoshatch360%'
order by version;

/* -------------------------------------------------------------------------
   3. Everything as a single document.

   One row, one cell. Click it, copy it, paste it into a file, and split on
   the banner lines. Easier than downloading a CSV when you only want to read
   it; worse when you want the files separately.
   ------------------------------------------------------------------------- */

select string_agg(
  '-- ============================================================' || E'\n' ||
  '-- FILE: ' ||
  case
    when name ~ '^edoshatch360_[0-9]{4}_'
      then regexp_replace(name, '^edoshatch360_', '') || '.sql'
    else version || '_' || regexp_replace(name, '^edoshatch360_', '') || '.sql'
  end || E'\n' ||
  '-- applied: ' || version || E'\n' ||
  '-- ============================================================' || E'\n\n' ||
  array_to_string(statements, E'\n'),
  E'\n\n\n' order by version
) as everything
from supabase_migrations.schema_migrations
where name like 'edoshatch360%';

/* -------------------------------------------------------------------------
   4. Which files this repository is missing.

   Paste the filenames you already have in supabase/migrations/ into the
   values list and this reports the gap, rather than you comparing by eye.
   ------------------------------------------------------------------------- */

-- Note on the names. A migration written as a file and pushed keeps its own
-- name (edoshatch360_0007_rpcs). One applied from the dashboard or a tool is
-- recorded under a timestamp instead (edoshatch360_flock_code_by_breed), so it
-- can be in this repository already under a sequential name and still look
-- missing here. The three below are exactly that case — they are 0021 to 0023
-- in supabase/migrations/ — so they are listed as held to keep the gap report
-- honest.
with have(filename) as (
  values
    ('0001_core.sql'),
    ('0002_operations.sql'),
    ('0003_commerce.sql'),
    ('0021_document_branding.sql'),
    ('0022_flock_code_by_breed.sql'),
    ('0023_data_quality.sql'),
    -- Same three, under the timestamped names the database recorded:
    ('20260912082326_document_branding.sql'),
    ('20260912121517_flock_code_by_breed.sql'),
    ('20260912121757_flock_code_farm_type_breed_seq.sql'),
    ('20260912133731_data_quality_rules.sql')
),
applied as (
  select
    case
      when name ~ '^edoshatch360_[0-9]{4}_'
        then regexp_replace(name, '^edoshatch360_', '') || '.sql'
      else version || '_' || regexp_replace(name, '^edoshatch360_', '') || '.sql'
    end as filename,
    version
  from supabase_migrations.schema_migrations
  where name like 'edoshatch360%'
)
select a.filename, a.version, 'missing from the repository' as status
from applied a
left join have h on h.filename = a.filename
where h.filename is null
order by a.version;
