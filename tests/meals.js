/* Meals, whole servings, the Plan tab as one list, and the nutrition round trip
 * through a chat with Claude. Same synthetic save as realdata.js. */
const { JSDOM } = require("jsdom");
const fs = require("fs");
const html = fs.readFileSync(require("path").join(__dirname, "..", "site", "index.html"), "utf8");
const today = (() => { const n = new Date(); return Math.floor(Date.UTC(n.getFullYear(), n.getMonth(), n.getDate()) / 86400000); })();
const mk = (o) => Object.assign({ coverDays: null, watch: [], lots: [], asOf: today, spent: 0, saved: 0, boughtQty: 0, wasted: 0 }, o);
const N = (o) => Object.assign({}, o);
const rc = (ts, itemId, item, qty, unit, total) => ({ ts, day: today, itemId, item, store: "", product: "Added by hand",
  packs: 1, packQty: qty, unit, qty, price: total, total, saved: 0 });
const lot = (id, qty, paid) => ({ id, qty, exp: today + 180, open: null, bought: today, product: "", paid });
const SAVE = JSON.stringify({ v: 4, month: "", settings: { coverDays: 1, dealPct: 10, maxCover: 120, aheadPct: 40 },
  items: [
    mk({ id: "egg", name: "Eggs", unit: "pc", perMonth: 30, shelfLife: 14, openLife: 14, lots: [lot("e1", 3, 0)] }),
    // logged 1,5 kg, binned it to "correct" it, re-logged three packs: the pattern from a real save
    mk({ id: "pas", name: "Pasta", unit: "kg", perMonth: 6, shelfLife: 365, openLife: 365,
      lots: [lot("p1", 0.5, 9), lot("p2", 0.5, 9), lot("p3", 0.5, 9)], spent: 54, boughtQty: 3, wasted: 1.5,
      bPrice: 27, bQty: 1, bUnit: "kg",
      watch: [{ key: "netto|Bettini, Rigatoni", pack: 0.5, name: "Bettini, Rigatoni", store: "netto", lastPrice: 12, lastRegular: 13.5 }] }),
    mk({ id: "sau", name: "Pasta sauce", unit: "L", perMonth: 6, shelfLife: 60, openLife: 5, lots: [lot("s1", 0.5, 14)] }),
    mk({ id: "che", name: "Cheese", unit: "kg", perMonth: 0.9, shelfLife: 15, openLife: 7 }),
    mk({ id: "oat", name: "Havregryn", unit: "kg", perMonth: 3, shelfLife: 120, openLife: 120 }),
    mk({ id: "mlk", name: "Oat milk", unit: "L", perMonth: 3, shelfLife: 60, openLife: 10 }),
  ],
  receipts: [rc(1, "pas", "Pasta", 1.5, "kg", 27), rc(2, "pas", "Pasta", 0.5, "kg", 9),
             rc(3, "pas", "Pasta", 0.5, "kg", 9), rc(4, "pas", "Pasta", 0.5, "kg", 9)],
  archive: [],
  nut: { meals: 4, mealNames: ["Breakfast", "Lunch", "Dinner", "Snacks"], targets: null, perMeal: { protein: 40, gl: 0, gi: 0, kcalShare: 0.6, soft: true, w: 1 },
    foods: {
      egg: { per: 1, serving: 1, gi: 0, soloOk: true, capDay: 3, n: N({ kcal: 72, protein: 6.3, carb: 0.4, fat: 4.8, iron: 0.9 }) },
      // COOKED pasta values entered against a DRY stock
      pas: { per: 0.1, serving: 0.1, gi: 49, soloOk: false, capDay: 2, n: N({ kcal: 131, protein: 5.3, carb: 25, fat: 1.1, iron: 1.2 }) },
      sau: { per: 0.1, serving: 0.1, gi: 35, soloOk: false, capDay: 2, n: N({ kcal: 52, protein: 1.6, carb: 8.1, fat: 1.6, iron: 0.8 }) },
      oat: { per: 0.1, serving: 0.1, gi: 55, soloOk: false, capDay: 1, n: N({ kcal: 370, protein: 13, carb: 58, fat: 7, iron: 4.7 }) },
      mlk: { per: 0.1, serving: 0.1, gi: 69, soloOk: false, capDay: 1, n: N({ kcal: 47, protein: 1, carb: 6.6, fat: 1.5, iron: 0.2 }) },
    },
    recipes: [
      { id: "r1", name: "Pasta dish", serves: 1, capDay: 2, ownNut: true, gi: 42,
        parts: [{ itemId: "pas", qty: 0.1 }, { itemId: "sau", qty: 0.1 }], n: N({ kcal: 410, protein: 14.5, carb: 81, fat: 4, iron: 2.8 }) },
      { id: "r2", name: "Overnight Oats", serves: 1, capDay: 1, ownNut: true, gi: 52,
        parts: [{ itemId: "oat", qty: 0.1 }, { itemId: "mlk", qty: 0.1 }], n: N({ kcal: 422, protein: 14.5, carb: 66.5, fat: 8.5, iron: 4.5 }) },
    ],
    log: [], key: "", model: "gemini-3.8 Flash", recipePref: 1.5, dayBudget: 0, stamp: 1, lastModel: "gemini-3.6-flash" } });
