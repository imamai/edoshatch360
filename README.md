# EDOS Hatch360

Poultry management and farm intelligence platform for Kenyan farms.
Every bird. Every batch. Every farm.

---

## Before anything else: the shared database

This app runs on the Supabase project **`edos-pos`** (`cnlyuwslpcgosgwdmzav`),
which **also hosts an unrelated live POS application**. That app owns the
unprefixed public tables — `clients`, `invoices`, `payments`, `products`,
`pos_*` and others, carrying thousands of real rows.

Every object this codebase creates is prefixed **`edoshatch360_`** — tables,
enums, functions, indexes, policies. Nothing here reads or writes an
unprefixed table, and nothing in the POS app can reach Hatch360 rows.

**If you add a migration, prefix everything.** It is the only thing keeping
the two systems from colliding.

### Known issue in the shared database (not ours)

`public._prisma_migrations` has RLS disabled, so anyone with the anon key can
read or modify it. It belongs to the POS application. Enabling RLS without
policies would break that app's migration tooling, so it has been left alone
and flagged rather than changed.

---

## Running it

```bash
npm install
cp .env.example .env.local   # fill in the Supabase URL and anon key
npm run dev
```

`.env.local` needs:

| Variable | Required | What for |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | yes | Publishable key; all app queries run under RLS with it |
| `NEXT_PUBLIC_SITE_URL` | yes | Absolute URL, used for SEO metadata and auth redirects |
| `SUPABASE_SERVICE_ROLE_KEY` | no | Only for the M-Pesa callback, which has no user session |
| `MPESA_*` | no | Daraja credentials, when payments are switched on |

Checks:

```bash
npx tsc --noEmit   # types
npx eslint .       # lint
npm run build      # production build
```

---

## Accounts

### Demo — safe to share

| | |
|---|---|
| **Email** | `demo@edoshatch360.co.ke` |
| **Password** | _shared separately — deliberately not committed_ |

The password is kept out of this repository on purpose. This account is real
and it lives on a Supabase project shared with a production POS application,
so a working credential in version control is a credential in everyone's
clone and in every fork. Ask whoever set the project up, or reset it from the
Supabase dashboard under Authentication → Users.

Lands straight on **Sunrise Poultry**, a demonstration farm with two farms,
three flocks (layers, broilers, improved kienyeji), ninety days of daily
records, stock, customers, sales and expenses.

This account is a **viewer**: it can open every screen but cannot change
anything. That is enforced by Row Level Security, not just by hiding buttons —
so it is safe to hand to anyone who wants a look without risking the example
everyone else is seeing.

The figures are generated from real production curves, not random numbers:
the layer flock ramps into lay and eases off with age, broilers gain weight
and eat in proportion to it, and the margin lands around 23%, which is what a
poultry operation actually looks like.

### Making your own account

Email confirmation is **on** for this Supabase project, so a normal signup
stops at "check your email" — and Supabase's built-in SMTP is rate-limited to
a handful of messages an hour and often does not deliver.

Two ways round it:

**Turn confirmation off** (best for development) — Supabase dashboard →
Authentication → Sign In / Providers → Email → switch **Confirm email** off.
Signups then go straight through to onboarding.

**Or create a confirmed account directly:**

```sql
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data,
  confirmation_token, recovery_token, email_change_token_new, email_change
)
values (
  '00000000-0000-0000-0000-000000000000',
  gen_random_uuid(), 'authenticated', 'authenticated',
  'you@example.com',
  crypt('your-password', gen_salt('bf')),
  now(), now(), now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"full_name":"Your Name"}'::jsonb,
  '', '', '', ''
);
```

A new account starts at onboarding, where it can either create a real farm or
open the demo alongside it. Once you have your own farm, the demo is still
reachable from the dashboard while that farm is empty.

---

## How it is put together

