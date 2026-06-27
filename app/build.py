#!/usr/bin/env python3
"""Build the meals app data from the markdown snapshot.

Reads the catalog (menu/*.md, ingredients/**, shopping-list.md, notes/using-spices.md),
merges authored overlays from content/, and writes data.js — a single
`window.MEALS_DATA = {...}` the static site loads with a <script> tag (so it works
opened straight from disk and on GitHub Pages alike).

Run:  python3 app/build.py        (from the repo root, or anywhere — paths are resolved)
See app/README.md for the snapshot/regeneration story.
"""

import hashlib
import json
import re
import sys
from datetime import date, datetime, timezone
from pathlib import Path

APP = Path(__file__).resolve().parent
ROOT = APP.parent
MENU = ROOT / "menu"
ING = ROOT / "ingredients"
CONTENT = APP / "content"

SCORE = {"🟢": "great", "🟡": "ok", "🔴": "weak"}

# Ingredients whose presence in a recipe's *core* list makes it non-vegan.
ANIMAL = ["egg", "yoghurt", "yogurt", "sardine", "mackerel", "honey", "fish sauce"]

# Recipe "type" (from the catalog index) -> meal time. Only these two types are
# breakfast; everything else is a main (lunch/dinner). Keeps the filter binary.
BREAKFAST_TYPES = {"Eggs & breakfast", "Porridge & breakfast bowls"}

# ----------------------------------------------------------------------------
# Ingredient catalog: keywords map a recipe's free-text ingredient to a slug.
# Order matters — compound/specific keys are checked before generic ones, so
# "black pepper" wins over "pepper" and "garlic granules" over "garlic".
# vegan=False marks animal products; core=True marks the minimal best-per-category
# kit. Names/blurbs are parsed from the proven files; this is just the wiring.
# ----------------------------------------------------------------------------
# Listed most-specific first; first keyword hit wins.
WIRING = [
    # (slug, [keywords], vegan, core)
    ("fish-sauce",          ["fish sauce"],                           False, False),
    ("black-pepper",        ["black pepper"],                         True,  True),
    ("chilli-flakes",       ["chilli flake", "chili flake", "red pepper flake", "chilli", "chili"], True, False),
    ("bell-pepper",         ["bell pepper", "peppers", "red pepper", "pepper"], True, False),
    ("garlic-granules",     ["garlic granule", "garlic powder"],      True,  False),
    ("tomato-puree",        ["tomato purée", "tomato puree", "tomato paste"], True, False),
    ("greek-yoghurt",       ["greek yoghurt", "greek yogurt", "yoghurt", "yogurt", "greek"], False, False),
    ("pak-choi",            ["pak choi", "pak choy", "bok choy"],     True,  False),
    ("olive-oil",           ["olive oil", "extra-virgin", "extra virgin"], True, True),
    ("rapeseed-oil",        ["rapeseed", "canola"],                   True,  False),
    ("soy-sauce",           ["soy"],                                  True,  False),
    ("red-wine-vinegar",    ["red wine vinegar", "wine vinegar", "vinegar"], True, False),
    ("ground-coriander",    ["coriander"],                            True,  False),
    ("curry-powder",        ["curry powder", "curry"],                True,  False),
    ("smoked-paprika",      ["smoked paprika", "paprika"],            True,  False),
    ("ground-ginger",       ["ginger"],                               True,  False),
    ("ground-cumin",        ["cumin"],                                True,  True),
    ("turmeric",            ["turmeric"],                             True,  False),
    ("oregano",             ["oregano"],                              True,  False),
    ("cinnamon",            ["cinnamon"],                             True,  False),
    ("bay-leaves",          ["bay leaf", "bay leaves", "bay"],        True,  False),
    ("peanut-butter",       ["peanut"],                               True,  True),
    ("almonds",             ["almond"],                               True,  False),
    ("pumpkin-seeds",       ["pumpkin seed", "pumpkin"],              True,  False),
    ("ground-flaxseed",     ["flax"],                                 True,  False),
    ("chia-seeds",          ["chia"],                                 True,  False),
    ("rolled-oats",         ["rolled oats", "oats", "oat"],           True,  True),
    ("pasta",               ["pasta", "fusilli", "penne"],            True,  True),
    ("red-split-lentils",   ["red split lentil", "split lentil", "lentil"], True, False),
    ("canned-chickpeas",    ["chickpea"],                             True,  True),
    ("firm-tofu",           ["tofu"],                                 True,  True),
    ("hummus",              ["hummus"],                               True,  False),
    ("eggs",                ["egg"],                                  False, True),
    ("tinned-sardines",     ["sardine"],                              False, False),
    ("tinned-mackerel",     ["mackerel"],                             False, False),
    ("spinach",             ["spinach"],                              True,  True),
    ("frozen-peas",         ["pea"],                                  True,  False),
    ("tomato",              ["tomato"],                               True,  True),
    ("mushroom",            ["mushroom"],                             True,  False),
    ("broccoli",            ["broccoli"],                             True,  False),
    ("carrot",              ["carrot"],                               True,  False),
    ("cabbage",             ["cabbage"],                              True,  False),
    ("kale",                ["kale"],                                 True,  False),
    ("garlic",              ["garlic"],                               True,  True),
    ("onion",               ["onion"],                                True,  True),
    ("banana",              ["banana"],                               True,  True),
    ("avocado",             ["avocado"],                              True,  False),
    ("strawberries",        ["strawberr"],                            True,  False),
    ("frozen-mixed-berries",["berr"],                                 True,  False),
    ("orange",              ["orange", "clementine"],                 True,  False),
    ("apple",               ["apple"],                                True,  False),
    ("grapes",              ["grape"],                                True,  False),
    ("seeded-bread",        ["seeded", "wholemeal bread", "bread", "toast"], True, True),
    ("wholemeal-wrap",      ["wrap", "tortilla"],                     True,  False),
    ("wholemeal-pita",      ["pita"],                                 True,  False),
    ("stock-paste",         ["stock", "bouillon"],                    True,  False),
    ("miso",                ["miso"],                                 True,  False),
    ("fine-sea-salt",       ["sea salt", "salt"],                     True,  True),
    ("lemon",               ["lemon"],                                True,  True),
]