const save = SAVE;
const errors = [];
let confirms = [];
const dom = new JSDOM(html, { runScripts: "dangerously", url: "https://x.test/", pretendToBeVisual: true,
  beforeParse(w) { w.indexedDB = undefined; w.scrollTo = () => {}; w.fetch = () => Promise.reject(new Error("x"));
    w.confirm = (m) => { confirms.push(m.split("\n")[0]); return true; };
    w.onerror = (m) => errors.push(String(m));
    w.localStorage.setItem("kurv.v3", save); } });
const w = dom.window, doc = w.document, $ = (q) => doc.querySelector(q);
process.on("unhandledRejection", () => {});
const check = (l, ok, x) => { console.log((ok ? "  ok   " : "  FAIL ") + l + (x ? "  " + x : "")); if (!ok) errors.push(l); };


setTimeout(() => {
  const app = w.Kurv_app, K = w.Kurv, S = app.S();
  const nut = S.nut;
  const plate = () => { app.nutTouched(); return app.plateToday(true); };
  const where = (r, name) => r.plate.map((p, m) => p.filter((e) => e.dish.name === name).map(() => m)).flat();

  console.log("\nWHOLE SERVINGS");
  let r = plate();
  const all = r.plate.flat();
  check("plan solved", r.ok);
  check("every serving is whole", all.every((e) => Math.abs(e.servings - Math.round(e.servings)) < 1e-6),
    all.map((e) => e.dish.name + " " + e.servings.toFixed(3)).join(", "));
  check("nothing below one serving", all.every((e) => e.servings >= 1 - 1e-6));

  console.log("\nMEAL TAGS");
  nut.recipes[0].meals = [1, 2]; // Pasta dish: lunch, dinner
  nut.recipes[1].meals = [0];    // Oats: breakfast
  nut.foods.egg.meals = [0, 3];
  r = plate();
  check("pasta never at breakfast or snacks", where(r, "Pasta dish").every((m) => m === 1 || m === 2), JSON.stringify(where(r, "Pasta dish")));
  check("oats only at breakfast", where(r, "Overnight Oats").every((m) => m === 0), JSON.stringify(where(r, "Overnight Oats")));
  check("eggs only breakfast/snacks", where(r, "Eggs").every((m) => m === 0 || m === 3));

  console.log("\nHALVES AND ANY AMOUNT");
  nut.foods.egg.step = 0.5;
  r = plate();
  check("halves allowed -> multiples of 0.5", r.plate.flat().filter((e) => e.dish.name === "Eggs").every((e) => Math.abs(e.servings * 2 - Math.round(e.servings * 2)) < 1e-6));
  nut.foods.egg.step = 1;

  console.log("\nEAT TAB: DROP A SUGGESTION, TICK ONE OFF");
  nut.recipes[0].meals = [];
  plate();
  $('nav button[data-tab="eat"]').click();
  const x = doc.querySelector('#eatBody [data-act="skipSug"]');
  check("every suggestion has an x", !!x);
  const key = x.dataset.key, m = Number(x.dataset.m);
  x.click();
  const r2 = app.plateToday();
  check("dropped suggestion is gone from that meal today", !r2.plate[m].some((e) => e.dish.key === key));
  check("…and the meal is re-planned, not just emptied", r2.ok);
  const stock0 = app.S().items.reduce((a, i) => a + K.stockOf(i), 0);
  const ck = doc.querySelector('#eatBody .ck[data-act="ateOne"]');
  ck.click();
  check("ticking the circle logs it", (nut.diary || []).length === 1);
  check("…and takes it off the cupboard", app.S().items.reduce((a, i) => a + K.stockOf(i), 0) < stock0);
  doc.querySelector('#eatBody [data-act="unlog"]').click();
  check("x on an eaten row puts it back", (nut.diary || []).length === 0 &&
    Math.abs(app.S().items.reduce((a, i) => a + K.stockOf(i), 0) - stock0) < 1e-9);

  console.log("\nFOOD EDITOR: MEALS AND PORTIONS");
  $('nav button[data-tab="plan"]').click();
  const fb = doc.querySelector('#p-plan [data-act="openFood"][data-id="pas"]');
  check("Plan row has a Food button", !!fb);
  fb.click();
  check("food editor shows meal chips", doc.querySelectorAll('#foodBody [data-act="dishmeal"]').length === 5);
  check("pasta guessed lunch/dinner before anything is tapped", /guessed/.test($("#foodBody").textContent) &&
    JSON.stringify(K.mealsOf(nut.foods.pas, "Pasta", nut)) === "[1,2]");
  doc.querySelector('#foodBody [data-act="dishmeal"][data-m="2"]').click();
  check("tapping Dinner takes it off the guess", JSON.stringify(nut.foods.pas.meals) === "[1]");
  doc.querySelector('#foodBody [data-act="dishmeal"][data-m="-1"]').click();
  doc.querySelector('#foodBody [data-act="dishmeal"][data-m="2"]').click();
  check("Any meal, then Dinner -> dinner only", JSON.stringify(nut.foods.pas.meals) === "[2]");
  doc.querySelector('#foodBody [data-act="dishmeal"][data-m="-1"]').click();
  check("Any meal clears it", nut.foods.pas.meals.length === 0);
  doc.querySelector('#foodBody [data-act="dishstep"][data-v="0"]').click();
  check("portions: any amount", nut.foods.pas.step === 0);
  $('[data-act="closeFood"]').click();
  check("Done returns to the Plan tab, not the foods list", !$("#mFoods").classList.contains("on"));

  console.log("\nPLAN TAB SAYS WHAT IS MISSING");
  const planTxt = $("#planBody").textContent;
  check("cheese flagged: no nutrition", /Cheese[\s\S]*?no nutrition/.test(planTxt));
  check("settings folded away", !!$("#planBody details.more"));

  console.log("\nCLAUDE ROUND TRIP");
  const req = app.claudeRequest();
  const pr = req.foods.find((f) => f.id === "pas");
  check("request names the watched product", pr.products[0].indexOf("Bettini, Rigatoni") === 0, pr.products[0]);
  check("request says as bought / Denmark", /AS BOUGHT/.test(req.task) && /Denmark/.test(req.task));
  check("request lists meals", req.meals.join() === "Breakfast,Lunch,Dinner,Snacks");
  check("request carries no key", JSON.stringify(req).indexOf("gemini-3.8") < 0);
  const reply = "Here you go:\n```json\n" + JSON.stringify({ kurv: "nutrition", version: 1,
    foods: [{ id: "pas", name: "Pasta", source: "Bettini Rigatoni label", per: 0.1, serving: 0.1, gi: 50, soloOk: false,
              meals: ["Lunch", "Dinner"], n: { kcal: 359, protein: 12.5, carb: 70, fiber: 3, iron: 1.3 } },
            { name: "cheese", per: 0.1, serving: 0.03, soloOk: true, meals: ["Breakfast", "Lunch", "Snacks"],
              n: { kcal: 350, protein: 26, calcium: 750 } },
            { id: "nope", name: "Unicorn" }],
    recipes: [{ name: "Pasta dish", serves: 1, meals: ["Lunch", "Dinner"], parts: [{ id: "pas", qty: 0.1 }, { id: "sau", qty: 0.15 }, { id: "che", qty: 0.02 }], ownNut: false, note: "cheese adds calcium" },
              { name: "Cheese omelette", meals: ["Breakfast"], parts: [{ id: "egg", qty: 3 }, { food: "Cheese", qty: 0.03 }] }] }) + "\n```\nEnjoy";
  const ch = app.parseClaudeReply(reply);
  check("reply parsed through the chat wrapping", !ch.err, ch.err);
  $('[data-act="openClaude"]').click();
  const ta = $("#claudeArea"); ta.value = reply; ta.dispatchEvent(new w.Event("input", { bubbles: true }));
  const prev = $("#claudePrev").textContent;
  check("preview shows the change before saving", /131 → 359/.test(prev), prev.slice(0, 120));
  check("preview lists what did not match", /Unicorn/.test(prev));
  check("not saved yet", nut.foods.pas.n.kcal === 131);
  $('[data-act="claudeApply"]').click();
  check("pasta now dry label values", nut.foods.pas.n.kcal === 359 && nut.foods.pas.source === "Bettini Rigatoni label");
  check("pasta meals from names", JSON.stringify(nut.foods.pas.meals) === "[1,2]");
  check("cheese created, matched by name", nut.foods.che && nut.foods.che.n.calcium === 750);
  const pd = nut.recipes.find((x) => x.name === "Pasta dish");
  check("existing recipe updated, not duplicated", nut.recipes.filter((x) => x.name === "Pasta dish").length === 1 && pd.parts.length === 3);
  check("own profile turned off: sums the real parts", pd.ownNut === false);
  check("new recipe added", nut.recipes.some((x) => x.name === "Cheese omelette" && x.meals[0] === 0 && x.parts.length === 2));
  check("bad paste explained", !!app.parseClaudeReply("hello").err && !!app.parseClaudeReply(JSON.stringify(req)).err);
  r = plate();
  check("plan still solves after import", r.ok, Math.round(r.totals.kcal) + " kcal");
  check("still no pasta at breakfast", where(r, "Pasta dish").every((m) => m === 1 || m === 2));

  console.log("\n==== errors: " + (errors.length ? errors.join(" | ") : "none"));
  process.exit(errors.length ? 1 : 0);
}, 400);
