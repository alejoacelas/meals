# meals app

A calm, phone-first website for the `meals` catalog: browse recipes, tap an
ingredient to see where it's used and how to handle it, build a shopping basket,
and filter the whole thing to vegan or everything. Design rules live in
[`DESIGN.md`](DESIGN.md) — read that first if you're changing how it looks or feels.

## Run it
It's a static site — no build server, no dependencies.

```bash
# from this folder
python3 -m http.server 8765      # then open http://localhost:8765
```

Or just open `index.html` directly (it loads `data.js` via a script tag, so it
works from `file://` too).

## Use it
- **Land** → pick **vegan** or **everything**, type a **kitchen name**. The name
  shows top-right always and carries your basket + saved recipes. No password.
- **Recipes** → search, filter by **breakfast / mains**, or ⭐ **best** (the
  straight-🟢🟢🟢🟢 picks), plus **made** once you've cooked something. Each recipe
  opens with a one-screen summary; tap **▶ Start cooking** for step-by-step cook
  mode with timers and a quick review at the end.
- **Ingredients** → the proven kit by category; tap one for tips, swaps, storage,
  and every recipe it's in.
- **Basket** → add a recipe's shop in one tap, or seed it with the **Core kit**
  (minimal) or **Full list** (a week for two); scale recipe servings and check off
  what you already have.
- **Ask** → the floating mic button opens a command sheet with examples. Today it
  can preview and apply simple recipe-picking and basket actions locally; the
  same action shape is ready for a model-backed command endpoint.

Cross-device sync is optional — see [`sync/`](sync/). Without it, saves are
per-device.

## How it's built (and how to update it)
The app is **generated from the markdown snapshot** by [`build.py`](build.py):

```bash
python3 app/build.py     # reads the catalog → writes data.js (+ data.json)
```

```
menu/*.md  ingredients/**  shopping-list.md  notes/using-spices.md   ← source of truth
content/ingredients.json   content/recipes.json                      ← authored overlays
                          │
                       build.py  ───────────►  data.js   ← what the site loads
```

- **`data.js` / `data.json`** are generated artifacts (committed so the site needs
  no build step to serve). `data.js` is stamped with the snapshot date and the
  SHA of every source file under `snapshot.sources`.
- **`content/`** holds authored extras that aren't in the catalog markdown:
  per-ingredient tips/swaps/storage and per-recipe vegan variants. They're keyed
  by slug and merged on top of the parsed catalog, so a rebuild keeps them.

### When the catalog changes
Edit a recipe or ingredient in the markdown as usual, then:

1. `python3 app/build.py` — regenerates `data.js`. New recipes/ingredients appear
   automatically; new ingredient *names* may need a keyword in `build.py`'s
   `WIRING` list so recipes link to them (the build prints any that didn't link).
2. The new content has no tips/vegan-variant yet. Regenerate just those via the
   content workflow (it writes `content/*.json`), or hand-edit the JSON.
3. Rebuild again, commit `data.js` + `content/`.

`snapshot.date` / `snapshot.sources` in `data.js` record exactly which catalog the
current app was built from — so it's always clear when the app has drifted from
the markdown and what to re-run.

## Deploy (GitHub Pages)
The repo is public on GitHub, so the cheapest host is Pages:

- Settings → Pages → deploy from `main`, folder `/meals/app` (or move `app/` to a
  `docs/` path / `gh-pages` branch if you prefer). It's pure static files.
- For cross-device sync, also deploy the worker in [`sync/`](sync/) and paste its
  URL into `config.js`.

## Files
| File | What |
|---|---|
| `index.html` · `styles.css` · `app.js` | the app (vanilla JS, no framework) |
| `config.js` | the sync endpoint (empty = per-device) |
| `build.py` | catalog markdown → `data.js` |
| `data.js` · `data.json` | generated data (+ snapshot manifest) |
| `content/` | authored overlays (tips, swaps, vegan variants) |
| `sync/` | optional cross-device backend |
| `DESIGN.md` | the design principles |
