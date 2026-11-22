const { JSDOM } = require("jsdom");
const fs = require("fs");
const html = fs.readFileSync(require("path").join(__dirname,"..","site","index.html"), "utf8");

const errors = [];
const dom = new JSDOM(html, {
  runScripts: "dangerously", url: "https://x.test/", pretendToBeVisual: true,
  beforeParse(w) {
    w.indexedDB = undefined;
    w.fetch = () => Promise.reject(new Error("offline in test"));
    w.confirm = () => true;
    w.alert = () => {};
    w.onerror = (m) => errors.push("onerror: " + m);
    w.scrollTo = () => {};
  },
});
const w = dom.window;
process.on("unhandledRejection", (e) => {
  if (!/offline in test|indexedDB/.test(String(e))) errors.push("reject: " + e);
});

const click = (sel) => {
  const el = w.document.querySelector(sel);
  if (!el) { errors.push("missing selector " + sel); return false; }
  el.click(); return true;
};
const fire = (el, type) => el.dispatchEvent(new w.Event(type, { bubbles: true }));

setTimeout(() => {
  const app = w.Kurv_app, K = w.Kurv;
  if (!app) { console.log("APP DID NOT BOOT\n" + errors.join("\n")); process.exit(1); }
  const S = app.S();
  const T = K.today();

  // ---- a realistic plan with nutrition, a recipe and some stock
  S.items = [
    { id:"eggs", name:"Eggs", unit:"pc", perMonth:60, shelfLife:28, openLife:0, coverDays:null,
      lots:[{id:"l1",qty:12,exp:T+10,open:null,bought:T}], asOf:T, spent:30, saved:6,
      boughtQty:20, wasted:0, watch:[], bPrice:2.5, bQty:1, bUnit:"stk" },
    { id:"oats", name:"Oats", unit:"kg", perMonth:2, shelfLife:300, openLife:0, coverDays:null,
      lots:[{id:"l2",qty:0.9,exp:T+200,open:T-3,bought:T-10}], asOf:T, spent:0, saved:0,
      boughtQty:0, wasted:0, watch:[], bPrice:20, bQty:1, bUnit:"kg" },
    { id:"chicken", name:"Chicken", unit:"kg", perMonth:2, shelfLife:5, openLife:2, coverDays:null,
      lots:[{id:"l3",qty:0.3,exp:T+1,open:null,bought:T}], asOf:T, spent:0, saved:0,
      boughtQty:0, wasted:0, watch:[], bPrice:70, bQty:1, bUnit:"kg" },
    { id:"pasta", name:"Pasta", unit:"kg", perMonth:3, shelfLife:365, openLife:0, coverDays:null,
      lots:[], asOf:T, spent:0, saved:0, boughtQty:0, wasted:0, watch:[],
      bPrice:15, bQty:1, bUnit:"kg" },
    { id:"sauce", name:"Pasta sauce", unit:"kg", perMonth:2, shelfLife:400, openLife:5,
      coverDays:null, lots:[], asOf:T, spent:0, saved:0, boughtQty:0, wasted:0, watch:[],
      bPrice:25, bQty:1, bUnit:"kg" },
    { id:"milk", name:"Milk", unit:"L", perMonth:8, shelfLife:10, openLife:5, coverDays:null,
      lots:[], asOf:T, spent:0, saved:0, boughtQty:0, wasted:0, watch:[],
      bPrice:10, bQty:1, bUnit:"L" },
  ];
  const N = (o) => Object.assign(K.emptyNut(), o);
  S.nut.foods = {
    eggs:    { per:1, serving:1, gi:0, capDay:3, soloOk:true, n:N({kcal:72,protein:6.3,carb:0.4,fat:4.8,satfat:1.6,calcium:28,iron:0.9,vitd:1.1,b12:0.6,folate:24,vita:80,selenium:15,zinc:0.6,potassium:69,sodium:71,magnesium:6,b2:0.25,b6:0.07,iodine:24,vite:0.5,omega3:0.04}) },
    oats:    { per:0.1, serving:0.06, gi:55, capDay:3, soloOk:true, n:N({kcal:389,protein:16.9,carb:66,fiber:10.6,fat:6.9,satfat:1.2,iron:4.7,magnesium:177,zinc:4,potassium:429,calcium:54,b1:0.76,folate:56,selenium:28,b3:0.96,b6:0.12,vite:0.7,omega3:0.11}) },
    chicken: { per:0.1, serving:0.15, gi:0, capDay:2, soloOk:true, n:N({kcal:165,protein:31,fat:3.6,satfat:1,b3:13.7,b6:0.6,selenium:22,zinc:1,potassium:256,magnesium:29,b12:0.3,iron:0.7,sodium:74}) },
    pasta:   { per:0.1, serving:0.1, gi:50, capDay:3, soloOk:false, n:N({kcal:371,protein:13,carb:75,fiber:3.2,fat:1.5,iron:1.3,magnesium:53,b1:0.1,folate:18,selenium:63,potassium:223}) },
    sauce:   { per:0.1, serving:0.1, gi:45, capDay:3, soloOk:false, n:N({kcal:50,protein:1.6,carb:7,sugar:5,fat:1.5,fiber:1.5,vitc:10,vita:40,potassium:300,iron:0.8,sodium:400}) },
    milk:    { per:0.1, serving:0.25, gi:31, capDay:3, soloOk:true, n:N({kcal:64,protein:3.4,carb:4.8,sugar:4.8,fat:3.6,satfat:2.3,calcium:120,potassium:150,b12:0.45,b2:0.18,vitd:0.1,iodine:15,magnesium:11,vita:46}) },
  };
  S.nut.recipes = [{ id:"bake", name:"Pasta bake", serves:2, capDay:2, ownNut:false,
    parts:[{itemId:"pasta",qty:0.2},{itemId:"sauce",qty:0.2}] }];
  S.month = K.monthKeyOf();
  S.receipts = [];
  app.render();

  // ---- every tab renders
  console.log("TABS");
  for (const tab of ["today","stock","money","eat","plan"]) {
    click(`nav button[data-tab="${tab}"]`);
    const body = w.document.querySelector("#p-" + tab).textContent.trim();
    console.log("  " + tab.padEnd(6) + " " + String(body.length).padStart(5) + " chars" +
      (body.length < 40 ? "   <-- SUSPICIOUSLY EMPTY" : ""));
    if (body.length < 40) errors.push(tab + " rendered almost nothing");
  }

  // ---- the plate
  click('nav button[data-tab="eat"]');
  const eat = w.document.querySelector("#eatBody").textContent.replace(/\s+/g, " ");
  console.log("\nEAT TAB\n  " + eat.slice(0, 620));

  const totalBefore = S.items.reduce((a,i)=>a+K.stockOf(i),0);
  const nAte = w.document.querySelectorAll('[data-act="ateOne"]').length;
  const nMeal = w.document.querySelectorAll('[data-act="ateMeal"]').length;
  console.log("\n  'Ate it' buttons: " + nAte + " | 'Ate all of' buttons: " + nMeal);

  // ---- eat one dish and confirm stock actually moves
  if (nAte) {
    w.document.querySelector('[data-act="ateOne"]').click();
    const logged = S.nut.log.length;
    const totalAfter = S.items.reduce((a,i)=>a+K.stockOf(i),0);
    console.log("  after one 'Ate it': log entries " + logged +
      ", total stock " + totalBefore.toFixed(3) + " -> " + totalAfter.toFixed(3) +
      (totalAfter < totalBefore ? "  (drew down)" : "  (bought, not from stock)"));
    if (!logged) errors.push("eating a dish logged nothing");
  }

  // ---- eat a whole meal
  click('nav button[data-tab="eat"]');
  const stockBefore = S.items.reduce((a,i)=>a+K.stockOf(i),0);
  if (w.document.querySelector('[data-act="ateMeal"]')) {
    w.document.querySelector('[data-act="ateMeal"]').click();
    const stockAfter = S.items.reduce((a,i)=>a+K.stockOf(i),0);
    console.log("  after 'Ate all of': total stock " + stockBefore.toFixed(3) +
      " -> " + stockAfter.toFixed(3) + (stockAfter < stockBefore ? "  (drew down)" : "  (NO CHANGE)"));
  }

  // ---- manual consume sheet
  click('nav button[data-tab="stock"]');
  console.log("\nMANUAL CONSUME");
  if (click('[data-act="openAte"][data-id="oats"]')) {
    const chips = w.document.querySelectorAll('#ateChips .tg').length;
    console.log("  sheet open, quick chips: " + chips);
    const chip1 = w.document.querySelector('#ateChips .tg');
    if (chip1) chip1.click(); else errors.push("no quick chips in the Ate sheet");
    console.log("  chip prefilled: " + w.document.querySelector("#ateQty").value +
      " | preview: " + w.document.querySelector("#atePrev").textContent.replace(/\s+/g," ").trim());
    const o0 = K.stockOf(S.items.find(i=>i.id==="oats"));
    click('[data-act="confirmAte"]');
    const o1 = K.stockOf(S.items.find(i=>i.id==="oats"));
    console.log("  oats " + o0.toFixed(3) + " -> " + o1.toFixed(3) +
      (o1 < o0 ? "  OK" : "  FAILED TO CONSUME"));
    if (!(o1 < o0)) errors.push("manual consume did not reduce stock");
  }

  // ---- settings: every target editable
  click('nav button[data-tab="plan"]');
  console.log("\nSETTINGS");
  click('[data-act="openTargets"]');
  const mins = w.document.querySelectorAll('[data-act="nutset"][data-f="min"]').length;
  const maxs = w.document.querySelectorAll('[data-act="nutset"][data-f="max"]').length;
  const softs = w.document.querySelectorAll('[data-act="nutsoft"]').length;
  const ws = w.document.querySelectorAll('[data-act="nutset"][data-f="w"]').length;
  console.log("  targets sheet: " + mins + " floors, " + maxs + " ceilings, " +
    softs + " soft toggles, " + ws + " weight selects (of " + K.NUTRIENTS.length + " nutrients)");
  if (mins !== K.NUTRIENTS.length) errors.push("not every nutrient is editable");

  // edit iron, as the user asked for
  const ironMin = w.document.querySelector('[data-act="nutset"][data-k="iron"][data-f="min"]');
  ironMin.value = "18"; fire(ironMin, "input");
  console.log("  set iron floor to 18 -> stored " + S.nut.targets.iron.min);
  if (S.nut.targets.iron.min !== 18) errors.push("iron target did not stick");

  // soft -> hard on satfat
  const sf = w.document.querySelector('[data-act="nutsoft"][data-k="satfat"]');
  sf.click();
  console.log("  satfat soft -> " + (S.nut.targets.satfat.soft === false ? "hard  OK" : "still soft  FAIL"));

  // kcal must be soft and editable
  const kcalMax = w.document.querySelector('[data-act="nutset"][data-k="kcal"][data-f="max"]');
  kcalMax.value = "2600"; fire(kcalMax, "input");
  console.log("  kcal ceiling -> " + S.nut.targets.kcal.max +
    ", soft = " + (S.nut.targets.kcal.soft !== false));

  // ---- per-meal sheet
  click('[data-act="close"]');
  click('nav button[data-tab="plan"]');
  click('[data-act="openPerMeal"]');
  const pmFields = w.document.querySelectorAll('[data-act="mealset"]').length;
  console.log("  per-meal sheet: " + pmFields + " fields");
  const gl = w.document.querySelector('[data-act="mealset"][data-f="gl"]');
  gl.value = "30"; fire(gl, "input");
  console.log("  glycaemic load cap -> " + S.nut.perMeal.gl);
  if (S.nut.perMeal.gl !== 30) errors.push("GL cap did not stick");

  // ---- foods + recipes
  click('[data-act="close"]');
  click('nav button[data-tab="plan"]');
  click('[data-act="openFoods"]');
  console.log("  foods sheet rows: " + w.document.querySelectorAll('[data-act="openFood"]').length);
  click('[data-act="openFood"][data-id="eggs"]');
  const nutInputs = w.document.querySelectorAll('[data-act="foodnut"]').length;
  console.log("  food editor: " + nutInputs + " nutrient fields, solo toggle " +
    (w.document.querySelector('[data-act="foodsolo"]') ? "present" : "MISSING"));
  click('[data-act="closeFood"]');
  click('[data-act="close"]');
  click('nav button[data-tab="plan"]');
  click('[data-act="openRecipes"]');
  console.log("  recipes sheet rows: " + w.document.querySelectorAll('[data-act="openRecipe"]').length);
  click('[data-act="openRecipe"][data-id="bake"]');
  console.log("  recipe editor: parts " + w.document.querySelectorAll('[data-act="rpart"]').length +
    ", own-profile toggle " + (w.document.querySelector('[data-act="rown"]') ? "present" : "MISSING"));
  w.document.querySelector('[data-act="rown"][data-v="1"]').click();
  console.log("  own profile on -> " + S.nut.recipes[0].ownNut +
    ", nutrient fields " + w.document.querySelectorAll('[data-act="rnut"]').length);

  // ---- a settings change must invalidate the cached plate
  click('[data-act="closeRecipe"]'); click('[data-act="close"]');
  click('nav button[data-tab="eat"]');
  const t1 = w.document.querySelector("#eatBody").textContent.length;
  S.nut.targets.protein.min = 200; app.nutTouched && app.nutTouched();
  click('nav button[data-tab="eat"]');
  console.log("\n  plate re-rendered after a target change: " +
    (w.document.querySelector("#eatBody").textContent.length !== t1 ? "yes" : "same length (may be fine)"));

  // ---- backup must not carry the key
  S.nut.key = "SECRET123";
  // Capture the text handed to Blob directly: jsdom's Blob does not reliably
  // expose .text() across versions, and this is the thing being asserted.
  let exported = null;
  const RealBlob = w.Blob;
  w.Blob = function (parts, opts) { exported = String(parts && parts[0]); return new RealBlob(parts, opts); };
  w.URL.createObjectURL = () => "blob:x";
  w.URL.revokeObjectURL = () => {};
  click('nav button[data-tab="plan"]');
  click('[data-act="export"]');
  console.log("\nBACKUP");
  if (exported === null) {
    errors.push("could not capture the backup payload");
  } else {
    const has = exported.indexOf("SECRET123") >= 0;
    const keptItems = exported.indexOf('"items"') >= 0;
    console.log("  backup written: " + exported.length + " bytes, items included: " + keptItems);
    console.log("  API key in backup: " + (has ? "YES  <-- LEAK" : "no  OK"));
    if (has) errors.push("API key leaked into backup");
    if (!keptItems) errors.push("backup did not contain the items");
  }
  console.log("\n==== errors: " + (errors.length ? "\n" + errors.join("\n") : "none"));
  process.exit(errors.length ? 1 : 0);
}, 700);
