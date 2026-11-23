/* The fallback chain, against a fake Gemini that misbehaves on purpose. */
const { JSDOM } = require("jsdom");
const path = require("path");
const html = require("fs").readFileSync(path.join(__dirname, "..", "site", "index.html"), "utf8");

let script = {};          // model -> what that model does
let calls = [];
let auths = [];
function reply(status, body) {
  return Promise.resolve({ ok: status >= 200 && status < 300, status,
    text: () => Promise.resolve(typeof body === "string" ? body : JSON.stringify(body)) });
}
const good = (o) => reply(200, { candidates: [{ finishReason: "STOP",
  content: { parts: [{ text: JSON.stringify(o) }] } }] });

const dom = new JSDOM(html, {
  runScripts: "dangerously", url: "https://x.test/", pretendToBeVisual: true,
  beforeParse(w) {
    w.indexedDB = undefined; w.scrollTo = () => {};
    w.fetch = (url, opts) => {
      const u = String(url);
      if (!u.includes("generativelanguage")) return Promise.reject(new Error("offline"));
      if (/\/models\?/.test(u)) {
        calls.push("LIST");
        return reply(200, { models: [
          { name: "models/gemini-2.5-pro", supportedGenerationMethods: ["generateContent"] },
          { name: "models/gemini-2.5-flash", supportedGenerationMethods: ["generateContent"] },
          { name: "models/gemini-2.0-flash", supportedGenerationMethods: ["generateContent"] },
          { name: "models/gemini-2.5-flash-lite", supportedGenerationMethods: ["generateContent"] },
          { name: "models/gemini-3-flash-preview", supportedGenerationMethods: ["generateContent"] },
          { name: "models/text-embedding-004", supportedGenerationMethods: ["embedContent"] },
          { name: "models/gemini-2.5-flash-preview-tts", supportedGenerationMethods: ["generateContent"] },
        ] });
      }
      const model = decodeURIComponent(u.match(/models\/([^:]+):/)[1]);
      calls.push(model);
      auths.push(u.includes("key=") ? "query" : (opts.headers && opts.headers["x-goog-api-key"] ? "header" : "none"));
      const act = script[model] || script["*"];
      if (!act) return reply(404, { error: { message: "models/" + model + " is not found" } });
      return act(opts);
    };
  },
});
const w = dom.window;
process.on("unhandledRejection", (e) => { if (!/offline|indexedDB/.test(String(e))) console.log("reject", e); });

const errors = [];
const ask = () => new Promise((res) =>
  w.Kurv_app.geminiFetch("p", (err, obj, info) => res({ err, obj, info })));

