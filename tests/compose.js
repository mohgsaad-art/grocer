/* Meals assembled from roles instead of recipes: one base and one protein per
 * meal, toppings only on what they go with, offers and spoilage steering which. */
const K = require("./engine.js");
const errors = [];
const check = (l, ok, x) => { console.log((ok ? "  ok   " : "  FAIL ") + l + (x ? "  " + x : "")); if (!ok) errors.push(l); };
const T = K.today();
const it = (id, name, unit, stock, exp) => ({ id, name, unit, perMonth: 1, shelfLife: 30, openLife: 0, watch: [], asOf: T,
  lots: stock ? [{ id: id + "1", qty: stock, exp: T + (exp || 100), open: null, bought: T }] : [] });
const items = [it("pas","Pasta","kg",2), it("ris","Ris","kg",1), it("oat","Havregryn","kg",1), it("tun","Tun i vand","pc",3),
  it("kyl","Kyllingebryst","kg",0.4, 2), it("egg","Æg","pc",10), it("ost","Revet ost","kg",0.2), it("sau","Pasta sauce","L",0.5),
  it("pm","Protein mælk","L",0), it("ban","Banan","pc",4), it("oatm","Oat milk","L",1)];
const F = (o) => Object.assign({ per: 0.1, serving: 0.1, capDay: 3 }, o);
const foods = {
  pas: F({ n: { kcal: 359, protein: 12.5, carb: 70, fiber: 3, iron: 1.3 }, gi: 50 }),
  ris: F({ n: { kcal: 350, protein: 7, carb: 78, iron: 0.8 }, gi: 70 }),
  oat: F({ n: { kcal: 370, protein: 13, carb: 58, fiber: 10, iron: 4 }, meals: [0], gi: 55, serving: 0.08 }),
  tun: F({ per: 1, serving: 1, n: { kcal: 110, protein: 25, iron: 1, b12: 2, selenium: 60 } }),
  kyl: F({ serving: 0.15, n: { kcal: 110, protein: 23, b3: 10, b6: 0.5 } }),
  egg: F({ per: 1, serving: 1, n: { kcal: 72, protein: 6.3, fat: 4.8, iron: 0.9, b12: 0.5, vitd: 1 } }),
  ost: F({ serving: 0.03, n: { kcal: 350, protein: 26, calcium: 750, satfat: 15 }, goesWith: ["pas", "egg", "ris"] }),
  sau: F({ n: { kcal: 52, protein: 1.6, carb: 8, vitc: 8, potassium: 300 }, goesWith: ["pas", "ris"], ratio: 1.5 }),
  pm: F({ serving: 0.5, n: { kcal: 60, protein: 7, calcium: 120, b12: 0.4 } }),
  ban: F({ per: 1, serving: 1, n: { kcal: 105, carb: 27, potassium: 420, vitc: 10, b6: 0.4 } }),
  oatm: F({ n: { kcal: 47, protein: 1, carb: 6.6, calcium: 120 }, goesWith: ["oat"], role: "topping", ratio: 2.5 }),
};
const nut = { meals: 4, mealNames: ["Breakfast","Lunch","Dinner","Snacks"], foods, recipes: [],
  targets: JSON.parse(JSON.stringify(K.NUT_DEFAULTS)), perMeal: { protein: 60, kcalShare: 0.6, soft: true } };

const role = (id) => K.roleOf(foods[id], items.find((i) => i.id === id));
console.log("ROLE GUESSES");
[["pas","base"],["ris","base"],["oat","base"],["tun","protein"],["kyl","protein"],["egg","protein"],["ost","topping"],["sau","topping"],["pm","drink"],["ban","side"]]
  .forEach(([id, want]) => check(items.find((i) => i.id === id).name + " -> " + want, role(id) === want, role(id)));

