const K = require('./engine.js');
const T = K.today();

// Nutrition per 100 g / 100 ml / piece, from reference tables.
const F = {
  eggs:    {per:1,    serving:1,    gi:0,  price:2.5, unit:"pc",
    n:{kcal:72,protein:6.3,carb:0.4,fat:4.8,satfat:1.6,calcium:28,iron:0.9,vitd:1.1,
       b12:0.6,folate:24,vita:80,selenium:15,zinc:0.6,potassium:69,sodium:71,
       magnesium:6,b2:0.25,b6:0.07,b1:0.02,b3:0.03,vite:0.5,iodine:24,omega3:0.04}},
  oats:    {per:0.1,  serving:0.06, gi:55, price:20, unit:"kg",
    n:{kcal:389,protein:16.9,carb:66,fiber:10.6,fat:6.9,satfat:1.2,iron:4.7,
       magnesium:177,zinc:4,potassium:429,calcium:54,b1:0.76,folate:56,selenium:28,
       b2:0.14,b3:0.96,b6:0.12,vite:0.7,omega3:0.11,sugar:1}},
  milk:    {per:0.1,  serving:0.25, gi:31, price:10, unit:"L",
    n:{kcal:64,protein:3.4,carb:4.8,sugar:4.8,fat:3.6,satfat:2.3,calcium:120,
       potassium:150,b12:0.45,b2:0.18,vitd:0.1,iodine:15,magnesium:11,zinc:0.4,
       selenium:2,vita:46,b6:0.04,sodium:44}},
  chicken: {per:0.1,  serving:0.15, gi:0,  price:70, unit:"kg",
    n:{kcal:165,protein:31,fat:3.6,satfat:1,b3:13.7,b6:0.6,selenium:22,zinc:1,
       potassium:256,magnesium:29,b12:0.3,iron:0.7,sodium:74,vite:0.2,omega3:0.03}},
  pasta:   {per:0.1,  serving:0.1,  gi:50, price:15, unit:"kg",
    n:{kcal:371,protein:13,carb:75,fiber:3.2,fat:1.5,iron:1.3,magnesium:53,b1:0.1,
       folate:18,zinc:1.4,selenium:63,potassium:223,b3:1.7,sugar:2.7}},
  sauce:   {per:0.1,  serving:0.1,  gi:45, price:25, unit:"kg",
    n:{kcal:50,protein:1.6,carb:7,sugar:5,fat:1.5,fiber:1.5,vitc:10,vita:40,
       potassium:300,iron:0.8,magnesium:15,vitk:5,folate:10,sodium:400}},
  cheese:  {per:0.1,  serving:0.03, gi:0,  price:90, unit:"kg",
    n:{kcal:400,protein:25,carb:1.3,fat:33,satfat:21,calcium:720,sodium:620,
       vita:265,b12:1.1,zinc:3.1,selenium:14,b2:0.38,magnesium:28,potassium:98}},
  spinach: {per:0.1,  serving:0.1,  gi:15, price:40, unit:"kg",
    n:{kcal:23,protein:2.9,carb:3.6,fiber:2.2,iron:2.7,calcium:99,magnesium:79,
       potassium:558,vita:469,vitc:28,vitk:483,folate:194,b2:0.19,b6:0.2,vite:2,
       omega3:0.14,sodium:79}},
};

const items = [], foods = {};
for (const key in F) {
  const f = F[key];
  items.push({ id:key, name:key[0].toUpperCase()+key.slice(1), unit:f.unit,
    perMonth: 10, shelfLife:30, openLife:0, lots:[], asOf:T,
    spent:0, saved:0, boughtQty:0, wasted:0, watch:[],
    bPrice: f.price, bQty: 1, bUnit: f.unit === "pc" ? "pc" : (f.unit === "kg" ? "kg" : "L") });
  foods[key] = { per:f.per, serving:f.serving, gi:f.gi, n:f.n, capDay:3 };
}

const targets = JSON.parse(JSON.stringify(K.NUT_DEFAULTS));
const nut = {
  meals: 3, targets: targets,
  perMeal: { protein:60, gl:25, gi:0, kcalShare:0.5, soft:true },
  foods: foods,
  recipes: [{ id:"bake", name:"Pasta bake", serves:1, capDay:2,
    parts:[{itemId:"pasta",qty:0.1},{itemId:"sauce",qty:0.1},{itemId:"cheese",qty:0.025}] }],
};