# Words that name no catalog ingredient (don't report them as unlinked).
IGNORE = {"water", "a squeeze of fresh lemon"}
KW = [(slug, kws) for (slug, kws, _, _) in WIRING]
VEGAN_ING = {slug: v for (slug, _, v, _) in WIRING}
CORE_ING = {slug for (slug, _, _, c) in WIRING if c}

CATEGORY_LABELS = {
    "oils-and-fats": "Oils & fats",
    "aromatics": "Aromatics",
    "grains-and-starches": "Grains & starches",
    "acids": "Acids",
    "vegetables": "Vegetables",
    "fruits": "Fruits",
    "legumes-and-beans": "Legumes & beans",
    "other-proteins": "Proteins",
    "nuts-and-seeds": "Nuts & seeds",
    "nutrition-powerhouses": "Nutrition add-ons",
    "bread-and-wraps": "Bread & wraps",
    "condiments-and-umami": "Condiments & umami",
    "spices-and-dried-herbs": "Spices & dried herbs",
    "seasoning": "Seasoning",
}
# Order categories the way a shop / a cook scans them.
CATEGORY_ORDER = [
    "vegetables", "fruits", "legumes-and-beans", "other-proteins",
    "grains-and-starches", "bread-and-wraps", "nuts-and-seeds",
    "nutrition-powerhouses", "oils-and-fats", "acids", "aromatics",
    "condiments-and-umami", "spices-and-dried-herbs", "seasoning",
]