```
src/
  app/
    (marketing)/       Public site — landing, features, pricing, about, contact
    (auth)/            Sign in, sign up
    onboarding/        First-run: create an organisation, or open the demo
    app/               The application (see below)
    auth/callback/     Email confirmation → session exchange
  components/
    ui/                Primitives: button, card, field, picker, badge, spinner
    app/               Application chrome: sidebar, topbar, bottom nav, offline
    marketing/         Public-site sections, device frames, hero
    charts/            Recharts wrappers with one shared palette
  lib/
    supabase/          client / server / admin (service role, callback only)
    data/              Server-only data access, one module per area
    ai/                The assistant's analysis engine
    catalogues.ts      Pick-lists — feeds, vaccines, breeds, units
    nav.ts             Navigation, filtered by role and farm mode
supabase/migrations/   SQL, applied in order
scripts/               Maintenance scripts
```

### Migrations — read this before changing the schema

The schema was built through 20 migrations, all applied and recorded in
Supabase's own migration history (`supabase_migrations.schema_migrations`),
which is the authoritative record.

`supabase/migrations/` currently holds **0001 and 0002 only**. The remaining
18 were applied through tooling that records them in the database but does not
write them to the repo. To pull them down:

```bash
SUPABASE_DB_URL="postgresql://postgres.cnlyuwslpcgosgwdmzav:<password>@aws-0-eu-west-1.pooler.supabase.com:5432/postgres" \
  node scripts/export-migrations.mjs
```

`pg` is a devDependency now, so that is the whole command. Two things about
that connection string were learned the hard way:

- **Use the session pooler host above.** The direct host,
  `db.cnlyuwslpcgosgwdmzav.supabase.co`, no longer resolves over IPv4 and
  fails with `ENOTFOUND`.
- **`<password>` is the database password, not the Supabase account
  password.** They are different, and the wrong one still reaches Postgres
  and is rejected with `28P01` — which looks like a connectivity problem and
  is not one. If nobody has it, reset it under **Project settings → Database
  → Database password**. That rotates the Postgres role only; it does not
  touch the anon or service-role keys the apps authenticate with, so neither
  Hatch360 nor the POS application is affected. URL-encode it — `@` becomes
  `%40`.

Do this before the next schema change, so the repo can rebuild the database
without the live project.

### Some decisions worth knowing

**Money is always integer cents.** Nothing anywhere holds a floating-point
shilling value.

**Dates are `YYYY-MM-DD` strings, not `Date` objects.** A farmer in Nairobi
recording "yesterday" must not land on a different day because the server
runs in UTC.

**Derived values are maintained by database triggers, never written by the
app.** A flock's live bird count is recomputed from its daily records; a
sale's total is summed from its line items; stock level is the sum of its
movements. Each recomputes from scratch rather than incrementing, so editing
or deleting a past row can never strand a stale figure.

**Server-only modules are marked `import "server-only"`.** A client component
importing one fails immediately and says why, rather than producing a
confusing `next/headers` error three modules away.

---

## Security

Tenant isolation is enforced by **Row Level Security**, not by the interface.

- Policies are written as `tenant_id in (select edoshatch360_…_ids())`, which
  evaluates the set once per statement rather than once per row.
- The helper functions are `SECURITY DEFINER` to break the recursion that
  would otherwise occur when a policy on memberships reads memberships.
- `EXECUTE` is revoked from `PUBLIC` and `anon` on every Hatch360 function
  and granted deliberately. The one exception is
  `edoshatch360_is_platform_admin()`, which the public CMS policies evaluate.

**Financial data is restricted at the database.** `sales`, `sale_items`,
`customer_payments`, `expenses` and `customers` are readable only by
`owner`, `accountant`, `sales`, `manager` and `viewer`. Operational roles —
`worker`, `supervisor`, `vet` — cannot read them with the anon key and a
session, not merely cannot see the screen.

The role lists in `src/lib/data/session.ts` mirror database functions
one-for-one. **If you change one, change the other in the same commit.**

