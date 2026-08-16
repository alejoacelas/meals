# meals — working notes for Claude

Read `README.md` first. It holds the four principles (nutritious · low effort ·
widely available · tasty), the weighting rule, and how the folder is organized.
This file is just the conventions for editing.

## Related
- `friends/places` (primary) and `friends/people` — relevant to where this goes
  next; how they feed into meals is still TBD.

## Scoring
- Score every ingredient and recipe against the four principles — never add an
  entry without saying how it does on each. Use 🟢 great · 🟡 ok/mixed · 🔴 weak.
- **Don't average.** For each category name the one principle that decides it and
  rank on that; the rest are constraints or tie-breakers. Don't let an irrelevant
  criterion drag an item down (spices are judged on taste, not nutrition).

## Formats
- **Ingredient tables** (`ingredients/candidates/`): ranked best-first, columns in
  scan order — `Ingredient · Why here · Versatility · Prep effort · Availability ·
  Nutrition`. *Why here* is one sentence on the placement.
- **Recipes** (`menu/`): a scoreline (the four principles + active/total time +
  sessions), **Equipment**, **Serves**, then an at-a-glance table (**Core
  ingredients · Time · Steps**), a line on the dish, a **Core recipe** (proven kit
  only), and a **Level it up** list of widely-available extras, each flagged
  `(not in kit)`. Match an existing file in `menu/`. Every recipe's core version
  must cook from the proven kit alone.

## Rules
- One dish or one ingredient per file or row; keep entries short and scannable.
- Prefer a small set of repeated staples over variety for its own sake — the
  recipes should keep landing on the same handful.
- Flag equipment beyond pot/pan/knife at the top of a recipe.
- **Ingredients** start in `candidates/`; only the user promotes them to `proven/` —
  never automatic. **Recipes** all live in `menu/`; a recipe earns a `> **Tried**`
  note and a ✓ in the index only once the user has actually cooked it.