# Coarse groups for the Ingredients view — fewer, scannable buckets. The fine
# category is kept on each ingredient (basket aisle, page tag); these just group
# the list. Order within a group follows CATEGORY_ORDER above.
GROUP_OF = {
    "vegetables": "veg",
    "fruits": "fruit",
    "legumes-and-beans": "protein", "other-proteins": "protein",
    "grains-and-starches": "grains", "bread-and-wraps": "grains",
    "nuts-and-seeds": "nuts", "nutrition-powerhouses": "nuts",
    "oils-and-fats": "pantry", "acids": "pantry", "aromatics": "pantry",
    "condiments-and-umami": "pantry", "spices-and-dried-herbs": "pantry",
    "seasoning": "pantry",
}
GROUP_ORDER = ["veg", "fruit", "protein", "grains", "nuts", "pantry"]
GROUP_LABELS = {
    "veg": "Vegetables", "fruit": "Fruit", "protein": "Proteins & beans",
    "grains": "Grains & bread", "nuts": "Nuts & seeds",
    "pantry": "Oils, acids & seasoning",
}


def slugify(name):
    s = name.lower()
    s = re.sub(r"\(.*?\)", "", s)            # drop parentheticals
    s = s.split(" — ")[0].split(" / ")[0]    # first of a paired name
    s = re.sub(r"[^a-z0-9]+", "-", s).strip("-")
    return s


def read(path):
    return path.read_text(encoding="utf-8")


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()[:12]


# ----------------------------------------------------------------------------
# Recipes
# ----------------------------------------------------------------------------
def parse_recipe(path, index_meta):
    text = read(path)
    slug = path.stem
    lines = text.splitlines()

    title = lines[0].lstrip("# ").strip()

    scoreline = next((l for l in lines if l.startswith("**Nutrition**")), "")
    def s(label):
        m = re.search(rf"\*\*{label}\*\*\s*([🟢🟡🔴])", scoreline)
        return SCORE.get(m.group(1)) if m else None
    scores = {k: s(k.capitalize()) for k in ["nutrition", "effort", "availability", "taste"]}

    def num(pat):
        m = re.search(pat, scoreline)
        return int(m.group(1)) if m else None
    active = num(r"active ~?(\d+)\s*m")
    total = num(r"~?(\d+)\s*m total")
    sessions = num(r"(\d+)\s*session")

    def field(label):
        m = re.search(rf"\*\*{label}:\*\*\s*(.+)", text)
        return m.group(1).strip() if m else ""
    equipment = field("Equipment")
    serves = field("Serves")

    # at-a-glance table rows
    def cell(label):
        m = re.search(rf"\|\s*\*\*{re.escape(label)}\*\*\s*\|\s*(.+?)\s*\|", text)
        return m.group(1).strip() if m else ""
    core_line = cell("Core ingredients")
    time_line = cell("Time")
    steps_line = cell("Steps")
    core_ings = [c.strip() for c in re.split(r"[,;]", core_line) if c.strip()]

    # blurb: paragraph between the at-a-glance table and "### Core recipe"
    blurb = ""
    m = re.search(r"\|\s*\*\*Steps\*\*.*?\|\s*\n+(.*?)\n+###", text, re.S)
    if m:
        blurb = " ".join(l.strip() for l in m.group(1).splitlines() if l.strip())

    # core recipe ingredients + method
    core_block = section(text, "### Core recipe", ("### Level it up", "**Why it scores"))
    ingredients = bullets(between(core_block, "**Ingredients**", "**Method**"))
    method = ordered(between(core_block, "**Method**", None))

    level_up = bullets(section(text, "### Level it up", ("**Why it scores",)))

    why = ""
    m = re.search(r"\*\*Why it scores well:?\*\*\s*(.+)", text, re.S)
    if m:
        why = " ".join(l.strip() for l in m.group(1).splitlines() if l.strip())

    # link ingredients from the core list
    uses = []
    for phrase in core_ings:
        slug_match = match_ingredient(phrase)
        if slug_match and slug_match not in uses:
            uses.append(slug_match)

    meta = index_meta.get(slug, {})
    rtype = meta.get("type", "")
    vegan_base = not any(a in core_line.lower() for a in ANIMAL)

    return {
        "slug": slug,
        "title": title,
        "scores": scores,
        "activeMin": active,
        "totalMin": total,
        "sessions": sessions,
        "equipment": equipment,
        "serves": serves,
        "type": rtype,
        "meal": "breakfast" if rtype in BREAKFAST_TYPES else "main",
        "best": scores["nutrition"] == "great" and scores["effort"] == "great" and scores["taste"] == "great",
        "eats": meta.get("eats", ""),
        "summary": {"coreIngredients": core_ings, "time": time_line, "steps": steps_line},
        "blurb": blurb,
        "ingredients": ingredients,
        "method": method,
        "levelUp": level_up,
        "why": why,
        "uses": uses,
        # vegan fields are refined by the overlay; this is the baseline.
        "veganStatus": "vegan" if vegan_base else "animal",
    }


