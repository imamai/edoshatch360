# Marketing photography credits

Two sets of photographs ship with this site, under different terms. Keep them
straight: one set may be used freely, the other belongs to a real farm.

---

## 1. Farm photography — `farm/` (client-supplied, all rights reserved)

Photographs of a real customer's houses, supplied by EDOS Centre on
2026-09-12. **These are not stock images and are not licensed for reuse
outside this product.** Do not redistribute them, and do not assume a future
client has granted the same permission.

They carry their own provenance as an asset: the birds, the housing, the
feeders and the people are all Kenyan, which is the claim the marketing copy
makes and which no stock library reproduces convincingly.

| File | Subject | Where it is used |
|---|---|---|
| `layer-house.jpg` | Tiered layer cage house, aisle centred, two workers | Hero, slide 1 |
| `deep-litter-house.jpg` | Deep-litter house full of brown pullets | Hero, slide 2 |
| `cage-rows.jpg` | Cage rows receding, worker walking the aisle | Hero slide 3; Features → Daily recording |
| `brooder.jpg` | Day-old chicks in a brooder ring on newspaper | Landing → Flock management |
| `pullets-feeders.jpg` | Pullets around hanging feeders and drinkers | Landing → Feed & inventory |
| `pullets-close.jpg` | Brown pullets in close-up on deep litter | Landing → Health; Features → Health |
| `pullets-flock.jpg` | A batch of pullets filling a deep-litter house | Features → Flock management |
| `layer-house-wide.jpg` | Full length of a layer house | About page |
| `layer-house-tall.jpg` | Layer house, portrait framing | Sign-in / sign-up side panel |
| `brooder-close.jpg` | Chicks in close-up | *Held in reserve — not referenced in code* |

### Motion — `public/video/farm-hero.mp4`

The hero plays a clip **on phones only**. It is cut from the 8.56.25 AM
video, a handheld walk through the deep-litter house.

| | |
|---|---|
| Source window | 11.5s–18.5s of the original |
| Output | 480x864, 7.8s, H.264 Main, no audio, 934KB |
| Poster | `farm-hero-poster.jpg`, its own first frame |

What was done to it, and why:

- **Stabilised** (`vidstab`, two-pass). Worth saying plainly: this bought
  only about 10%. The movement in these clips is a person walking, not
  camera shake, and stabilisation cannot remove a walk.
- **Slowed to 0.8x**, which does more for how calm it reads than the
  stabiliser did.
- **Crossfaded tail into head** so the loop does not jump-cut back to the
  start of the pan every 8 seconds.

**It is never used above the `md` breakpoint.** The source is 480px wide and
portrait: at phone width that is about a 1.6x upscale and looks fine, but a
desktop hero would stretch it past 3x, and it turns to mush. Wide screens keep
the stills. It is also skipped for `prefers-reduced-motion`, for `saveData`,
and on 2G.

The other three clips were rejected: all are 480x864 handheld portrait, and
their pans end on a floor or a dark tarp rather than on anything worth
holding.

### Processing applied

Originals were WhatsApp-compressed JPEGs (960–1600px). Each was re-encoded at
quality 82 with mozjpeg and otherwise left alone — no colour grading, so the
houses look as they actually do.

**Four frames carried a burnt-in camera timestamp** (`09/09/2026 12:30`) in
the bottom-right corner: `deep-litter-house`, `pullets-feeders`,
`pullets-flock` and `pullets-close`. The bottom 7% of each was cropped away to
remove it. If you re-import these from the originals, crop them again — the
timestamp reads as an artefact on a marketing page.

Every file was reviewed at full resolution before use, for third-party
branding, legible signage and anything that would identify the farm without
its consent. Two frames contain newspaper bedding with legible print; neither
of those is the one shipped in a prominent slot.

---

## 2. Stock photography — Unsplash

Sourced under the Unsplash License (https://unsplash.com/license), which
permits commercial use without attribution. Credited here anyway, so the
originals can be re-sourced at a different crop later.

| File | Unsplash photo ID | Subject | Status |
|---|---|---|---|
| `eggs-trays.jpg` | `1648141499246-97a0eb56c2fd` | Hand collecting an egg from stacked trays | **In use** — Landing → Production |
| `eggs-carton.jpg` | `1506976785307-8732e854ad03` | Grid of brown eggs in a moulded carton | **In use** — Landing → Offline card |
| `kienyeji.jpg` | `1731328966800-b677e4fcda8d` | Free-range indigenous birds on open ground | **In use** — Landing → Kienyeji & small farms |
| `feeding.jpg` | `1569466593977-94ee7ed02ec9` | Hens feeding from a hanging feeder | **In use** — Features → Money |
| `broilers.jpg` | `1630090374791-c9eb7bab3935` | Dense flock of white broilers | Retained, unreferenced |
| `chicks-brooding.jpg` | `1694854038360-56b29a16fb0c` | Day-old chicks under brooder lamps | Retained, unreferenced |
| `layer-hen.jpg` | `1548550023-2bdb3c5beed7` | Brown layer hen, flock behind | Retained, unreferenced |

Originals: `https://images.unsplash.com/photo-<id>?w=<width>&q=78&auto=format&fit=crop`

### Why these four are still stock

The farm set contains no photograph of eggs, of egg handling, or of a
free-range/small kienyeji flock — and no photograph that speaks to money. The
slots above are about exactly those things, so substituting a cage-house
picture into them would make the page less honest, not more Kenyan. They stay
stock until matching farm photographs exist.

---

## 3. Product tiles — `public/images/products/`

Default photograph per product category, used by a Counter tile until the farm
uploads a picture of its own stock. Two are the customer's own houses and carry
the same all-rights-reserved terms as the `farm/` set above.

| File | Source | Terms |
|---|---|---|
| `live_birds.jpg` | Crop of `farm/pullets-close.jpg` — the customer's own birds | **All rights reserved** |
| `chicks.jpg` | Crop of `farm/brooder-close.jpg` — the customer's own brooder | **All rights reserved** |
| `eggs.jpg` | Crop of `eggs-trays.jpg` | Unsplash |
| `spent_layers.jpg` | Crop of `layer-hen.jpg` | Unsplash |
| `feed.jpg` | Crop of `feeding.jpg` | Unsplash |
| `processed_birds.jpg` | Unsplash `1587593810167-a84920ea0781` — whole raw chicken | Unsplash |
| `manure.jpg` | Unsplash `1708432331128-cfe5a2803781` — composted organic matter | Unsplash |

All are 720x540, smart-cropped to the most salient region so a tile never
lands on an empty corner of the frame.

**These are defaults, not the farm's produce.** A photograph of somebody
else's dressed chicken is a placeholder, and the honest fix is the farm
uploading its own through `edoshatch360_products.photo_url`. The tile prefers
that whenever it exists.

---

Every image in either set is replaceable from the admin CMS without a code
change: the pages read `edoshatch360_cms_sections.image_url` and fall back to
these files.
