# meals — working notes for Claude

Read `README.md` first. It holds the four principles (nutritious · low effort ·
widely available · tasty), the weighting rule, and how the folder is organized.
This file is just the conventions for editing.

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
- **Recipes**: a scoreline (the four principles + active/total time + sessions),
  then **Equipment** and **Serves**, a line or two on the dish, **Ingredients**,
  **Method**, and a closing *why it scores well* + *levers*. Match an existing file
  in `recipes/proven/`. Every recipe's core version must cook from the proven kit
  alone; widely-available extras are flagged optional.

## Rules
- One dish or one ingredient per file or row; keep entries short and scannable.
- Prefer a small set of repeated staples over variety for its own sake — the
  recipes should keep landing on the same handful.
- Flag equipment beyond pot/pan/knife at the top of a recipe.
- **Never auto-promote.** New items start in `candidates/`; only the user moves
  them to `proven/`. Mark anything generated-but-unchecked as a draft.