def section(text, start, ends):
    """Text from `start` heading up to the first of `ends` markers (or EOF)."""
    i = text.find(start)
    if i < 0:
        return ""
    i += len(start)
    j = len(text)
    for e in ends:
        k = text.find(e, i)
        if 0 <= k < j:
            j = k
    return text[i:j]


def between(block, start, end):
    i = block.find(start)
    if i < 0:
        return ""
    i += len(start)
    j = block.find(end, i) if end else len(block)
    if j < 0:
        j = len(block)
    return block[i:j]


def bullets(block):
    out = []
    for l in block.splitlines():
        l = l.strip()
        if l.startswith("- "):
            out.append(l[2:].strip())
    return out


def ordered(block):
    out = []
    for l in block.splitlines():
        l = l.strip()
        m = re.match(r"^\d+\.\s+(.*)", l)
        if m:
            out.append(m.group(1).strip())
    return out


def match_ingredient(phrase):
    p = phrase.lower()
    for slug, kws in KW:
        for kw in kws:
            if kw in p:
                return slug
    return None


def parse_index(path):
    """Pull {slug: {type, eats}} from the catalog index 'All recipes' table."""
    text = read(path)
    meta = {}
    for m in re.finditer(r"\|\s*\[[^\]]+\]\(([^)]+)\.md\)\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|", text):
        slug, rtype, eats = m.group(1), m.group(2).strip(), m.group(3).strip()
        meta[slug] = {"type": rtype, "eats": eats}
    return meta


# ----------------------------------------------------------------------------
# Ingredients
# ----------------------------------------------------------------------------
def dominant(text):
    m = re.search(r"\*\*Dominant criterion:?\*\*\s*(.+?)(?:\n\n|\Z)", text, re.S)
    if not m:
        return ""
    return " ".join(l.strip() for l in m.group(1).splitlines() if l.strip())


def parse_table_ingredients(text, category):
    rows = []
    for line in text.splitlines():
        if not line.strip().startswith("|"):
            continue
        cells = [c.strip() for c in line.strip().strip("|").split("|")]
        if cells[0].lower() in ("rank", "ingredient") or set(cells[0]) <= set("-: "):
            continue  # header or separator
        # Proven tables: | Rank | Ingredient | Why here | Vers | Prep | Avail | Nutrition |
        if cells[0].isdigit() and len(cells) >= 7:
            name, why, vers, prep, avail, nutr = cells[1:7]
        elif len(cells) >= 6:  # rank-less fallback
            name, why, vers, prep, avail, nutr = cells[:6]
        else:
            continue
        if not name or set(name) <= set("-: "):
            continue
        rows.append(make_ingredient(name, why, category, vers, prep, avail, nutr))
    return rows


