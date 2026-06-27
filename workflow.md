# Meals Workflow Plan

*Drafted 2026-06-27. Launch from a fresh session when ready. Needs an explicit
go-ahead — these are multi-agent runs.*

---

## Philosophy
Quality over speed. Use Opus for judgement-heavy stages (scoring, taste/effort
realism). Web-search for current nutrition and availability facts rather than
guessing. Every ingredient and recipe carries a one-line rationale per principle.

Anchor availability on UK supermarkets; weight toward things also common across
the West and East/South-East Asia; don't reward what's only found in regions I'm
unlikely to visit soon.

## Scoring rubric (shared by both workflows)
Score each item on the four principles, 🟢 / 🟡 / 🔴:
- **Nutrition** — nutrient density; name the standout nutrients.
- **Effort** — active minutes, number of attention episodes, total elapsed time.
- **Availability** — UK-anchored, West + Asia weighted; plus equipment (does it
  need more than pot/pan/knife?).
- **Taste** — honest, with the obvious flavour levers.

**Don't average — name the dominant criterion.** For each category, say which
principle actually decides it and rank on that; the others are constraints or
tie-breakers. Don't let an irrelevant one drag an item down (spices are judged on
taste, not nutrition — unless one is eaten in large enough amounts to matter).

**Table format.** Columns in scan order: `Rank · Ingredient · Why here ·
Versatility · Prep effort · Availability · Nutrition`. Write each `Notes:` block as
a short bulleted list of the final caveats only — no correction logs, no sources dump.

---

## Workflow A — Rank the ingredients
Goal: a ranked table per category (into `ingredients/candidates/`), plus a curated
core kit that seeds `ingredients/proven/README.md`.

Categories (one agent each): vegetables · fruits · legumes & beans · other
proteins (eggs, tinned fish, tofu, dairy) · grains & starches · oils & fats ·
acids · aromatics · spices & dried herbs.

Pipeline per category:
1. **Rank (Opus).** Propose the strong candidates in the category, web-check
   nutrition and UK/global availability, return a ranked table:
   `ingredient | nutrition | availability | prep-effort | versatility | why-here`
   (why-here = one sentence on its placement).
2. **Verify (Opus, adversarial).** Challenge the table: any nutrition overclaim,
   any item actually hard to find outside the UK, anything mis-ranked? Return
   corrections, which are folded in.

Then one **synthesis** agent reads all verified tables and produces the recommended
kit (seeding `ingredients/proven/README.md`) —
the minimal kit, *Salt Fat Acid Heat* style: the one oil, the core acids, the
aromatic base, and a short spice set, each justified from the rankings. It also
answers the standing question: is there an equally-available, equally-healthy
alternative to olive oil, or does olive oil stay the one oil?

## Workflow B — Build the recipe catalog
Goal: ~15–20 core recipes that score well on all four principles and keep reusing
the staples.

1. **Generate (parallel, diverse lenses).** Each agent proposes recipes from a
   different angle — one-pan, no-cook, ≤10-minute, batch-cookable, high-protein —
   drawing only on top-ranked ingredients and the pot/pan/knife constraint.
2. **Score** each candidate against the rubric.
3. **Verify (adversarial).** Is it actually low-attention? Actually tasty?
   Actually all-supermarket? Kill the ones that fail.
4. **Dedup & keep** the winners; loop until the catalog hits the target with two
   consecutive rounds finding nothing new.

New recipes are written to `recipes/candidates/`, scored but untested. The seed
recipes I already make live in `recipes/proven/` and set the format. Promotion
from candidate to proven is always manual — the workflow never writes to
`proven/`.

---

## After the workflows
1. Skim the ranked tables and the catalog; flag anything off.
2. Promote the go-tos into `ingredients/proven/` per category — the shortlist I actually shop from.
3. Cook a few of the new recipes and note what's real.