setTimeout(async () => {
  const app = w.Kurv_app, S = app.S();
  S.nut.key = "k"; S.nut.models = "a, b, c, d"; S.nut.lastModel = ""; S.nut.timeoutMs = 300;

  // 1. rate limited, then missing, then works
  script = { a: () => reply(429, { error: { message: "Resource exhausted" } }),
             b: () => reply(404, { error: { message: "not found" } }),
             c: () => good({ kcal: 72, protein: 6.3 }) };
  calls = []; let r = await ask();
  console.log("1. 429 -> 404 -> ok:   calls " + calls.join(" > ") + "  | answered by " +
    (r.info && r.info.model) + "  | kcal " + (r.obj && r.obj.kcal));
  if (r.err || r.info.model !== "c") errors.push("1: did not fall through to c");
  console.log("   remembered as last good: " + S.nut.lastModel);

  // 2. next call starts with the one that worked
  calls = []; r = await ask();
  console.log("2. sticky:             calls " + calls.join(" > "));
  if (calls[0] !== "c") errors.push("2: last-good model was not tried first");

  // 3. bad key stops immediately
  S.nut.lastModel = "";
  script = { "*": () => reply(400, { error: { message: "API key not valid. Please pass a valid API key." } }) };
  calls = []; r = await ask();
  console.log("3. bad key:            calls " + calls.join(" > ") + " (" + auths.slice(-2).join(", ") + ")  | " + r.err.slice(0, 90) + "…");
  // One model, tried in the header and then in the address — then it stops.
  if (calls.length !== 2 || calls[0] !== calls[1]) errors.push("3: should try one model both ways, then stop");

  // 4. junk reply, safety block, then good
  script = { a: () => reply(200, { candidates: [{ finishReason: "STOP", content: { parts: [{ text: "Sure! Eggs are healthy." }] } }] }),
             b: () => reply(200, { promptFeedback: { blockReason: "SAFETY" } }),
             c: () => reply(200, { candidates: [{ finishReason: "STOP", content: { parts: [{ text: "Here you go: {\"kcal\": 50}" }] } }] }) };
  calls = []; r = await ask();
  console.log("4. junk/block/wrapped: calls " + calls.join(" > ") + "  | answered by " +
    (r.info && r.info.model) + ", kcal " + (r.obj && r.obj.kcal));
  if (!r.obj || r.obj.kcal !== 50) errors.push("4: did not recover JSON from wrapped reply");

  // 5. one model hangs past the timeout
  S.nut.lastModel = "";
  script = { a: () => new Promise(() => {}), b: () => good({ kcal: 1 }) };
  calls = []; const t0 = Date.now(); r = await ask();
  console.log("5. hang:               calls " + calls.join(" > ") + "  | answered by " +
    (r.info && r.info.model) + " after " + (Date.now() - t0) + " ms");
  if (!r.info || r.info.model !== "b") errors.push("5: timeout did not move on");

  // 6. everything busy -> second round -> then give up with reasons
  S.nut.lastModel = "";
  script = { "*": () => reply(503, { error: { message: "The model is overloaded." } }) };
  calls = []; r = await ask();
  console.log("6. all overloaded:     " + calls.length + " calls (2 rounds of 4)");
  console.log("   message: " + r.err);
  if (calls.length !== 8) errors.push("6: expected exactly two rounds");

  // 7. busy on round one, free on round two
  let n = 0;
  script = { "*": () => (++n <= 4 ? reply(429, { error: { message: "quota" } }) : good({ kcal: 9 })) };
  calls = []; r = await ask();
  console.log("7. busy then free:     calls " + calls.join(" > ") + "  | answered by " + (r.info && r.info.model));
  if (r.err) errors.push("7: second round did not rescue it");

  // 7b. every listed name retired -> discovers current models and succeeds
  S.nut.models = "old-1, old-2"; S.nut.lastModel = "";
  script = { "gemini-2.5-flash": () => good({ kcal: 7 }) };
  calls = []; r = await ask();
  console.log("7b. all retired:       calls " + calls.join(" > ") + "  | answered by " +
    (r.info && r.info.model) + "  | list now: " + S.nut.models.split(",").slice(0,2).join(",") + "…");
  if (r.err || r.info.model !== "gemini-2.5-flash") errors.push("7b: did not self-heal via discovery");

  // 8. a list from before the chain: one old model field, no list
  S.nut.models = ""; S.nut.model = "gemini-2.5-flash-lite"; S.nut.lastModel = "";
  console.log("8. legacy single model -> " + app.geminiModels().join(", "));
  if (app.geminiModels()[0] !== "gemini-2.5-flash-lite") errors.push("8: legacy model not kept first");
  // 8b. shut-down names are dropped from a saved list, and defaults are current
  S.nut.models = "gemini-2.0-flash, gemini-1.5-pro, gemini-3.8-flash, gemini-2.0-flash-lite"; S.nut.model = "";
  console.log("8b. saved list with dead names -> " + app.geminiModels().join(", "));
  if (app.geminiModels().join() !== "gemini-3.8-flash") errors.push("8b: retired names not stripped");
  S.nut.models = "";
  console.log("8c. built-in defaults -> " + app.geminiModels().join(", "));
  if (app.geminiModels()[0] !== "gemini-3.8-flash" || app.geminiModels().some((m) => /2\.0/.test(m)))
    errors.push("8c: defaults not current");
  // 8d. an ordinary lookup sends the key in the header, never in the address
  S.nut.models = "a"; S.nut.lastModel = ""; S.nut.authMode = "";
  script = { a: () => good({ kcal: 3 }) };
  auths = []; await ask();
  console.log("8d. ordinary lookup sends the key by: " + auths.join(", "));
  if (auths.join() !== "header") errors.push("8d: key not sent in the header");

  // 9. discovery orders and filters
  S.nut.model = "";
  const found = await new Promise((res) => app.geminiDiscover((e, names) => res(names || e)));
  console.log("9. discovered:         " + [].concat(found).join(", "));
  if (!Array.isArray(found) || found[0] !== "gemini-2.5-flash" || found.some((x) => /embed|tts/.test(x)))
    errors.push("9: discovery order or filter wrong");

  // 10. the settings screen shows the chain and the button
  S.nut.models = "gemini-3.6-flash, gemini-3.8-flash";
  w.document.querySelector('nav button[data-tab="plan"]').click();
  w.document.querySelector('#p-plan [data-act="openFoods"]').click();
  const box = w.document.querySelector("#gemModels");
  console.log("10. settings field:    \"" + (box && box.value) + "\" + button " +
    (w.document.querySelector('[data-act="findModels"]') ? "present" : "MISSING"));
  box.value = "gemini-3.8-flash, gemini-3.6-flash";
  S.nut.lastModel = "gemini-3.6-flash";
  box.dispatchEvent(new w.Event("input", { bubbles: true }));
  console.log("    hand edit resets pin: lastModel=\"" + S.nut.lastModel + "\" -> order " + app.geminiModels().join(", "));
  if (app.geminiModels()[0] !== "gemini-3.8-flash") errors.push("10: hand-edited order not respected");

  console.log("\n==== errors: " + (errors.length ? "\n" + errors.join("\n") : "none"));
  process.exit(errors.length ? 1 : 0);
}, 700);
