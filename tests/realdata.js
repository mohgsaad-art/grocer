/* A save with the exact failure pattern found in real use: cooked-pasta values
 * against dry stock, a purchase "corrected" by binning it, and purchases logged
 * before a budget price existed. Built here rather than read from anyone's export. */
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
  const pasta = S.items.find((i) => i.name === "Pasta");

  console.log("LOADED A SAVE WITH THE REAL-WORLD MISTAKES");
  check("pasta savings recomputed against 27 kr/kg", Math.abs(pasta.saved - 27) < 0.01, "saved " + pasta.saved);
  check("model name normalised", app.geminiModels()[1] === "gemini-3.8-flash" || app.geminiModels().includes("gemini-3.8-flash"),
    app.geminiModels().slice(0, 3).join(", "));
  check("no name with a space left", !app.geminiModels().some((m) => /\s|[A-Z]/.test(m)));

  console.log("\nEAT TAB");
  $('nav button[data-tab="eat"]').click();
  const eat = $("#eatBody").textContent.replace(/\s+/g, " ");
  check("says it is not a full day", /This is not a full day/.test(eat));
  const m = eat.match(/best possible is (\S+) kcal and (\d+) g protein, and (\d+) of (\d+)/);
  console.log("        \"" + (m ? m[0] : "?") + "\"");
  check("names Cheese as having no nutrition", /No nutrition yet: Cheese/.test(eat));
  check("flags the pasta cooked/dry mismatch", /Pasta dish says 410 kcal/.test(eat) && /cooked/.test(eat), 
    (eat.match(/Pasta dish says[^.]*\./) || [""])[0]);
  check("names the culprit and its per-100 g figure", /Pasta \(131 kcal per 100 g as entered\)/.test(eat));
  check("overnight oats NOT flagged (they agree)", !/Overnight Oats says/.test(eat));

  console.log("\nTARGETS");
  $('nav button[data-tab="plan"]').click();
  $('#p-plan [data-act="openTargets"]').click();
  check("iron note explains the 1.8x", /1.8×/.test($("#targetsBody").textContent));
  $('[data-act="close"]').click();

  console.log("\nTHE PROMPT GEMINI NOW GETS (food: Pasta)");
  const prompt = app.nutPrompt("Pasta", "0,1 kg (100 g)", "Bettini, Rigatoni (Netto)");
  ["AS BOUGHT", "dry pasta", "NOT fortified", "Bettini, Rigatoni (Netto)", '"form"'].forEach((t) =>
    check("prompt says: " + t, prompt.includes(t)));

  console.log("\nMONEY: UNDO THE 1,5 kg ENTRY");
  $('nav button[data-tab="money"]').click();
  const before = { spent: pasta.spent, wasted: pasta.wasted, qty: pasta.boughtQty, stock: K.stockOf(pasta) };
  const r15 = S.receipts.find((r) => r.itemId === pasta.id && r.qty === 1.5);
  doc.querySelector('[data-act="undoReceipt"][data-ts="' + r15.ts + '"]').click();
  console.log("        asked: " + confirms.join(" | "));
  check("spent 54 -> 27", before.spent === 54 && pasta.spent === 27, before.spent + " -> " + pasta.spent);
  check("waste 1,5 -> 0", pasta.wasted === 0, before.wasted + " -> " + pasta.wasted);
  check("bought 3 -> 1,5 kg", pasta.boughtQty === 1.5);
  check("stock untouched (1,5 kg)", Math.abs(K.stockOf(pasta) - before.stock) < 1e-9 && before.stock === 1.5);
  check("saved now 13,5 (3 x 4,50 kr)", Math.abs(pasta.saved - 13.5) < 0.01, String(pasta.saved));

  console.log("\nNEW ENTRIES ARE LINKED, SO UNDO IS EXACT");
  const eggs = S.items.find((i) => i.name === "Eggs");
  $('nav button[data-tab="stock"]').click();
  $('[data-act="openStock"][data-id="' + eggs.id + '"]').click();
  const q = $("#stkQty"); q.value = "10"; q.dispatchEvent(new w.Event("input", { bubbles: true }));
  const pd = $("#stkPaid"); pd.value = "25"; pd.dispatchEvent(new w.Event("input", { bubbles: true }));
  $('[data-act="confirmStock"]').click();
  const rcpt = S.receipts[S.receipts.length - 1];
  check("receipt remembers its pack", Array.isArray(rcpt.lotIds) && rcpt.lotIds.length === 1);
  const st0 = K.stockOf(eggs);
  confirms = [];
  $('nav button[data-tab="money"]').click();
  doc.querySelector('[data-act="undoReceipt"][data-ts="' + rcpt.ts + '"]').click();
  check("undo takes the 10 eggs back out", Math.abs(K.stockOf(eggs) - (st0 - 10)) < 1e-9, st0 + " -> " + K.stockOf(eggs));
  check("…and asks only once", confirms.length === 1);

  // binned then undone: comes off waste
  $('nav button[data-tab="stock"]').click();
  $('[data-act="openStock"][data-id="' + eggs.id + '"]').click();
  q.value = "6"; q.dispatchEvent(new w.Event("input", { bubbles: true }));
  pd.value = "15"; pd.dispatchEvent(new w.Event("input", { bubbles: true }));
  $('[data-act="confirmStock"]').click();
  const r2 = S.receipts[S.receipts.length - 1];
  $('nav button[data-tab="stock"]').click();
  doc.querySelector('[data-act="dropLot"][data-lot*="' + r2.lotIds[0] + '"]').click();
  check("binned -> 6 eggs of waste", eggs.wasted === 6);
  $('nav button[data-tab="money"]').click();
  doc.querySelector('[data-act="undoReceipt"][data-ts="' + r2.ts + '"]').click();
  check("undo takes it back off waste, no extra question", eggs.wasted === 0);

  console.log("\n==== errors: " + (errors.length ? "\n" + errors.join("\n") : "none"));
  process.exit(errors.length ? 1 : 0);
}, 700);
