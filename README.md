<!--ai-->
# meals — nutritious food, fast, anywhere
<!--/ai-->

<!--ai-->
A catalog of meals and the ingredients they're built from, chosen so I can eat
well with little effort in whatever kitchen I land in. Everything here is judged
against the same four principles, so a good recipe is mostly a good way to combine
top-ranked ingredients.
<!--/ai-->

<!--ai-->
## The four principles
1. **Nutritious.** High nutrient density per serving — protein, fibre,
   micronutrients, healthy fat. This is the point of the whole folder.
2. **Low effort.** Not just "quick to cook." Three things, in order:
   - **Active time** — hands-on minutes: chopping, cooking I have to watch, and
     cleanup (washing a blender counts; a one-pan dish barely does).
   - **Attention episodes** — how many separate times I have to come back. One
     continuous session is ideal; "soak overnight, return in the morning" is not.
   - **Total elapsed time** — start to plate. I won't babysit something across
     four hours.
3. **Widely available.** Ingredients on the shelf of an ordinary supermarket —
   anchored to the UK, weighted toward what's also common across the West and Asia.
   And equipment that works in a basic Airbnb kitchen: one pot, one pan, a knife, a
   stove. No blender, no oven assumed, no special gadget.
4. **Tasty.** Genuinely good to eat. A strong bonus, chased hard — but not at the
   cost of the three above.
<!--/ai-->

<!--ai-->
Price is not a principle. Don't optimise for cost; optimise for availability.
<!--/ai-->

<!--ai-->
### Don't average — find the dominant criterion
The four aren't weighted equally everywhere. For each category, name the one that
actually decides it and optimise hard for that; treat the rest as constraints or
tie-breakers. Spices, for instance, earn their place on **taste**, not nutrition —
you eat a pinch, so nutrient density is mostly noise.
<!--/ai-->

<!--ai-->
## How it's organized
- **`ingredients/`** — the building blocks, ranked, using a `candidates/` → `proven/`
  split; promotion between them is always **by hand**.
  - `candidates/` — the full research: a scored, ranked table per category.
  - `proven/` — the go-tos I've settled on, with why. `proven/README.md` is the
    core kit at a glance.
  - `shopping-list.md` — a week's shop for two, built from the proven kit.
- **`menu/`** — every dish, in one folder, each scored against the four principles.
  The core version of each cooks from the proven kit alone; widely-available extras
  are flagged as optional level-ups. `menu/README.md` is the browsable index, led by
  the top picks. **✓ marks the ones I've actually cooked** (my own, or worked out
  with friends); the rest are scored ideas I haven't made yet.
<!--/ai-->

<!--ai-->
## What's in it right now
<!--/ai-->

<!--ai-->
**The core kit** (`ingredients/proven/README.md`) — settled by flavour role,
*Salt Fat Acid Heat* style:
<!--/ai-->

<!--ai-->
| Role | Pick |
|---|---|
| Fat / oil | Extra virgin olive oil + rapeseed/canola |
| Aromatic base | Garlic + onion |
| Grain / starch | Pasta (fusilli, penne) + rolled oats |
| Acid | Fresh lemon + red wine vinegar |
| Heat / spice | A starter rack — cumin, black pepper, chilli, paprika, turmeric… |
<!--/ai-->

<!--ai-->
…plus the proven whole foods the meals lean on: spinach, kale, tomato, mushroom,
pepper, broccoli, carrot, cabbage, pak choi; chickpeas and red lentils; eggs, Greek
yoghurt, tinned sardines and mackerel, tofu, hummus.
<!--/ai-->

<!--ai-->
**The menu** (`menu/`) — 44 scored dishes in one folder, all built so the core
version cooks from the proven kit alone, with widely-available extras flagged as
optional level-ups. The [menu index](menu/README.md) leads with the top picks — the
ones that land 🟢 on nutrition, effort *and* taste at once. **✓ marks the two I've
actually cooked:** spinach, tomato & chickpeas (the staple; one pan, ~15 min, good
even unspiced) and kale & mushroom sauté (in rotation, still iterating).
<!--/ai-->

<!--ai-->
## How I use it
Shop from `ingredients/shopping-list.md` and cook from the `menu/`; when a dish earns
its place I mark it ✓. The four principles in this README are the standard everything
is held to; `CLAUDE.md` holds the conventions for adding entries.
<!--/ai-->

<!--ai-->
---
<!--/ai-->

<!--ai-->
*The ingredient rankings and the recipe catalog were produced by a one-off
multi-agent research pass (web-checked nutrition and availability, adversarial
scoring). That build plan and the original voice-memo seed are archived at
`~/archive/best/meals/`; restore the plan there if you want to refresh the rankings.*
<!--/ai-->
