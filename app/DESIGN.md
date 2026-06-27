# meals app — design principles

The few rules the app is held to. Read this before changing it; add to it rather
than drifting from it. The whole point is a calm, phone-first kitchen companion
built from the `meals` snapshot — *Salt Fat Acid Heat* turned into software.

## Principles

1. **One screen, one idea.** Apple/iOS restraint: a small set of elements,
   applied consistently, lots of white space. Every new control must earn its
   place — when in doubt, leave it out. Resist choice points; the catalog is
   already curated, so the app should feel curated too.

2. **Diet first.** The first thing anyone picks is **vegan or non-vegan**. In
   vegan mode the app never shows an animal product — non-vegan-only recipes
   disappear, and recipes that adapt show their **vegan version** instead. The
   choice is sticky and changeable from the name chip.

3. **Phone-first summary.** Every recipe opens with an at-a-glance card that fits
   one phone screen: what it is, the ingredients with rough quantities, and the
   few main steps. Full method, level-ups and notes live below the fold.

4. **Everything links.** Tap an ingredient to see every recipe it's in, how to
   use it, and what to swap it for. Tap a recipe to reach its ingredients. No
   dead ends.

5. **Your kitchen, by name.** A **username** (no password) carries your basket
   and saved recipes across phone and computer. It shows small but always. Anyone
   who knows the name sees the same kitchen — that's the sharing model, on purpose.

6. **Basket → shopping list.** Add a recipe's ingredients to the basket in one
   tap; check off what you already have. Every item shows which recipe(s) it's
   for, overlapping ingredients merge into one line, and each recipe carries a
   **batch** count (×N) that annotates how much to buy. Seed the basket from two
   presets: the **Core kit** (minimal best-per-category) or the **Full list** (a
   week for two). The **Empty** action sits at the top, not buried at the bottom.
   *Amounts are the recipe's own ("2–3 handfuls"); batches multiply intent, not
   parsed quantities — true scaling would need structured amounts in the catalog.*

7. **Two depths, never more.** Where there's a "more/less," it's always the same
   two: **Core** (minimal, best-scoring) and **Full**. Recipes have a ⭐ **Best**
   filter (the straight-🟢🟢🟢🟢 picks); the shopping list has Core vs Full. No
   third tier.

8. **Built from a dated snapshot.** The app is generated from the markdown by
   `build.py`, stamped with the snapshot date. Authored content (ingredient tips,
   vegan variants) lives in `content/` overlays so a rebuild keeps it. Change a
   recipe or ingredient, rerun the build, and the app updates. See `README.md`.

## Shape of the app

- **Three places only:** Recipes · Ingredients · Basket. Saved recipes and the
  ⭐ Best / meal-time filters live *inside* Recipes, not as extra tabs.
- **Filters are light:** meal time (All · Breakfast · Mains) and ⭐ Best, plus
  search. Diet is global, not a per-list filter. The recipe-card score dots have
  a one-line legend so they read on landing.
- **Ingredients in a few groups:** six buckets, not fourteen, with a sticky chip
  bar at the top to jump straight to one — see everything without scrolling.
- **Light theme**, tuned so bars, cards and page are clearly distinct.
- **Name chip** sits top-corner everywhere; tap it to change name or diet.

## How the data flows

```
menu/*.md  ingredients/**  shopping-list.md  notes/using-spices.md   ← source of truth
        │
        ├─ content/ingredients.json   (authored: tips, swaps, storage)   ← overlays
        ├─ content/recipes.json       (authored: vegan status + variants)
        │
     build.py  ──────────────────────────────────────────────►  data.js  (+ manifest)
        │                                                            │
        └─ records snapshot date + source hashes                  index.html / app.js / styles.css
```

Nothing is written back to the markdown by the app. The markdown stays the
catalog; the app is a generated, regenerable view of it.

---

## Design suggestions — for review

These go beyond what was asked; tell me which to keep. Each is built or trivially
buildable on top of the structure above.

- **"Cook from your basket."** Once you've ticked off what you have, a recipe can
  show *what's missing* against your basket — turning the basket into a "what can
  I make right now?" filter. High value, low clutter (one line per recipe).
- **Best-picks as the default landing.** New users see the 12 ⭐ recipes first,
  not all 44 — curation over completeness, with "show all" one tap away.
- **No-cook / one-pan badges.** The catalog already tracks equipment and active
  time; a tiny "no-cook" or "one-pan" glyph on a card helps the no-kitchen case
  without adding a filter.
- **Snapshot banner when stale.** If the source markdown changes after the last
  build, show a quiet "catalog updated — rebuild" note (dev-only), so the app
  never silently drifts from the catalog.
- **Share sheet.** A recipe's URL already deep-links; an explicit "share" action
  (and a per-basket share link via the username) would make sending a shopping
  list to someone trivial.
- **Servings stepper.** Scale rough quantities ×1 / ×2 / ×4 on the recipe card.
  Useful, but adds a control — only if you want it.