const unitPrice = (it) => K.budgetUnitOf(it);

function show(label, r, nutObj) {
  console.log("\n===== " + label + " =====");
  if (!r.ok) { console.log("  FAILED: " + r.why); return r; }
  console.log("  solver: " + r.iters + " pivots, dishes considered: " + r.dishes.length);
  const names = ["Breakfast","Lunch","Dinner","Meal 4","Meal 5"];
  for (let m = 0; m < r.meals; m++) {
    const row = r.plate[m].map(e =>
      e.dish.name + " x" + (+e.servings.toFixed(2))).join(", ");
    console.log("  " + names[m] + ": " + (row || "(nothing)"));
  }
  console.log("  cost to buy: " + r.cost.toFixed(2) + " kr   from cupboard: " + r.stockValue.toFixed(2) + " kr");
  const t = r.totals;
  console.log("  kcal " + Math.round(t.kcal) + "  protein " + t.protein.toFixed(1) +
    "g  fibre " + t.fiber.toFixed(1) + "g  satfat " + t.satfat.toFixed(1) +
    "g  iron " + t.iron.toFixed(1) + "mg  calcium " + Math.round(t.calcium) + "mg");
  if (r.missed.length) {
    console.log("  SHORT: " + r.missed.map(x =>
      x.key + " by " + x.amount.toFixed(1) + " (" + Math.round(x.frac*100) + "% of target)").join(", "));
  } else console.log("  every floor met");
  if (r.over && r.over.length) {
    console.log("  OVER soft ceilings: " + r.over.map(x =>
      x.key + " by " + x.amount.toFixed(1)).join(", "));
  }
  // independent verification of the reported totals
  let chk = K.emptyNut();
  for (let m = 0; m < r.meals; m++) for (const e of r.plate[m])
    for (const k of K.NUT_KEYS) chk[k] += (e.dish.n[k]||0) * e.servings;
  let bad = 0;
  for (const k of K.NUT_KEYS) if (Math.abs(chk[k] - t[k]) > 1e-6) bad++;
  console.log("  totals self-check: " + (bad ? "MISMATCH on "+bad : "consistent"));
  // verify every hard ceiling actually holds
  let viol = [];
  for (const k of K.NUT_KEYS) {
    const tt = nutObj.targets[k];
    if (tt && tt.max > 0 && !tt.soft && t[k] > tt.max + 1e-4) viol.push(k);
  }
  console.log("  hard ceilings: " + (viol.length ? "VIOLATED "+viol.join(",") : "all respected"));
  return r;
}

// 1. empty cupboard
let t0 = Date.now();
let r = show("empty cupboard, buy everything", K.planDay(items, nut, T, {unitPrice}), nut);
console.log("  elapsed: " + (Date.now()-t0) + " ms");

// 2. yoghurt-style urgency: chicken expiring tomorrow should get eaten
const items2 = JSON.parse(JSON.stringify(items));
items2.find(i=>i.id==="chicken").lots = [{id:"c1",qty:0.25,exp:T+1,open:null,bought:T}];
items2.find(i=>i.id==="spinach").lots = [{id:"s1",qty:0.3,exp:T+30,open:null,bought:T}];
r = show("chicken expires TOMORROW, spinach in a month", K.planDay(items2, nut, T, {unitPrice}), nut);
const usedChicken = (r.useStock.find(u=>u.item.id==="chicken")||{qty:0}).qty;
const usedSpinach = (r.useStock.find(u=>u.item.id==="spinach")||{qty:0}).qty;
console.log("  chicken from stock: " + usedChicken.toFixed(3) + " kg of 0.25 available");
console.log("  spinach from stock: " + usedSpinach.toFixed(3) + " kg of 0.30 available");
console.log("  -> " + (usedChicken > 0.24 ? "PASS clears the expiring chicken" : "FAIL left " + (0.25-usedChicken).toFixed(3) + " kg to rot"));

// 3. hard ceilings
const nut3 = JSON.parse(JSON.stringify(nut));
nut3.targets.satfat = { max: 15, soft: false, w: 1 };
nut3.targets.kcal = { min: 2200, max: 2600, soft: false, w: 2 };
r = show("hard satfat 15 g and hard kcal ceiling", K.planDay(items, nut3, T, {unitPrice}), nut3);