for (const k of ["pas","ris","tun","kyl"]) foods[k].meals = [1,2];
foods.egg.meals = [0,1,3];
const price = { pas: 18, ris: 20, oat: 12, tun: 9, kyl: 70, egg: 2.5, ost: 80, sau: 20, pm: 22, ban: 2, oatm: 15 };
function show(r) { r.plate.forEach((p, m) => console.log("        " + nut.mealNames[m] + ": " + p.map((e) => e.dish.name + " x" + (+e.servings.toFixed(2))).join(" + "))); }
function verify(r, tag) {
  check(tag + ": solved", r.ok);
  let one = true, tops = true, oatsCheese = false, whole = true;
  r.plate.forEach((p, m) => {
    const b = p.filter((e) => e.dish.role === "base"), pr = p.filter((e) => e.dish.role === "protein");
    if (b.length > 1 || pr.length > 1) one = false;
    p.filter((e) => e.dish.role === "topping").forEach((t) => {
      const gw = foods[t.dish.id].goesWith;
      const hosts = p.filter((e) => (e.dish.role === "base" || e.dish.role === "protein") && (!gw || gw.indexOf(e.dish.id) >= 0));
      const room = hosts.reduce((a, e) => a + e.servings, 0) * (foods[t.dish.id].ratio || 1);
      if (!hosts.length || t.servings > room + 1e-6) tops = false;
    });
    // cheese may share a meal with oats only if something it goes with is there too
    if (p.some((e) => e.dish.id === "oat") && p.some((e) => e.dish.id === "ost") &&
        !p.some((e) => ["pas", "egg", "ris"].indexOf(e.dish.id) >= 0)) oatsCheese = true;
    p.forEach((e) => { if (Math.abs(e.servings - Math.round(e.servings)) > 1e-6) whole = false; });
  });
  check(tag + ": at most one base and one protein per meal", one);
  check(tag + ": toppings only on what they go with, in proportion", tops);
  check(tag + ": no cheese on oats", !oatsCheese);
  check(tag + ": whole servings", whole);
}

console.log("\nFROM THE CUPBOARD (chicken spoils in 2 days)");
let t0 = Date.now();
let r = K.planDay(items, nut, T, { unitPrice: (i) => price[i.id] });
show(r); verify(r, "cupboard");
check("chicken that spoils soon gets eaten", r.plate.flat().some((e) => e.dish.id === "kyl"));
check("pasta split over lunch and dinner, not 200 g in one", r.plate.every((p) => p.filter((e) => e.dish.id === "pas").every((e) => e.servings <= 1)));
check("pasta only at lunch/dinner", r.plate.every((p, m) => !p.some((e) => e.dish.id === "pas") || m === 1 || m === 2));
check("fast enough for a phone (" + (Date.now() - t0) + " ms)", Date.now() - t0 < 2000);

console.log("\nTUNA RUNS OUT, CHICKEN IS GONE; TUNA ON OFFER VS PROTEIN MILK");
items.find((i) => i.id === "tun").lots = [];
items.find((i) => i.id === "kyl").lots = [];
items.find((i) => i.id === "egg").lots = [];
r = K.planDay(items, nut, T, { unitPrice: (i) => price[i.id] });
show(r); verify(r, "shopping");
console.log("        buy: " + r.buy.map((b) => b.item.name + " " + b.qty.toFixed(2)).join(", "));
check("protein comes from the shop when the cupboard has none", r.buy.some((b) => ["tun","egg","kyl"].indexOf(b.item.id) >= 0));

console.log("\nTWO EQUIVALENT TUNAS: THE OFFER DECIDES");
items.push(it("tun2", "Tun i olie", "pc", 0));
foods.tun2 = JSON.parse(JSON.stringify(foods.tun));
price.tun = 9; price.tun2 = 15;
r = K.planDay(items, nut, T, { unitPrice: (i) => price[i.id] });
const qty = (r, id) => (r.buy.find((b) => b.item.id === id) || { qty: 0 }).qty;
console.log("        9 vs 15 kr -> " + qty(r, "tun") + " / " + qty(r, "tun2"));
check("buys the one on offer", qty(r, "tun") > 0 && qty(r, "tun2") === 0);
price.tun = 15; price.tun2 = 9;
r = K.planDay(items, nut, T, { unitPrice: (i) => price[i.id] });
console.log("        15 vs 9 kr -> " + qty(r, "tun") + " / " + qty(r, "tun2"));
check("and switches when the offer moves", qty(r, "tun2") > 0 && qty(r, "tun2") >= qty(r, "tun"));
verify(r, "offer");

console.log("\n==== errors: " + (errors.length ? errors.join(" | ") : "none"));
process.exit(errors.length ? 1 : 0);
