/* The engine, lifted out of the single-file app so node can test it. */
const fs = require("fs");
const path = require("path");
const html = fs.readFileSync(path.join(__dirname, "..", "site", "index.html"), "utf8");
const blocks = html.match(/<script>([\s\S]*?)<\/script>/g).map((b) =>
  b.replace(/^<script>/, "").replace(/<\/script>$/, ""));
module.exports = eval(blocks[0] + "\n;Kurv;");