// 4. the monotony test: no caps at all
const nut4 = JSON.parse(JSON.stringify(nut));
for (const k in nut4.foods) nut4.foods[k].capDay = 0;
nut4.recipes[0].capDay = 0;
r = show("caps removed (expect a silly answer)", K.planDay(items, nut4, T, {unitPrice}), nut4);
let distinct = 0;
for (let m=0;m<r.meals;m++) distinct += r.plate[m].length;
console.log("  dish-slots used: " + distinct + "  (low number = the monotony failure caps exist to prevent)");

// 5. impossible protein floor -> must report a shortfall, not crash
const nut5 = JSON.parse(JSON.stringify(nut));
nut5.targets.protein = { min: 400, w: 3 };
r = show("protein floor 400 g (unreachable)", K.planDay(items, nut5, T, {unitPrice}), nut5);
console.log("  -> " + (r.ok && r.missed.some(x=>x.key==="protein")
  ? "PASS reports the shortfall instead of failing" : "FAIL"));

// 6. recipe integrity: parts must be consumed in the cooked ratio
r = K.planDay(items, nut, T, {unitPrice});
let bakeServings = 0;
for (let m=0;m<r.meals;m++) for (const e of r.plate[m]) if (e.dish.key==="r:bake") bakeServings += e.servings;
console.log("\n===== recipe ratio check =====");
console.log("  pasta bake servings: " + bakeServings.toFixed(2));
const d = r.dishes.find(x=>x.key==="r:bake");
console.log("  one serving uses: " + Object.entries(d.uses).map(([k,v])=>k+" "+v).join(", "));
console.log("  -> ratio is fixed by construction, so sauce cannot be eaten alone via the recipe");

// 7. glycaemic load cap as an opt-in: should push starch out of the plate
console.log("\n===== glycaemic load cap, opt-in =====");
for (const cap of [0, 60, 25]) {
  const nx = JSON.parse(JSON.stringify(nut));
  nx.perMeal.gl = cap;
  const rr = K.planDay(items, nx, T, {unitPrice});
  let pastaIsh = 0;
  for (let m=0;m<rr.meals;m++) for (const e of rr.plate[m])
    if (e.dish.key==="i:pasta"||e.dish.key==="r:bake"||e.dish.key==="i:oats") pastaIsh += e.servings;
  const gl = (rr.totals.carb>0? (rr.dishes,0):0);
  console.log("  GL cap " + (cap||"off") + ": starchy servings " + pastaIsh.toFixed(2) +
    ", carbs " + rr.totals.carb.toFixed(0) + "g, kcal " + Math.round(rr.totals.kcal) +
    ", cost " + rr.cost.toFixed(2) + " kr" +
    (rr.over && rr.over.length ? " | over: "+rr.over.map(x=>x.key).join(",") : ""));
}

// 8. does the recipe actually get chosen, and does it stop sauce-only plates?
console.log("\n===== recipe selection =====");
for (const gl of [0, 25]) {
  const nx = JSON.parse(JSON.stringify(nut)); nx.perMeal.gl = gl;
  const rr = K.planDay(items, nx, T, {unitPrice});
  const take = (key) => { let v=0; for(let m=0;m<rr.meals;m++) for(const e of rr.plate[m]) if(e.dish.key===key) v+=e.servings; return v; };
  console.log("  GL " + (gl||"off") + ": pasta bake " + take("r:bake").toFixed(2) +
    ", raw pasta " + take("i:pasta").toFixed(2) + ", raw sauce " + take("i:sauce").toFixed(2));
}

// 9. sauce marked recipe-only: the failure the user predicted must disappear
console.log("\n===== sauce as an ingredient, not a meal =====");
for (const gl of [0, 25]) {
  const nx = JSON.parse(JSON.stringify(nut));
  nx.perMeal.gl = gl;
  nx.foods.sauce.soloOk = false;
  const rr = K.planDay(items, nx, T, {unitPrice});
  const take = (key) => { let v=0; for(let m=0;m<rr.meals;m++) for(const e of rr.plate[m]) if(e.dish.key===key) v+=e.servings; return v; };
  console.log("  GL " + (gl||"off") + ": pasta bake " + take("r:bake").toFixed(2) +
    ", raw pasta " + take("i:pasta").toFixed(2) + ", raw sauce " + take("i:sauce").toFixed(2) +
    "  | cost " + rr.cost.toFixed(2) + " kr, kcal " + Math.round(rr.totals.kcal));
}
