/* Does a real v3 save still work? This is the only test that matters for data
 * already on the phone: no nut block, no budget prices, lots left wherever the
 * old automatic depletion had drained them to, and an asOf from days ago. */
const { JSDOM } = require("jsdom");
const html = require("fs").readFileSync(require("path").join(__dirname,"..","site","index.html"), "utf8");

const DAY = 86400000;
// Same formula the engine uses: UTC midnight of the LOCAL calendar date.
const now = new Date();
const todayDay = Math.floor(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) / DAY);

// Shaped exactly like the old build wrote it.
const v3 = {
  v: 3,
  month: "2026-10",
  settings: { coverDays: 7, dealPct: 10, maxCover: 120, aheadPct: 40 },
  items: [
    { id: "a", name: "Eggs", unit: "pc", perMonth: 60, shelfLife: 28, openLife: 0,
      coverDays: null, spent: 48, saved: 9, boughtQty: 20, wasted: 0,
      asOf: todayDay - 9,
      lots: [{ id: "x1", qty: 8, exp: todayDay + 6, open: todayDay - 4, bought: todayDay - 12 },
             { id: "x2", qty: 10, exp: todayDay - 2, open: null, bought: todayDay - 30 }],
      watch: [{ key: "netto|Æg 10 stk", pack: 10, name: "Æg 10 stk", store: "netto",
                lastPrice: 18, lastRegular: 24 }] },
    { id: "b", name: "Havregryn", unit: "kg", perMonth: 2, shelfLife: 300, openLife: 0,
      coverDays: null, spent: 0, saved: 0, boughtQty: 0, wasted: 0, asOf: todayDay - 9,
      lots: [{ id: "x3", qty: 0.6, exp: todayDay + 180, open: null, bought: todayDay - 20 }],
      watch: [] },
    { id: "c", name: "Mælk", unit: "L", perMonth: 8, shelfLife: 10, openLife: 5,
      coverDays: null, spent: 0, saved: 0, boughtQty: 0, wasted: 0, asOf: todayDay - 9,
      lots: [], watch: [] },
  ],
  receipts: [{ ts: Date.now() - 4 * DAY, day: todayDay - 4, itemId: "a", item: "Eggs",
               store: "netto", product: "Æg 10 stk", packs: 2, packQty: 10, unit: "pc",
               qty: 20, price: 18, total: 36, saved: 9 }],
  archive: [],
};

const errors = [];
const dom = new JSDOM(html, {
  runScripts: "dangerously", url: "https://x.test/", pretendToBeVisual: true,
  beforeParse(w) {
    w.indexedDB = undefined;
    w.fetch = () => Promise.reject(new Error("offline"));
    w.scrollTo = () => {};
    w.onerror = (m) => errors.push(String(m));
    // Seed storage the way a real device would have it.
    w.localStorage.setItem("kurv.v3", JSON.stringify(v3));
  },
});
const w = dom.window;
process.on("unhandledRejection", (e) => {
  if (!/offline|indexedDB/.test(String(e))) errors.push("reject: " + e);
});

setTimeout(() => {
  const app = w.Kurv_app, K = w.Kurv;
  if (!app) { console.log("DID NOT BOOT\n" + errors.join("\n")); process.exit(1); }
  const S = app.S();

  console.log("v3 SAVE LOADED");
  console.log("  version now: " + S.v + " (file says 4 is current)");
  console.log("  items kept: " + S.items.length + "  receipts kept: " + S.receipts.length);
  console.log("  nut block created: " + (S.nut ? "yes" : "NO"));
  console.log("  targets seeded: " + (S.nut && S.nut.targets ? Object.keys(S.nut.targets).length + " nutrients" : "NO"));
  console.log("  perMeal seeded: " + (S.nut && S.nut.perMeal ? JSON.stringify(S.nut.perMeal) : "NO"));

  // Budget prices should have been seeded from the lookout list where one existed.
  console.log("\nBUDGET PRICE MIGRATION");
  S.items.forEach((it) => {
    const bu = K.budgetUnitOf(it);
    console.log("  " + it.name.padEnd(12) +
      " bPrice " + (it.bPrice === undefined ? "(none)" : it.bPrice) +
      "  -> unit " + (bu === null ? "null" : bu.toFixed(2) + " kr/" + K.UNIT_PER[it.unit]) +
      "  budget " + (K.budgetOf(it) === null ? "—" : K.budgetOf(it).toFixed(0) + " kr"));
  });
  // Eggs had a watch entry with regular 24 for a 10-pack -> 2.40 kr/pc expected.
  const eggs = S.items.find((i) => i.id === "a");
  const eu = K.budgetUnitOf(eggs);
  console.log("  eggs seeded from the lookout list: " +
    (eu && Math.abs(eu - 2.4) < 0.02 ? "2,40 kr/stk  OK" : "got " + eu));

  // The expired lot must have been swept into waste, and the fresh one kept.
  console.log("\nEXPIRY SWEEP (no auto-depletion any more)");
  console.log("  eggs stock now: " + K.stockOf(eggs).toFixed(2) + " pcs  (8 fresh kept, 10 expired removed)");
  console.log("  eggs wasted: " + (eggs.wasted || 0).toFixed(2));
  if (Math.abs(K.stockOf(eggs) - 8) > 1e-6) errors.push("expiry sweep took the wrong lots");
  if (Math.abs((eggs.wasted || 0) - 10) > 1e-6) errors.push("expired lot was not counted as waste");

  // Oats: nothing expired, and crucially nothing eaten by the old day-replay.
  const oats = S.items.find((i) => i.id === "b");
  console.log("  oats stock unchanged by 9 idle days: " + K.stockOf(oats).toFixed(3) +
    (Math.abs(K.stockOf(oats) - 0.6) < 1e-6 ? "  OK (manual now)" : "  <-- STILL AUTO-DRAINING"));
  if (Math.abs(K.stockOf(oats) - 0.6) > 1e-6) errors.push("stock still drains automatically");

  // Stale month should have auto-closed and archived.
  console.log("\nMONTH ROLLOVER");
  console.log("  month: 2026-10 -> " + S.month + "  archived: " + S.archive.length);

  // Every tab must render on this data.
  console.log("\nTABS ON MIGRATED DATA");
  for (const tab of ["today", "stock", "money", "eat", "plan"]) {
    w.document.querySelector(`nav button[data-tab="${tab}"]`).click();
    const n = w.document.querySelector("#p-" + tab).textContent.trim().length;
    console.log("  " + tab.padEnd(6) + " " + String(n).padStart(5) + " chars" +
      (n < 40 ? "  <-- EMPTY" : ""));
    if (n < 40) errors.push(tab + " empty on migrated data");
  }

  // The Eat tab has no nutrition yet, so it must say so rather than break.
  w.document.querySelector('nav button[data-tab="eat"]').click();
  const eat = w.document.querySelector("#eatBody").textContent.replace(/\s+/g, " ");
  console.log("\n  eat tab with no nutrition: \"" + eat.slice(0, 130) + "…\"");

  // Money tab must use the seeded static prices.
  w.document.querySelector('nav button[data-tab="money"]').click();
  console.log("\n  money: " + w.document.querySelector("#moneyBody").textContent
    .replace(/\s+/g, " ").slice(0, 210));

  console.log("\n==== errors: " + (errors.length ? "\n" + errors.join("\n") : "none"));
  process.exit(errors.length ? 1 : 0);
}, 700);