---

## Document branding

**Settings → Logo & signature** lets the account owner upload a business logo
and an authorised signature. Both are printed on every quotation, sales order,
invoice and receipt, alongside the signatory's name and title.

The bucket (`edoshatch360-branding`) is **private**, and the documents read it
through signed URLs that last an hour. A scanned handwritten signature sitting
on a permanent public URL is a forgery risk, so what is stored in
`edoshatch360_settings` is a storage *path*, never a URL — a URL would expire
and be wrong the next time anyone opened the document.

Access mirrors the app's roles exactly, and is enforced by storage policies
rather than by the interface:

- **Read** — any active member of the tenant. Anyone who can open an invoice
  can already see the marks on it.
- **Write** — owners only, matching `CAN_ADMIN`. Changing the signature on
  every future invoice is not a staff-level action.

Paths are `<tenant_id>/<asset>-<timestamp>.<ext>`, so the first folder segment
is the tenancy boundary the policies check. Replacing a mark uploads the new
file first and deletes the old one only after the record points elsewhere —
the other order would strand documents on a file that no longer exists.

`edoshatch360_tenants.logo_url` is deliberately left unused: it was designed
to hold a permanent public URL, which this scheme cannot produce.

---

## Offline

The offline promise is real, and it is the IndexedDB queue in
`src/lib/offline/` — not the service worker.

A daily record saves to the device first when there is no connection, and
syncs itself when the network returns, upserting on `(flock_id, record_date)`
so a re-sync updates rather than duplicates. Sync state is always visible.

The service worker deliberately **never caches an authenticated page** —
serving one farm's dashboard to the next person on a shared phone is a worse
failure than being offline. It caches immutable build assets and serves an
offline page for navigations it cannot fulfil.

---

## The assistant

`/app/assistant` answers questions from the farm's own records. It is an
analysis engine (`src/lib/ai/`), not a language model: every reply is computed
from rows the farmer entered and ships with the figures behind it, and it says
so plainly when a question falls outside what the data can answer rather than
improvising.

Per the product spec, it draws a hard line between a data observation and
veterinary advice. Any finding involving sick or dying birds is marked
`needsVet` and ends by saying to call an animal health officer.

If a language model is added later, it should phrase these findings — never
source them.

---

## Marketing screenshots

The device frames on the landing and features pages hold **real screenshots of
the running application**, captured against the demo farm. They are not
mockups.

When the app's appearance changes, re-capture them — otherwise the marketing
site advertises a product that no longer looks like that.

---

## Photography

The hero and most feature imagery are **photographs of a real customer's
houses**, supplied by EDOS Centre and held in
`public/images/marketing/farm/`. They are **all rights reserved — not stock,
not licensed for reuse elsewhere.** Four of them had a burnt-in camera
timestamp cropped off; if you ever re-import from the originals, crop again.

The remaining four slots — eggs, egg handling, free-range kienyeji, and the
money section — are still Unsplash-licensed stock, because the farm set
contains nothing matching those subjects. Both sets, and which slot each file
fills, are itemised in `public/images/marketing/CREDITS.md`.

Every image was reviewed at full resolution before use, for third-party
branding and for anything that would identify the farm without its consent.

**The hero also plays a short clip, on phones only** — `public/video/`. The
footage is 480x864 portrait, which upscales acceptably at phone width and
badly on a desktop hero, so wide screens keep the stills and never download
it. It is skipped for `prefers-reduced-motion`, for `saveData`, and on 2G:
this product sells itself on working over poor connections, so it should not
push 930KB of decoration down a bad one. `HeroVideo` renders over the still
carousel rather than replacing it, so a blocked autoplay or a stalled download
leaves the photograph in place rather than an empty hero.

Every image is replaceable from the CMS without a code change: the pages read
`edoshatch360_cms_sections.image_url` and fall back to these files.
