/* Each way Google refuses a key, in the shape Google actually sends it. */
const { JSDOM } = require("jsdom");
const path = require("path");
const html = require("fs").readFileSync(path.join(__dirname, "..", "site", "index.html"), "utf8");

const ERR = (code, status, message, reason) => ({ error: { code, status, message,
  details: reason ? [{ "@type": "type.googleapis.com/google.rpc.ErrorInfo", reason,
    domain: "googleapis.com" }] : [] } });
const CASES = {
  invalid:  [400, ERR(400, "INVALID_ARGUMENT", "API key not valid. Please pass a valid API key.", "API_KEY_INVALID")],
  referrer: [403, ERR(403, "PERMISSION_DENIED", "Requests from referer https://mohgsaad-art.github.io/ are blocked.", "API_KEY_HTTP_REFERRER_BLOCKED")],
  service:  [403, ERR(403, "PERMISSION_DENIED", "Requests to this API generativelanguage.googleapis.com method google.ai.generativelanguage.v1beta.GenerativeService.GenerateContent are blocked.", "API_KEY_SERVICE_BLOCKED")],
  disabled: [403, ERR(403, "PERMISSION_DENIED", "Generative Language API has not been used in project 123 before or it is disabled. Enable it by visiting https://console.developers.google.com/...", "SERVICE_DISABLED")],
  ios:      [403, ERR(403, "PERMISSION_DENIED", "Requests from this iOS client application <empty> are blocked.", "API_KEY_IOS_APP_BLOCKED")],
  region:   [400, ERR(400, "FAILED_PRECONDITION", "User location is not supported for the API use.", null)],
};
let mode = "invalid", calls = [], refs = [], auths = [];
const reply = (st, b) => Promise.resolve({ ok: st < 300, status: st, text: () => Promise.resolve(JSON.stringify(b)) });

const dom = new JSDOM(html, {
  runScripts: "dangerously", url: "https://mohgsaad-art.github.io/grocer/", pretendToBeVisual: true,
  beforeParse(w) {
    w.indexedDB = undefined; w.scrollTo = () => {};
    w.fetch = (url, opts) => {
      const u = String(url);
      if (!u.includes("generativelanguage")) return Promise.reject(new Error("offline"));
      calls.push(u.includes("/models?") ? "LIST" : "GEN");
      refs.push(opts && opts.referrerPolicy);
      const how = u.includes("key=") ? "query" : (opts && opts.headers && opts.headers["x-goog-api-key"] ? "header" : "none");
      auths.push(how);
      // A key that only works one way, and refuses the other as Google does.
      const refuse = () => reply(401, ERR(401, "UNAUTHENTICATED", "API key not valid. Please pass a valid API key.", "ACCESS_TOKEN_TYPE_UNSUPPORTED"));
      const okGen = () => u.includes("/models?")
        ? reply(200, { models: [{ name: "models/gemini-3.8-flash", supportedGenerationMethods: ["generateContent"] }] })
        : reply(200, { candidates: [{ content: { parts: [{ text: '{"kcal":2}' }] } }] });
      if (mode === "headerOnly") return how === "header" ? okGen() : refuse();
      if (mode === "queryOnly") return how === "query" ? okGen() : refuse();
      if (mode === "ok") {
        if (u.includes("/models?")) return reply(200, { models: [
          { name: "models/gemini-2.5-flash", supportedGenerationMethods: ["generateContent"] }] });
        return reply(200, { candidates: [{ content: { parts: [{ text: '{"kcal":1}' }] } }] });
      }
      const [st, body] = CASES[mode];
      return reply(st, body);
    };
  },
});
const w = dom.window;
process.on("unhandledRejection", (e) => { if (!/offline|indexedDB/.test(String(e))) console.log("reject", e); });
const errors = [];

