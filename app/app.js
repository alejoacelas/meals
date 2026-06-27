/* meals — phone-first kitchen. Vanilla JS, no build step. Reads window.MEALS_DATA
   (built by build.py) and window.MEALS_CONFIG (sync endpoint, optional). */
(function () {
  "use strict";
  const D = window.MEALS_DATA;
  const CFG = window.MEALS_CONFIG || {};
  const SYNC = (CFG.syncUrl || "").replace(/\/+$/, "");

  // ---- lookups ----
  const recBySlug = Object.fromEntries(D.recipes.map(r => [r.slug, r]));
  const ingBySlug = Object.fromEntries(D.ingredients.map(i => [i.slug, i]));
  const catLabel = Object.assign({ seasoning: "Seasoning" }, D.categoryLabels || {});
  const ANIMAL_WORDS = ["egg", "yoghurt", "yogurt", "sardine", "mackerel", "fish sauce", "honey", "greek"];

  // ---- state ----
  // basket: { id: {label, aisle, have, sources:[ "recipe:<slug>" | "manual" | "core" | "full" ]} }
  // cart:   { recipeSlug: {batches} }  — recipes you've added, for attribution + batch counts
  let S = { username: "", diet: null, saved: [], basket: {}, cart: {} };
  let filters = { meal: "all", best: false, saved: false, q: "" };
  let remoteTimer = null;

  const $ = sel => document.querySelector(sel);
  const view = $("#view");
  const esc = s => String(s == null ? "" : s).replace(/[&<>]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));

  // ---------- persistence ----------
  const keyFor = u => "meals:user:" + u.toLowerCase();
  function loadLocal(u) { try { return JSON.parse(localStorage.getItem(keyFor(u)) || "{}"); } catch (e) { return {}; } }
  function applyProfile(p) {
    S.diet = p.diet || S.diet;
    S.saved = Array.isArray(p.saved) ? p.saved : [];
    S.basket = (p.basket && typeof p.basket === "object") ? p.basket : {};
    S.cart = (p.cart && typeof p.cart === "object") ? p.cart : {};
    // migrate older baskets that predate source tracking
    Object.values(S.basket).forEach(it => { if (!Array.isArray(it.sources)) it.sources = ["manual"]; });
  }
  function persist() {
    const p = { diet: S.diet, saved: S.saved, basket: S.basket, cart: S.cart, updatedAt: Date.now() };
    try {
      localStorage.setItem(keyFor(S.username), JSON.stringify(p));
      localStorage.setItem("meals:last", JSON.stringify({ username: S.username, diet: S.diet }));
    } catch (e) {}
    if (SYNC) { clearTimeout(remoteTimer); remoteTimer = setTimeout(() => remotePut(p), 600); }
  }
  async function remoteGet(u) {
    if (!SYNC) return null;
    try {
      const r = await fetch(SYNC + "/" + encodeURIComponent(u.toLowerCase()), { method: "GET" });
      if (!r.ok) return null;
      const d = await r.json();
      return d && Object.keys(d).length ? d : null;
    } catch (e) { return null; }
  }
  async function remotePut(p) {
    if (!SYNC) return;
    try {
      await fetch(SYNC + "/" + encodeURIComponent(S.username.toLowerCase()),
        { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(p) });
    } catch (e) {}
  }

  async function login(username, diet) {
    S.username = username.trim() || "guest";
    applyProfile(loadLocal(S.username));
    if (diet) S.diet = diet;
    persist();
    paintChip();
    // pull cross-device profile in the background, then refresh if found
    const remote = await remoteGet(S.username);
    if (remote) {
      const keepDiet = S.diet;
      applyProfile(remote);
      if (!S.diet) S.diet = keepDiet;
      paintChip(); updateBasketBadge(); route();
    }
  }

  // ---------- diet helpers ----------
  const isVegan = () => S.diet === "vegan";
  function statusOf(r) { return r.veganStatus || "vegan"; }
  function recipeAllowed(r) { return isVegan() ? statusOf(r) !== "animal" : true; }
  function ingredientAllowed(i) { return isVegan() ? i.vegan !== false : true; }
  function textIsAnimal(t) { const s = t.toLowerCase(); return ANIMAL_WORDS.some(w => s.includes(w)); }

  // ---------- small components ----------
  function scoreDots(r) {
    const order = [["nutrition", "N"], ["effort", "E"], ["taste", "T"]];
    return `<span class="dots" aria-label="nutrition, effort, taste">` +
      order.map(([k]) => `<span class="dot ${r.scores[k] || "ok"}"></span>`).join("") + `</span>`;
  }
  function dietPill(r) {
    const st = statusOf(r);
    if (st === "vegan") return `<span class="pill veg">🌱 Vegan</span>`;
    if (st === "adaptable") return `<span class="pill veg">🌱 Vegan option</span>`;
    return `<span class="pill">🍳 Non-vegan</span>`;
  }
  function timeLabel(r) { return r.totalMin ? `${r.totalMin}m` : (r.summary.time || ""); }

  // ---------- views ----------
  function recipeCard(r) {
    const blurb = r.eats ? r.eats : (r.summary.steps || "").split("→")[0];
    return `<a class="card" href="#/recipe/${r.slug}">
      <div class="card-head">
        <div>
          <h3 class="card-title">${esc(r.title)}</h3>
          <p class="card-blurb">${esc(truncate(r.blurb || blurb, 110))}</p>
        </div>
        <button class="save-btn ${S.saved.includes(r.slug) ? "on" : ""}" data-action="save" data-slug="${r.slug}"
          aria-label="Save">${S.saved.includes(r.slug) ? "♥" : "♡"}</button>
      </div>
      <div class="card-meta">
        <span class="meta-item">⏱ ${esc(timeLabel(r))}</span>
        ${scoreDots(r)}
        ${r.best ? `<span class="pill best">⭐ Best</span>` : ""}
        ${dietPill(r)}
      </div>
    </a>`;
  }

  function viewRecipes() {
    setTitle("Recipes"); setBack(false); setTab("recipes");
    let list = D.recipes.filter(recipeAllowed);
    if (filters.meal !== "all") list = list.filter(r => r.meal === filters.meal);
    if (filters.best) list = list.filter(r => r.best);
    if (filters.saved) list = list.filter(r => S.saved.includes(r.slug));
    if (filters.q) {
      const q = filters.q.toLowerCase();
      list = list.filter(r => (r.title + " " + r.blurb + " " + r.eats + " " +
        r.uses.map(s => (ingBySlug[s] || {}).name || "").join(" ")).toLowerCase().includes(q));
    }
    // breakfast first within "all" feels natural; otherwise keep catalog order
    const html = `
      <h1 class="large-title">Recipes</h1>
      <div class="filterbar">
        <div class="search"><span class="sico">🔍</span>
          <input id="rq" type="search" placeholder="Search recipes" value="${esc(filters.q)}"
            autocomplete="off" autocapitalize="none"></div>
        <div class="filter-row">
          <div class="seg" id="meal-seg">
            ${seg("meal", "all", "All")}${seg("meal", "breakfast", "Breakfast")}${seg("meal", "main", "Mains")}
          </div>
          <button class="toggle-chip ${filters.best ? "on" : ""}" data-action="f-best">⭐ Best</button>
          <button class="toggle-chip ${filters.saved ? "on" : ""}" data-action="f-saved">♥ Saved</button>
        </div>
      </div>
      <p class="result-count">${list.length} recipe${list.length === 1 ? "" : "s"}${isVegan() ? " · vegan" : ""}</p>
      <div class="legend">
        <span>The dots:</span>
        <span class="lg"><span class="dot great"></span>nutrition</span>
        <span class="lg"><span class="dot ok"></span>effort</span>
        <span class="lg"><span class="dot weak"></span>taste</span>
        <span class="sep">green great · amber ok · red weak</span>
      </div>
      <div class="cards">${list.map(recipeCard).join("") || emptyState("🍃", "No recipes match. Loosen a filter.")}</div>`;
    view.innerHTML = html;
    const rq = $("#rq");
    rq.addEventListener("input", e => { filters.q = e.target.value; debouncedRecipes(); });
  }
  let recipesT = null;
  function debouncedRecipes() { clearTimeout(recipesT); recipesT = setTimeout(viewRecipes, 120); }
  function seg(group, val, label) {
    return `<button class="${filters[group] === val ? "on" : ""}" data-action="seg" data-group="${group}" data-val="${val}">${label}</button>`;
  }

  function viewRecipe(slug) {
    const r = recBySlug[slug];
    if (!r) return notFound();
    setTitle(""); setBack(true); setTab("recipes");
    const adaptable = isVegan() && statusOf(r) === "adaptable" && r.veganVariant;
    const inBasket = recipeInCart(r.slug);
    const chips = r.uses.map(s => {
      const i = ingBySlug[s]; if (!i || !ingredientAllowed(i)) return "";
      return `<a class="ing-chip" href="#/ingredient/${i.slug}">${esc(i.name)} <span class="x">›</span></a>`;
    }).join("");
    const v = r.veganVariant;
    view.innerHTML = `
      <h1 class="detail-title">${esc(r.title)}</h1>
      <div class="glance">
        <div class="badges">${dietPill(r)}${r.best ? `<span class="pill best">⭐ Best</span>` : ""}
          <span class="pill">${esc(r.type || "")}</span></div>
        <div class="scoreline">
          ${scoreItem("Nutrition", r.scores.nutrition)}${scoreItem("Effort", r.scores.effort)}
          ${scoreItem("Taste", r.scores.taste)}</div>
        <div class="glance-row"><div class="k">Time</div><div class="v">${esc(r.summary.time || timeLabel(r))}</div></div>
        <div class="glance-row"><div class="k">You'll need</div><div class="v">${esc((adaptable && v.coreIngredients ? v.coreIngredients : r.summary.coreIngredients).join(", "))}</div></div>
        <div class="glance-row"><div class="k">The gist</div><div class="v">${esc(adaptable && v.steps ? v.steps : r.summary.steps)}</div></div>
        <div class="glance-row"><div class="k">Kit</div><div class="v">${esc(r.equipment)} · serves ${esc(r.serves)}</div></div>
      </div>
      <div class="action-row">
        <button class="primary-btn ${inBasket ? "added" : ""}" data-action="add-recipe" data-slug="${r.slug}">
          ${inBasket ? "✓ In basket" : "Add to basket"}</button>
        <button class="ghost-btn ${S.saved.includes(r.slug) ? "on" : ""}" data-action="save" data-slug="${r.slug}">
          ${S.saved.includes(r.slug) ? "♥" : "♡"}</button>
      </div>
      ${adaptable ? `<div class="variant-note">🌱 Vegan version shown — ${esc(v.note || "swaps below")}.</div>` : ""}
      <p class="why" style="margin:0 4px 16px">${esc(r.blurb)}</p>
      <div class="block">
        <h3>In this recipe</h3><div class="chips">${chips}</div>
        ${adaptable && v.swaps && v.swaps.length ? `<h3>Vegan swaps</h3><ul>${v.swaps.map(x => `<li>${esc(x)}</li>`).join("")}</ul>` : ""}
        <h3>Ingredients</h3><ul>${r.ingredients.map(x => `<li>${esc(x)}</li>`).join("")}</ul>
        <h3>Method</h3><ol>${r.method.map(x => `<li>${esc(x)}</li>`).join("")}</ol>
        ${r.levelUp.length ? `<h3>Level it up</h3><ul>${r.levelUp.map(x => `<li>${esc(x)}</li>`).join("")}</ul>` : ""}
        <h3>Why it scores</h3><p class="why">${esc(r.why)}</p>
      </div>`;
    window.scrollTo(0, 0);
  }
  function scoreItem(label, s) { return `<span class="score"><span class="dot ${s || "ok"}"></span>${label}</span>`; }
  function ingBlock(i, scoreRows) {
    const parts = [
      i.why && i.summary ? `<h3>Why it's in the kit</h3><p class="why">${esc(i.why)}</p>` : "",
      i.tips && i.tips.length ? `<h3>Tips</h3><ul>${i.tips.map(t => `<li>${esc(t)}</li>`).join("")}</ul>` : "",
      i.swaps && i.swaps.length ? `<h3>Swaps &amp; alternatives</h3><ul>${i.swaps.map(t => `<li>${esc(t)}</li>`).join("")}</ul>` : "",
      i.storage ? `<h3>Keeping it</h3><p class="why">${esc(i.storage)}</p>` : "",
      i.nutritionNote ? `<h3>Nutrition</h3><p class="why">${esc(i.nutritionNote)}</p>` : "",
      scoreRows.length ? `<h3>Scores</h3><div class="scoreline">${scoreRows.map(x => scoreItem(x[0], x[1])).join("")}</div><div style="height:14px"></div>` : "",
    ].filter(Boolean).join("");
    return parts ? `<div class="block">${parts}</div>` : "";
  }

  function viewIngredients() {
    setTitle("Ingredients"); setBack(false); setTab("ingredients");
    const groups = (D.groups || []).map(g => ({
      slug: g.slug, label: g.label,
      list: g.items.map(s => ingBySlug[s]).filter(i => i && ingredientAllowed(i)),
    })).filter(g => g.list.length);
    let html = `<h1 class="large-title">Ingredients</h1>`;
    html += `<div class="jump-bar">` + groups.map(g =>
      `<button class="jump-chip" data-action="jump" data-group="${g.slug}">${esc(g.label)}<span class="jc-count">${g.list.length}</span></button>`
    ).join("") + `</div>`;
    html += `<p class="result-count">The proven kit${isVegan() ? " · vegan" : ""} — tap any for tips, swaps and where it's used.</p>`;
    groups.forEach(g => {
      html += `<div class="section-title" id="grp-${g.slug}">${esc(g.label)}</div>`;
      html += `<div class="ing-list">` + g.list.map(i => {
        const n = (i.usedIn || []).filter(rs => recipeAllowed(recBySlug[rs])).length;
        return `<a class="ing-item" href="#/ingredient/${i.slug}">
          <span class="name">${esc(i.name)}${i.core ? ` <span class="tag">core</span>` : ""}</span>
          <span class="sub">${n} recipe${n === 1 ? "" : "s"}</span><span class="chev">›</span></a>`;
      }).join("") + `</div>`;
    });
    view.innerHTML = html;
  }

  function viewIngredient(slug) {
    const i = ingBySlug[slug];
    if (!i) return notFound();
    setTitle(""); setBack(true); setTab("ingredients");
    const used = (i.usedIn || []).map(s => recBySlug[s]).filter(r => r && recipeAllowed(r));
    const scoreRows = [["Versatility", i.versatility], ["Prep effort", i.prepEffort],
      ["Availability", i.availability], ["Nutrition", i.nutrition]].filter(x => x[1]);
    const inBasketIng = !!S.basket[i.slug];
    view.innerHTML = `
      <div class="ing-hero"><h1>${esc(i.name)}</h1>
        <span class="tag">${esc(catLabel[i.category] || i.category)}</span>
        ${i.core ? `<span class="tag">core kit</span>` : ""}
        ${i.vegan === false ? `<span class="tag">🍳 non-vegan</span>` : `<span class="tag">🌱 vegan</span>`}</div>
      ${i.summary ? `<p class="why" style="margin:0 4px 14px">${esc(i.summary)}</p>`
        : (i.why ? `<p class="why" style="margin:0 4px 14px">${esc(i.why)}</p>` : "")}
      <div class="action-row">
        <button class="primary-btn ${inBasketIng ? "added" : ""}" data-action="add-ing" data-slug="${i.slug}">
          ${inBasketIng ? "✓ In basket" : "Add to basket"}</button>
      </div>
      ${ingBlock(i, scoreRows)}
      <div class="section-title">Used in ${used.length} recipe${used.length === 1 ? "" : "s"}</div>
      <div class="cards">${used.map(recipeCard).join("") || emptyState("🍳", "Not used in a core recipe yet.")}</div>`;
    window.scrollTo(0, 0);
  }

  function viewBasket() {
    setTitle("Basket"); setBack(false); setTab("basket");
    const items = Object.entries(S.basket).map(([id, v]) => ({ id, ...v }));
    const need = items.filter(i => !i.have);
    const have = items.filter(i => i.have);
    const cartRecipes = Object.keys(S.cart).map(s => recBySlug[s]).filter(Boolean);

    let html = `<div class="basket-head"><h1 class="large-title" style="margin:0">Basket</h1>
      ${items.length ? `<button class="link-btn" data-action="clear-basket">Empty</button>` : ""}</div>
      <div class="basket-presets">
        <button class="preset-btn" data-action="add-core">
          <div class="pt">＋ Core kit</div><div class="ps">Minimal best-per-category</div></button>
        <button class="preset-btn" data-action="add-full">
          <div class="pt">＋ Full list</div><div class="ps">A week for two</div></button>
      </div>`;

    if (cartRecipes.length) {
      html += `<div class="section-title">Recipes</div>`;
      cartRecipes.forEach(r => {
        const b = (S.cart[r.slug] || {}).batches || 1;
        html += `<div class="cart-recipe">
          <div class="cr-main"><a class="cr-title" href="#/recipe/${r.slug}">${esc(r.title)}</a>
            <div class="cr-sub">serves ${esc(r.serves || "1–2")}${b > 1 ? ` · ${b} batches` : ""}</div></div>
          <div class="stepper">
            <button data-action="batch-dec" data-slug="${r.slug}" ${b <= 1 ? "disabled" : ""}>−</button>
            <span class="sv">×${b}</span>
            <button data-action="batch-inc" data-slug="${r.slug}">＋</button></div>
          <button class="cr-remove" data-action="rm-recipe" data-slug="${r.slug}" aria-label="Remove recipe">×</button>
        </div>`;
      });
    }

    if (!items.length) {
      html += emptyState("🛒", "Your basket is empty. Add a recipe, or tap a preset above.");
    } else {
      const groups = {};
      need.forEach(i => { (groups[i.aisle] = groups[i.aisle] || []).push(i); });
      const aisleOrder = D.shoppingList.map(g => g.title).concat(Object.values(catLabel));
      const sortedAisles = Object.keys(groups).sort((a, b) => idx(aisleOrder, a) - idx(aisleOrder, b));
      html += `<div class="section-title">To buy${need.length ? ` · ${need.length}` : ""}</div>`;
      if (!need.length) html += `<p class="result-count" style="margin-left:4px">All ticked off 🎉</p>`;
      sortedAisles.forEach(a => {
        html += `<div class="section-title" style="margin-top:14px">${esc(a)}</div>
          <div class="check-list">` + groups[a].map(checkRow).join("") + `</div>`;
      });
      if (have.length) {
        html += `<div class="section-title basket-group-title" style="margin-top:18px"><span>Got it (${have.length})</span>
          <button class="link-btn" data-action="clear-have">Clear</button></div>
          <div class="check-list">` + have.map(checkRow).join("") + `</div>`;
      }
    }
    view.innerHTML = html;
  }
  function checkRow(i) {
    return `<div class="check-item ${i.have ? "done" : ""}">
      <button class="check-box" data-action="toggle-have" data-id="${esc(i.id)}">${i.have ? "✓" : ""}</button>
      <div class="ci-main"><div class="ci-label">${esc(i.label)}</div>
        <div class="ci-source">${esc(itemSourcesText(i))}</div></div>
      <button class="ci-remove" data-action="rm-item" data-id="${esc(i.id)}" aria-label="Remove">×</button>
    </div>`;
  }
  function itemSourcesText(it) {
    const srcs = (it.sources && it.sources.length) ? it.sources : ["manual"];
    const seen = [];
    srcs.forEach(s => {
      let label;
      if (s.indexOf("recipe:") === 0) {
        const slug = s.slice(7), r = recBySlug[slug], b = (S.cart[slug] || {}).batches || 1;
        label = (r ? r.title : "a recipe") + (b > 1 ? ` ×${b}` : "");
      } else label = { manual: "added on its own", core: "core kit", full: "week list" }[s] || s;
      if (seen.indexOf(label) < 0) seen.push(label);
    });
    return seen.join(" · ");
  }

  // ---------- basket ops ----------
  function addItem(id, label, aisle, source) {
    const it = S.basket[id];
    if (it) {
      if (!Array.isArray(it.sources)) it.sources = [];
      if (source && it.sources.indexOf(source) < 0) it.sources.push(source);
    } else {
      S.basket[id] = { label, aisle, have: false, sources: source ? [source] : [] };
    }
  }
  function recipeInCart(slug) { return !!S.cart[slug]; }
  function addRecipe(r) {
    if (!S.cart[r.slug]) S.cart[r.slug] = { batches: 1 };
    r.uses.forEach(s => {
      const i = ingBySlug[s]; if (!i || !ingredientAllowed(i)) return;
      addItem(i.slug, i.name, catLabel[i.category] || "Other", "recipe:" + r.slug);
    });
  }
  function removeRecipe(slug) {
    delete S.cart[slug];
    Object.keys(S.basket).forEach(id => {
      const it = S.basket[id];
      it.sources = (it.sources || []).filter(x => x !== "recipe:" + slug);
      if (!it.sources.length) delete S.basket[id];
    });
  }
  function setBatches(slug, n) {
    if (!S.cart[slug]) return;
    S.cart[slug].batches = Math.max(1, Math.min(9, n));
  }
  function addCoreKit() {
    D.coreKit.forEach(s => { const i = ingBySlug[s]; if (i && ingredientAllowed(i)) addItem(i.slug, i.name, catLabel[i.category] || "Other", "core"); });
  }
  function addFullList() {
    D.shoppingList.forEach(g => g.items.forEach(it => {
      if (isVegan() && textIsAnimal(it)) return;
      addItem("full:" + slugifyText(it), it, g.title, "full");
    }));
  }

  // ---------- onboarding & sheet ----------
  function showOnboarding() {
    const ob = $("#onboarding"); ob.hidden = false;
    let chosen = null;
    const nameInput = $("#onboard-name"); const go = $("#onboard-go");
    const last = safeParse(localStorage.getItem("meals:last"));
    if (last && last.username) nameInput.value = last.username;
    function refresh() { go.disabled = !chosen; }
    ob.querySelectorAll(".diet-btn").forEach(b => b.addEventListener("click", () => {
      ob.querySelectorAll(".diet-btn").forEach(x => x.classList.remove("on"));
      b.classList.add("on"); chosen = b.dataset.diet; refresh();
    }));
    nameInput.addEventListener("keydown", e => { if (e.key === "Enter" && chosen) go.click(); });
    go.onclick = async () => {
      ob.hidden = true;
      await login(nameInput.value, chosen);
      if (!location.hash || location.hash === "#/") location.hash = "#/recipes";
      route();
    };
    refresh();
  }
  function openSheet() {
    const sh = $("#sheet"); sh.hidden = false;
    $("#sheet-name").value = S.username;
    sh.querySelectorAll("#sheet-diet button").forEach(b =>
      b.classList.toggle("on", b.dataset.diet === S.diet));
    $("#sheet-meta").textContent = `Built from the catalog of ${D.snapshot.date} · ` +
      `${D.snapshot.recipeCount} recipes, ${D.snapshot.ingredientCount} ingredients` +
      (SYNC ? " · syncing" : " · this device");
  }
  function closeSheet() { $("#sheet").hidden = true; }

  // ---------- router ----------
  function route() {
    if (!S.diet) { showOnboarding(); return; }
    const h = location.hash || "#/recipes";
    const m = h.match(/^#\/(\w+)(?:\/(.+))?/);
    const v = m ? m[1] : "recipes";
    const p = m && m[2] ? decodeURIComponent(m[2]) : null;
    if (v === "recipe") viewRecipe(p);
    else if (v === "ingredient") viewIngredient(p);
    else if (v === "ingredients") viewIngredients();
    else if (v === "basket") viewBasket();
    else viewRecipes();
    updateBasketBadge();
  }

  // ---------- chrome ----------
  function setTitle(t) { $("#topbar-title").textContent = t; }
  function setBack(on) { $("#back-btn").hidden = !on; }
  function setTab(name) { document.querySelectorAll(".tab").forEach(t => t.classList.toggle("active", t.dataset.tab === name)); }
  function paintChip() { $("#chip-name").textContent = S.username || "—"; $("#chip-diet").textContent = isVegan() ? "🌱" : "🍳"; }
  function updateBasketBadge() {
    const n = Object.values(S.basket).filter(i => !i.have).length;
    const b = $("#basket-badge"); b.textContent = n; b.hidden = n === 0;
  }

  // ---------- events ----------
  document.addEventListener("click", e => {
    const a = e.target.closest("[data-action]");
    if (!a) return;
    const act = a.dataset.action;
    if (act === "save") { e.preventDefault(); toggleSave(a.dataset.slug); return; }
    if (act === "seg") { filters[a.dataset.group] = a.dataset.val; viewRecipes(); return; }
    if (act === "f-best") { filters.best = !filters.best; viewRecipes(); return; }
    if (act === "f-saved") { filters.saved = !filters.saved; viewRecipes(); return; }
    if (act === "jump") {
      e.preventDefault();
      const el = document.getElementById("grp-" + a.dataset.group);
      if (el) el.scrollIntoView({ block: "start" });
      return;
    }
    if (act === "add-recipe") {
      const r = recBySlug[a.dataset.slug];
      recipeInCart(r.slug) ? removeRecipe(r.slug) : addRecipe(r);
      persist(); updateBasketBadge(); viewRecipe(r.slug); return;
    }
    if (act === "add-ing") {
      const i = ingBySlug[a.dataset.slug];
      if (S.basket[i.slug]) delete S.basket[i.slug]; else addItem(i.slug, i.name, catLabel[i.category] || "Other", "manual");
      persist(); updateBasketBadge(); viewIngredient(i.slug); return;
    }
    if (act === "add-core") { addCoreKit(); persist(); viewBasket(); updateBasketBadge(); return; }
    if (act === "add-full") { addFullList(); persist(); viewBasket(); updateBasketBadge(); return; }
    if (act === "batch-inc") { setBatches(a.dataset.slug, ((S.cart[a.dataset.slug] || {}).batches || 1) + 1); persist(); viewBasket(); return; }
    if (act === "batch-dec") { setBatches(a.dataset.slug, ((S.cart[a.dataset.slug] || {}).batches || 1) - 1); persist(); viewBasket(); return; }
    if (act === "rm-recipe") { removeRecipe(a.dataset.slug); persist(); viewBasket(); updateBasketBadge(); return; }
    if (act === "toggle-have") { const it = S.basket[a.dataset.id]; if (it) { it.have = !it.have; persist(); viewBasket(); updateBasketBadge(); } return; }
    if (act === "rm-item") { delete S.basket[a.dataset.id]; persist(); viewBasket(); updateBasketBadge(); return; }
    if (act === "clear-have") { Object.entries(S.basket).forEach(([k, v]) => { if (v.have) delete S.basket[k]; }); persist(); viewBasket(); updateBasketBadge(); return; }
    if (act === "clear-basket") { S.basket = {}; S.cart = {}; persist(); viewBasket(); updateBasketBadge(); return; }
  });
  function toggleSave(slug) {
    const i = S.saved.indexOf(slug);
    if (i >= 0) S.saved.splice(i, 1); else S.saved.push(slug);
    persist();
    // light refresh of current view
    route();
  }

  $("#back-btn").addEventListener("click", () => history.length > 1 ? history.back() : (location.hash = "#/recipes"));
  $("#name-chip").addEventListener("click", openSheet);
  $("#sheet-backdrop").addEventListener("click", closeSheet);
  $("#sheet-diet").addEventListener("click", e => {
    const b = e.target.closest("button"); if (!b) return;
    $("#sheet-diet").querySelectorAll("button").forEach(x => x.classList.remove("on"));
    b.classList.add("on");
  });
  $("#sheet-save").addEventListener("click", async () => {
    const newName = $("#sheet-name").value.trim();
    const newDiet = $("#sheet-diet").querySelector("button.on") ?
      $("#sheet-diet").querySelector("button.on").dataset.diet : S.diet;
    closeSheet();
    if (newName && newName.toLowerCase() !== S.username.toLowerCase()) { await login(newName, newDiet); }
    else { S.diet = newDiet; persist(); paintChip(); }
    route();
  });
  window.addEventListener("hashchange", route);

  // ---------- utils ----------
  function truncate(s, n) { s = s || ""; return s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s; }
  function capitalize(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }
  function slugifyText(s) { return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40); }
  function idx(arr, v) { const i = arr.indexOf(v); return i < 0 ? 999 : i; }
  function safeParse(s) { try { return JSON.parse(s); } catch (e) { return null; } }
  function emptyState(emoji, msg) { return `<div class="empty"><div class="e-emoji">${emoji}</div><p>${esc(msg)}</p></div>`; }
  function notFound() { setBack(true); view.innerHTML = emptyState("🤔", "Not found."); }

  // ---------- boot ----------
  (function boot() {
    const last = safeParse(localStorage.getItem("meals:last"));
    if (last && last.username && last.diet) {
      S.username = last.username; applyProfile(loadLocal(last.username));
      if (!S.diet) S.diet = last.diet;
      paintChip();
      if (SYNC) remoteGet(S.username).then(r => { if (r) { applyProfile(r); if (!S.diet) S.diet = last.diet; paintChip(); updateBasketBadge(); route(); } });
    }
    route();
  })();
})();
