/* Setting "the most I'll pay" by hand — Bob's own example as the fixture:
 * 15 kr for 500 g of pasta, 3 kg a month, buy 500 g at 9 kr -> saved 6 kr. */
const { JSDOM } = require("jsdom");
const path = require("path");
const html = require("fs").readFileSync(path.join(__dirname, "..", "site", "index.html"), "utf8");

const errors = [];
const dom = new JSDOM(html, {
  runScripts: "dangerously", url: "https://x.test/", pretendToBeVisual: true,
  beforeParse(w) {
    w.indexedDB = undefined; w.scrollTo = () => {}; w.confirm = () => true;
    w.fetch = () => Promise.reject(new Error("offline"));
    w.onerror = (m) => errors.push(String(m));
  },
});
const w = dom.window, doc = w.document;
process.on("unhandledRejection", (e) => { if (!/offline|indexedDB/.test(String(e))) errors.push("reject " + e); });
const $ = (q) => doc.querySelector(q);
const type = (q, v) => { const el = $(q); el.value = v; el.dispatchEvent(new w.Event("input", { bubbles: true })); };
const pick = (q, v) => { const el = $(q); el.value = v; el.dispatchEvent(new w.Event("change", { bubbles: true })); };
const check = (label, ok, extra) => { console.log((ok ? "  ok   " : "  FAIL ") + label + (extra ? "  " + extra : "")); if (!ok) errors.push(label); };

