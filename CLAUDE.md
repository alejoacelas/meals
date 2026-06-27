# meals — nutritious food that's fast to make anywhere

A catalog of meals and the ingredients they're built from, chosen so I can eat
well with little effort in any kitchen I land in.

## The four principles
Every ingredient and recipe here is judged on these. Recipes inherit the
ingredient scores — a good recipe is mostly a good way to combine top ingredients.

1. **Nutritious.** High nutrient density per serving — protein, fibre,
   micronutrients, healthy fat. This is the point of the whole folder.
2. **Low effort.** Not just "quick to cook." Three things, in order:
   - **Active time** — hands-on minutes: chopping, cooking I have to watch, and
     cleanup (washing a blender counts; a one-pan dish barely does).
   - **Attention episodes** — how many separate times I have to come back. One
     continuous session is ideal. Anything that makes me tend it again an hour
     later is penalised even if each touch is short. (No "soak overnight, return
     in the morning.")
   - **Total elapsed time** — start to plate. I won't babysit something across
     four hours.
3. **Widely available.** Ingredients I can buy almost anywhere and cook with
   almost nothing:
   - **Ingredients** — on the shelf of an ordinary supermarket. Anchor to the UK,
     but weight toward things that are also common across the West and Asia.
     Don't optimise for places I'm unlikely to be soon (e.g. much of Africa).
   - **Equipment** — works in a basic Airbnb kitchen: one pot, one pan, a knife,
     a stove. No blender, no oven assumed, no specialised gadget.
4. **Tasty.** Genuinely good to eat. A strong bonus, chased hard — but not at the
   cost of the three above.

Price is not a principle. Don't optimise for cost; optimise for availability.

## Weighting: find the dominant criterion, don't average
The four principles are not weighted equally everywhere. For each category, name
the one that actually decides it and optimise hard for that; treat the rest as
constraints or tie-breakers, not equal votes. Default to *not* compromising — blend
criteria only where blending genuinely serves the goal.

Example: spices earn their place on **taste**, not nutrition — you eat a pinch, so
nutrient density is mostly noise. (Worth checking case by case: a few spices are
eaten by the spoonful and may be concentrated enough that nutrition counts — then
weight it, but only for those.)

## Layout
- `ingredients/` — the building blocks. `candidates/` holds the ranked options per
  category; `proven/` holds the ones I've settled on (with why), and
  `proven/README.md` is the core kit at a glance.
- `recipes/` — dishes, each scored against the four principles, built from
  top-ranked ingredients. Two folders: `proven/` (tested, in rotation) and
  `candidates/` (untested ideas, including workflow output). Promotion is manual.
- `workflow.md` — how to run the agent workflows that fill in the rankings and
  expand the recipe catalog.
- `prompt.md` — the raw voice-memo seed this started from.

## Working rules
- Score every ingredient and recipe against the four principles; don't add an
  entry without saying how it does on each.
- Keep entries short and scannable — one dish or one ingredient per file or row.
- Prefer a small set of repeated core ingredients (the `staples`) over variety
  for its own sake; the recipes should keep landing on the same handful.
- When a recipe needs equipment beyond pot/pan/knife, say so at the top.
- Recipes and ingredients both use a `candidates/` → `proven/` split. New items
  start in `candidates/`; I promote to `proven/` by hand — recipes once I've cooked
  one and it earns its place, ingredients once I've settled a category's go-tos.
  Never automatic.
- Mark anything generated but not yet checked as a draft.