def parse_prose_ingredients(text, category):
    rows = []
    for chunk in re.split(r"\n## ", "\n" + text)[1:]:
        head = chunk.splitlines()[0].strip()
        name = re.sub(r"^\d+\.\s*", "", head).split(" — ")[0].strip()
        m = re.search(r"\*\*Why proven:?\*\*\s*(.+?)(?:\n-|\n\n|\Z)", chunk, re.S)
        why = " ".join(l.strip() for l in (m.group(1).splitlines() if m else []) if l.strip())
        rows.append(make_ingredient(name, why, category))
    return rows


def make_ingredient(name, why, category, vers="", prep="", avail="", nutr=""):
    # Resolve to the canonical slug recipes link against, so parsed names/scores
    # attach to the same record (no duplicates). Fall back to a derived slug.
    slug = match_ingredient(name) or slugify(name)
    return {
        "slug": slug,
        "name": name,
        "category": category,
        "why": why.strip(),
        "versatility": SCORE.get(first_emoji(vers), None),
        "prepEffort": SCORE.get(first_emoji(prep), None),
        "availability": SCORE.get(first_emoji(avail), None),
        "nutrition": SCORE.get(first_emoji(nutr), None),
        "nutritionNote": strip_emoji(nutr).strip(),
    }


def first_emoji(s):
    for ch in s:
        if ch in SCORE:
            return ch
    return ""


def strip_emoji(s):
    return re.sub(r"[🟢🟡🔴]", "", s).strip()


def parse_ingredients():
    proven = ING / "proven"
    catalog = {}
    cat_desc = {}
    for path in sorted(proven.glob("*.md")):
        if path.stem == "README":
            continue
        category = path.stem
        text = read(path)
        cat_desc[category] = dominant(text)
        if re.search(r"\|\s*Rank\s*\|", text) or re.search(r"\|\s*Ingredient\s*\|", text):
            rows = parse_table_ingredients(text, category)
        else:
            rows = parse_prose_ingredients(text, category)
        for r in rows:
            catalog[r["slug"]] = r

    # Aromatics file is "Garlic + onion" as one prose entry — split it in two.
    base = catalog.get("garlic")
    if base and "+" in base.get("name", ""):
        for nm, sl in [("Garlic", "garlic"), ("Onion", "onion")]:
            catalog[sl] = {**base, "slug": sl, "name": nm, "category": "aromatics"}

    # Salt isn't in a proven file yet — add it (recipes season with it).
    catalog.setdefault("fine-sea-salt", {
        "slug": "fine-sea-salt", "name": "Fine sea salt", "category": "seasoning",
        "why": "The baseline seasoning. Salt to taste as you cook, and again at the end; "
               "it's the one core category still pending a formal review.",
        "versatility": "great", "prepEffort": "great", "availability": "great",
        "nutrition": None, "nutritionNote": "",
    })

    # Make sure every slug the wiring references exists, even if a name didn't
    # parse cleanly (keeps recipe links from dangling).
    names = {
        "olive-oil": ("Extra virgin olive oil", "oils-and-fats"),
        "rapeseed-oil": ("Rapeseed / canola oil", "oils-and-fats"),
        "pasta": ("Pasta (fusilli / penne)", "grains-and-starches"),
        "rolled-oats": ("Rolled oats", "grains-and-starches"),
        "lemon": ("Fresh lemon", "acids"),
        "red-wine-vinegar": ("Red wine vinegar", "acids"),
        "ground-cumin": ("Ground cumin", "spices-and-dried-herbs"),
        "black-pepper": ("Black pepper", "spices-and-dried-herbs"),
        "chilli-flakes": ("Chilli / red pepper flakes", "spices-and-dried-herbs"),
        "garlic-granules": ("Garlic granules", "spices-and-dried-herbs"),
        "smoked-paprika": ("Smoked paprika", "spices-and-dried-herbs"),
        "turmeric": ("Ground turmeric", "spices-and-dried-herbs"),
        "oregano": ("Dried oregano", "spices-and-dried-herbs"),
        "ground-coriander": ("Ground coriander", "spices-and-dried-herbs"),
        "curry-powder": ("Curry powder", "spices-and-dried-herbs"),
        "cinnamon": ("Ground cinnamon", "spices-and-dried-herbs"),
        "ground-ginger": ("Ground ginger", "spices-and-dried-herbs"),
        "bay-leaves": ("Bay leaves", "spices-and-dried-herbs"),
        "seeded-bread": ("Wholemeal / seeded bread", "bread-and-wraps"),
        "wholemeal-wrap": ("Wholemeal wrap", "bread-and-wraps"),
        "wholemeal-pita": ("Wholemeal pita", "bread-and-wraps"),
        "soy-sauce": ("Soy sauce", "condiments-and-umami"),
        "tomato-puree": ("Tomato purée", "condiments-and-umami"),
        "stock-paste": ("Stock / bouillon paste", "condiments-and-umami"),
        "miso": ("Miso", "condiments-and-umami"),
        "fish-sauce": ("Fish sauce", "condiments-and-umami"),
        "canned-chickpeas": ("Canned chickpeas", "legumes-and-beans"),
        "red-split-lentils": ("Red split lentils", "legumes-and-beans"),
        "frozen-mixed-berries": ("Frozen mixed berries", "fruits"),
        "ground-flaxseed": ("Ground flaxseed", "nutrition-powerhouses"),
        "chia-seeds": ("Chia seeds", "nutrition-powerhouses"),
        "pumpkin-seeds": ("Pumpkin seeds", "nuts-and-seeds"),
        "peanut-butter": ("Peanut butter", "nuts-and-seeds"),
        "greek-yoghurt": ("Greek yoghurt", "other-proteins"),
        "tinned-sardines": ("Tinned sardines", "other-proteins"),
        "tinned-mackerel": ("Tinned mackerel", "other-proteins"),
        "firm-tofu": ("Firm tofu", "other-proteins"),
        "eggs": ("Eggs", "other-proteins"),
        "hummus": ("Hummus", "other-proteins"),
        "pak-choi": ("Pak choi", "vegetables"),
        "bell-pepper": ("Bell pepper", "vegetables"),
        "frozen-peas": ("Frozen peas", "vegetables"),
        "orange": ("Orange / clementine", "fruits"),
    }
    for slug, (nm, cat) in names.items():
        if slug not in catalog:
            catalog[slug] = {
                "slug": slug, "name": nm, "category": cat, "why": "",
                "versatility": None, "prepEffort": None, "availability": None,
                "nutrition": None, "nutritionNote": "",
            }

    # flags
    for slug, ing in catalog.items():
        ing["vegan"] = VEGAN_ING.get(slug, True)
        ing["core"] = slug in CORE_ING
    return catalog, cat_desc