setTimeout(async () => {
  const app = w.Kurv_app, S = app.S();
  S.nut.models = "a, b, c, d, e"; S.nut.lastModel = "";

  // ---- the key cleaner
  const dirty = "​AIza" + "x".repeat(35) + " \n”";
  const clean = app.cleanKey(dirty);
  console.log("cleanKey: " + JSON.stringify(dirty).slice(0, 24) + "… -> " + clean.length + " chars, " +
    (clean === "AIza" + "x".repeat(35) ? "clean" : "STILL DIRTY"));
  if (clean !== "AIza" + "x".repeat(35)) errors.push("cleanKey left junk in");
  console.log("shape: ya29 -> " + app.keyShapeWarning("ya29.abc"));
  console.log("shape: short -> " + app.keyShapeWarning("AIzaSyShort"));
  console.log("shape: good AIza -> \"" + app.keyShapeWarning("AIza" + "x".repeat(35)) + "\"");
  const aq = "AQ." + "Ab8RN6".repeat(8) + "xy";
  console.log("shape: good AQ. (" + aq.length + " chars) -> \"" + app.keyShapeWarning(aq) + "\"");
  if (app.keyShapeWarning(aq)) errors.push("a valid-looking AQ. key was called wrong");
  console.log("shape: neither -> " + app.keyShapeWarning("sk-abcdef"));
  console.log("cleanKey keeps the dot in AQ.: " + (app.cleanKey(" " + aq + "\n") === aq));

  // ---- each refusal stops on the first model and names its fix
  S.nut.key = "AIza" + "x".repeat(35);
  console.log("");
  for (const m of Object.keys(CASES)) {
    mode = m; calls = []; refs = [];
    const r = await new Promise((res) => app.geminiFetch("p", (e, o, i) => res({ e, i })));
    // A "not valid" refusal is retried once the other way on the same model,
    // so it costs exactly two calls; every other key refusal costs one.
    const want = m === "invalid" ? 2 : 1;
    const stopped = calls.length === want;
    console.log(m.padEnd(9) + (stopped ? "stopped after " + want + " call" + (want > 1 ? "s " : "  ") : "TRIED " + calls.length + " TIMES  ") +
      "| " + r.e.slice(0, 150) + (r.e.length > 150 ? "…" : ""));
    if (!stopped) errors.push(m + ": did not stop on a key-level refusal");
    if (!/Google said/.test(r.e)) errors.push(m + ": Google's own message was dropped");
  }

  // ---- a key that only works in the header, and one that only works in the address
  S.nut.authMode = "";
  mode = "headerOnly"; calls = []; auths = [];
  let rr = await new Promise((res) => app.geminiFetch("p", (e, o, i) => res({ e, i })));
  console.log("\nheader-only key: " + (rr.e ? "FAILED " + rr.e : "ok via " + rr.i.auth) + " in " + calls.length + " call(s)");
  if (rr.e || calls.length !== 1) errors.push("header-only key should work first time");

  mode = "queryOnly"; calls = []; auths = [];
  rr = await new Promise((res) => app.geminiFetch("p", (e, o, i) => res({ e, i })));
  console.log("address-only key: " + (rr.e ? "FAILED " + rr.e : "ok via " + rr.i.auth) + " after " + auths.join(" > ") +
    "  | remembered: " + S.nut.authMode);
  if (rr.e || S.nut.authMode !== "query") errors.push("fallback to ?key= did not work or was not remembered");
  calls = []; auths = [];
  await new Promise((res) => app.geminiFetch("p", () => res()));
  console.log("next call goes straight to: " + auths[0]);
  if (auths[0] !== "query") errors.push("remembered auth mode not used");

  mode = "queryOnly"; S.nut.authMode = ""; calls = []; auths = [];
  const listed = await new Promise((res) => app.geminiDiscover((e, n) => res(e || n)));
  console.log("Check key with an address-only key: " + [].concat(listed).join(", ") + " via " + auths.join(" > "));
  if (!Array.isArray(listed)) errors.push("discovery did not fall back to ?key=");
  S.nut.authMode = "";

  // ---- the referrer is sent in full on both calls
  mode = "ok"; refs = [];
  await new Promise((res) => app.geminiFetch("p", () => res()));
  await new Promise((res) => app.geminiDiscover(() => res()));
  console.log("\nreferrerPolicy on generate + list: " + refs.join(", "));
  if (refs.some((x) => x !== "no-referrer-when-downgrade")) errors.push("full referrer not sent");

  // ---- the Check key button, failing then working
  S.nut.key = "AIza" + "x".repeat(35);
  w.document.querySelector('nav button[data-tab="plan"]').click();
  w.document.querySelector('#p-plan [data-act="openFoods"]').click();
  mode = "referrer";
  w.document.querySelector('[data-act="findModels"]').click();
  await new Promise((r) => setTimeout(r, 50));
  const bad = w.document.querySelector("#keyStatus").textContent;
  console.log("\nCheck key (referrer-blocked): " + bad.slice(0, 210) + "…");
  if (!/Website restrictions/.test(bad) || !/mohgsaad-art\.github\.io\/\*/.test(bad))
    errors.push("check-key did not give the referrer fix with this site's address");

  mode = "ok";
  w.document.querySelector('[data-act="findModels"]').click();
  await new Promise((r) => setTimeout(r, 50));
  const good = w.document.querySelector("#keyStatus").textContent;
  console.log("Check key (working): " + good);
  if (!/Key works/.test(good)) errors.push("check-key did not confirm a working key");

  // ---- pasting a dirty key into the field stores it clean
  const kf = w.document.querySelector('[data-act="geminiset"][data-f="key"]');
  kf.value = " AIza" + "y".repeat(35) + "\n";
  kf.dispatchEvent(new w.Event("input", { bubbles: true }));
  console.log("pasted with spaces/newline -> stored " + S.nut.key.length + " chars");
  if (S.nut.key !== "AIza" + "y".repeat(35)) errors.push("pasted key not cleaned");

  console.log("\n==== errors: " + (errors.length ? "\n" + errors.join("\n") : "none"));
  process.exit(errors.length ? 1 : 0);
}, 700);