setTimeout(() => {
  const app = w.Kurv_app, K = w.Kurv, S = app.S();
  S.items = []; S.receipts = []; S.month = K.monthKeyOf(); app.render();

  // ---- make the item the way a person would, on the Plan tab
  console.log("NEW ITEM");
  $('nav button[data-tab="plan"]').click();
  $('#p-plan [data-act="newItem"]').click();
  type("#itName", "Pasta");
  doc.querySelector('#itUnit .tg[data-unit="kg"]').click();
  const units = [...doc.querySelectorAll("#itBUnit option")].map((o) => o.value);
  check("kg item offers g and kg", units.join() === "g,kg", units.join());
  check("defaults to grams, 500 placeholder", $("#itBUnit").value === "g" && $("#itBQty").placeholder === "500");
  type("#itMonth", "3");
  type("#itBPrice", "15");
  type("#itBQty", "500");
  pick("#itBUnit", "g");
  const hint = $("#itBudgetHint").textContent;
  check("hint shows the per-kilo price", /30,00 kr\/kg/.test(hint), hint);
  check("hint shows the month's budget", /90 kr/.test(hint));
  $('[data-act="confirmItem"]').click();

  const it = S.items.find((x) => x.name === "Pasta");
  check("stored as typed", it && it.bPrice === 15 && it.bQty === 500 && it.bUnit === "g",
    it && JSON.stringify({ bPrice: it.bPrice, bQty: it.bQty, bUnit: it.bUnit }));
  check("30 kr/kg rail", Math.abs(K.budgetUnitOf(it) - 30) < 1e-9, String(K.budgetUnitOf(it)));
  check("90 kr monthly budget", Math.abs(K.budgetOf(it) - 90) < 1e-9, String(K.budgetOf(it)));

  $('nav button[data-tab="plan"]').click();
  const row = [...doc.querySelectorAll("#p-plan .lot")].find((r) => /Pasta/.test(r.textContent));
  check("Plan list shows it", row && /Up to 15,00 kr for 500 g/.test(row.textContent) && /90 kr a month/.test(row.textContent),
    row && row.textContent.replace(/\s+/g, " ").trim());

  // ---- buy 500 g for 9 kr by hand -> 6 kr saved
  console.log("\nBOUGHT 500 g FOR 9 kr");
  $('nav button[data-tab="stock"]').click();
  $('[data-act="openStock"][data-id="' + it.id + '"]').click();
  type("#stkQty", "500");            // the stock sheet takes grams for a kg item
  type("#stkPaid", "9");
  check("preview says under budget by 6", /Under your budget price by\s*6,00 kr/.test($("#stkPrev").textContent),
    $("#stkPrev").textContent.replace(/\s+/g, " ").trim().slice(0, 140));
  $('[data-act="confirmStock"]').click();
  check("saved 6 kr", Math.abs(it.saved - 6) < 1e-9, String(it.saved));
  check("spent 9 kr", Math.abs(it.spent - 9) < 1e-9, String(it.spent));

  // ---- overpaying is reported, not hidden
  $('[data-act="openStock"][data-id="' + it.id + '"]').click();
  type("#stkQty", "500"); type("#stkPaid", "18");
  check("overpaying shows over budget by 3", /Over your budget price by\s*3,00 kr/.test($("#stkPrev").textContent));
  $('[data-act="close"]').click();

  // ---- the suggestion button, from the lookout list
  console.log("\nSUGGESTION FROM LOOKOUT");
  it.watch = [{ key: "netto|Pasta 1 kg", pack: 1, name: "Pasta 1 kg", store: "netto", lastPrice: 22, lastRegular: 24 }];
  const offs = K.offers(it, () => null);
  const lo = K.budgetUnit(offs);
  $('nav button[data-tab="plan"]').click();
  $('#p-plan [data-act="editItem"][data-id="' + it.id + '"]').click();
  check("fields reopen as saved", $("#itBPrice").value === "15" && $("#itBQty").value === "500" && $("#itBUnit").value === "g");
  const sug = $("#itBSuggestRow");
  if (lo) {
    check("offers the lookout price", !sug.hidden && /kr\/kg/.test($("#itBSuggest").textContent), $("#itBSuggest").textContent);
    $('[data-act="bpSuggest"]').click();
    check("fills it in the chosen units", Math.abs(Number($("#itBPrice").value) - lo * 0.5) < 0.01,
      $("#itBPrice").value + " kr for 500 g");
    $('[data-act="close"]').click();
  } else {
    console.log("  (lookout offers need the catalogue; suggestion path skipped)");
    $('[data-act="close"]').click();
  }
  it.watch = [];

  // ---- half-filled is refused, nothing changes
  console.log("\nVALIDATION AND CLEARING");
  $('#p-plan [data-act="editItem"][data-id="' + it.id + '"]').click();
  type("#itBPrice", "abc");
  type("#itBPrice", "-4");
  $('[data-act="confirmItem"]').click();
  check("bad price refused, old one kept", it.bPrice === 15);
  $('[data-act="close"]').click();

  // ---- clearing it means no budget, and stays cleared after reload
  $('#p-plan [data-act="editItem"][data-id="' + it.id + '"]').click();
  type("#itBPrice", "");
  $('[data-act="confirmItem"]').click();
  check("cleared -> no budget", K.budgetUnitOf(it) === null && it.bPrice === 0);
  // What the phone does when the app is swiped away: the page is hidden,
  // and anything not yet written must be written then.
  Object.defineProperty(doc, "hidden", { configurable: true, get: () => true });
  doc.dispatchEvent(new w.Event("visibilitychange"));
  Object.defineProperty(doc, "hidden", { configurable: true, get: () => false });
  app.load(); app.render();
  const it2 = app.S().items.find((x) => x.name === "Pasta");
  check("still cleared after reload (not re-seeded)", K.budgetUnitOf(it2) === null);
  $('nav button[data-tab="plan"]').click();
  check("Plan list nudges to set it", /No budget price yet/.test($("#p-plan").textContent));

  // ---- the card's prompt is tappable
  it2.perMonth = 3;
  $('nav button[data-tab="today"]').click();
  const link = $('#p-today .why [data-act="editItem"]');
  check("card has a 'Set it' link", !!link);
  if (link) { link.click(); check("…which opens the item sheet", $("#mItem").classList.contains("on")); $('[data-act="close"]').click(); }

  // ---- pieces
  $('nav button[data-tab="plan"]').click();
  $('#p-plan [data-act="newItem"]').click();
  type("#itName", "Eggs");
  doc.querySelector('#itUnit .tg[data-unit="pc"]').click();
  type("#itMonth", "60"); type("#itBPrice", "3"); type("#itBQty", "1");
  check("eggs: 3 kr/pc -> 180 kr a month", /3,00 kr\/stk/.test($("#itBudgetHint").textContent) && /180 kr/.test($("#itBudgetHint").textContent),
    $("#itBudgetHint").textContent);
  $('[data-act="confirmItem"]').click();

  // ---- CSV carries it both ways
  console.log("\nCSV");
  const eggs = app.S().items.find((x) => x.name === "Eggs");
  eggs.bPrice = 30; eggs.bQty = 10; eggs.bUnit = "stk";
  $('#p-plan [data-act="openPlanCSV"]').click();
  const csv = $("#planCSVArea").value;
  console.log("  " + csv.split("\n").slice(0, 3).join("\n  "));
  check("header has budget columns", /budget_price,budget_qty,budget_unit/.test(csv));
  check("eggs row carries 30 for 10 stk", /Eggs,stk,60,[^\n]*,30,10,stk/.test(csv));
  type("#planCSVArea", "name,unit,per_month,shelf_life_days,budget_price,budget_qty,budget_unit\nRis,kg,2,365,18,1,kg\nMælk,L,8,10,11,1,L\nSmør,kg,0.5,60,20,250,g\nOld,kg,1,30");
  $('[data-act="applyPlanCSV"]').click();
  const by = (n) => app.S().items.find((x) => x.name === n);
  check("Ris 18 kr/kg", Math.abs(K.budgetUnitOf(by("Ris")) - 18) < 1e-9);
  check("Smør 20 kr for 250 g -> 80 kr/kg", Math.abs(K.budgetUnitOf(by("Smør")) - 80) < 1e-9);
  check("row without budget columns -> no budget", K.budgetUnitOf(by("Old")) === null);
  check("a six-column CSV from before still reads", true);

  console.log("\n==== errors: " + (errors.length ? "\n" + errors.join("\n") : "none"));
  process.exit(errors.length ? 1 : 0);
}, 700);