# ----------------------------------------------------------------------------
# Shopping list (the "Full" preset) + spice notes
# ----------------------------------------------------------------------------
def parse_shopping_list():
    text = read(ING / "shopping-list.md")
    groups = []
    cur = None
    for line in text.splitlines():
        h = re.match(r"^##\s+(.*)", line)
        if h:
            title = h.group(1).strip()
            if title.lower().startswith("a week of meals"):
                cur = None
                continue
            cur = {"title": title, "items": []}
            groups.append(cur)
        elif cur is not None:
            b = re.match(r"^-\s+(.*)", line.strip())
            if b:
                cur["items"].append(b.group(1).strip())
    return groups


def parse_spice_notes():
    return read(ING / "notes" / "using-spices.md")


# ----------------------------------------------------------------------------
# Overlays
# ----------------------------------------------------------------------------
def load_overlay(name):
    p = CONTENT / name
    if not p.exists():
        return {}
    data = json.loads(read(p))
    # accept either {"items":[...]} or a bare list or {slug: {...}}
    if isinstance(data, dict) and "items" in data:
        data = data["items"]
    if isinstance(data, list):
        return {d["slug"]: d for d in data if "slug" in d}
    return data


# ----------------------------------------------------------------------------
# Main
# ----------------------------------------------------------------------------
def main():
    if not MENU.exists():
        sys.exit(f"menu/ not found at {MENU}")

    index_meta = parse_index(MENU / "README.md")
    recipes = []
    for path in sorted(MENU.glob("*.md")):
        if path.stem == "README":
            continue
        recipes.append(parse_recipe(path, index_meta))

    ingredients, cat_desc = parse_ingredients()

    # who-uses-what (reverse links)
    used_in = {slug: [] for slug in ingredients}
    for r in recipes:
        for slug in r["uses"]:
            if slug in used_in:
                used_in[slug].append(r["slug"])
    for slug, ing in ingredients.items():
        ing["usedIn"] = used_in.get(slug, [])

    # merge overlays
    ing_overlay = load_overlay("ingredients.json")
    rec_overlay = load_overlay("recipes.json")
    for slug, ing in ingredients.items():
        ov = ing_overlay.get(slug)
        if ov:
            for k in ("summary", "tips", "swaps", "storage"):
                if ov.get(k):
                    ing[k] = ov[k]
    for r in recipes:
        ov = rec_overlay.get(r["slug"])
        if ov:
            if ov.get("veganStatus"):
                r["veganStatus"] = ov["veganStatus"]
            if ov.get("veganVariant"):
                r["veganVariant"] = ov["veganVariant"]

    # order ingredients by category, core-first within category
    def ing_sort_key(ing):
        try:
            ci = CATEGORY_ORDER.index(ing["category"])
        except ValueError:
            ci = len(CATEGORY_ORDER)
        return (ci, 0 if ing["core"] else 1, ing["name"].lower())
    ing_list = sorted(ingredients.values(), key=ing_sort_key)

    # coarse groups for the ingredients view (ing_list is already in fine order)
    groups = []
    for g in GROUP_ORDER:
        items = [i["slug"] for i in ing_list if GROUP_OF.get(i["category"]) == g]
        if items:
            groups.append({"slug": g, "label": GROUP_LABELS[g], "items": items})

    # snapshot manifest
    sources = []
    for p in sorted(MENU.glob("*.md")) + sorted((ING).rglob("*.md")):
        sources.append({"path": str(p.relative_to(ROOT)), "sha": sha(p)})

    data = {
        "snapshot": {
            "date": str(date(2026, 6, 27)),       # snapshot the app was built from
            "builtAt": datetime.now(timezone.utc).replace(microsecond=0).isoformat(),
            "recipeCount": len(recipes),
            "ingredientCount": len(ing_list),
            "sources": sources,
        },
        "recipes": recipes,
        "ingredients": ing_list,
        "groups": groups,
        "categoryLabels": CATEGORY_LABELS,
        "coreKit": [i["slug"] for i in ing_list if i["core"]],
        "shoppingList": parse_shopping_list(),
        "spiceNotes": parse_spice_notes(),
    }

    out = APP / "data.js"
    out.write_text(
        "// Generated by build.py — do not edit. Rerun: python3 app/build.py\n"
        "window.MEALS_DATA = " + json.dumps(data, ensure_ascii=False, indent=1) + ";\n",
        encoding="utf-8",
    )
    # also emit data.json for any other tooling
    (APP / "data.json").write_text(json.dumps(data, ensure_ascii=False, indent=1), encoding="utf-8")

    # report
    linked = sum(len(r["uses"]) for r in recipes)
    unmatched = set()
    for r in recipes:
        for phrase in r["summary"]["coreIngredients"]:
            if not match_ingredient(phrase) and phrase.lower() not in IGNORE:
                unmatched.add(phrase)
    print(f"✓ {len(recipes)} recipes, {len(ing_list)} ingredients, {linked} recipe→ingredient links")
    print(f"✓ wrote {out.relative_to(ROOT)} and data.json")
    if unmatched:
        print(f"  note: {len(unmatched)} core-ingredient phrases didn't link: {sorted(unmatched)}")


if __name__ == "__main__":
    main()
