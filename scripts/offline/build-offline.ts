import { createHash } from "node:crypto";
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { gzipSync } from "node:zlib";

const outputDirectory = "out";

function listFiles(relativeDirectory: string): string[] {
  return readdirSync(join(outputDirectory, relativeDirectory), { withFileTypes: true })
    .flatMap((entry) => {
      const path = `${relativeDirectory}/${entry.name}`;
      if (entry.isDirectory()) return listFiles(path);
      return entry.isFile() && !path.endsWith(".map") ? [path] : [];
    });
}

function hash(content: Buffer | string): string {
  return createHash("sha256").update(content).digest("hex");
}

// Cache every emitted static chunk, including fonts and lazy solver workers.
// Public artwork is explicitly limited to the assets used by all vial skins.
const files = [
  "index.html",
  "manifest.webmanifest",
  "offline-icon-192.png",
  "offline-icon-512.png",
  "vials/mad-alchemist.svg",
  "vials/classic.svg",
  "potions/compact/vial/glass_front.png",
  "potions/compact/vial/glass_back.png",
  ...["cork", "wax", "crystal", "orb", "moon"].flatMap((name) => [
    `potions/compact/toppers/${name}.png`,
    `potions/stoppers/${name}.svg`,
  ]),
  ...listFiles("_next/static"),
].sort();

const uniqueFiles = [...new Set(files)];
if (!uniqueFiles.some((path) => path.endsWith(".js"))) {
  throw new Error("No exported JavaScript chunks found.");
}

let totalBytes = 0;
let javascriptBytes = 0;
let compressedJavascriptBytes = 0;
const entries = uniqueFiles.map((path) => {
  const content = readFileSync(join(outputDirectory, path));
  if (content.length === 0) throw new Error(`Empty offline asset: ${path}`);
  totalBytes += content.length;
  if (path.endsWith(".js")) {
    javascriptBytes += content.length;
    compressedJavascriptBytes += gzipSync(content).length;
  }
  return { path, sha256: hash(content) };
});

const worker = readFileSync("scripts/offline/service-worker.js", "utf8");
const version = hash(JSON.stringify(entries) + worker);
writeFileSync(
  join(outputDirectory, "sw.js"),
  `const CACHE_VERSION = ${JSON.stringify(version)};\nconst PRECACHE_ENTRIES = ${JSON.stringify(entries)};\n${worker}`,
);
console.log(`Offline cache: ${entries.length} assets, ${totalBytes} bytes; version ${version.slice(0, 12)}.`);
console.log(`Exported JavaScript: ${javascriptBytes} bytes; gzip estimate: ${compressedJavascriptBytes} bytes (all chunks, not initial transfer).`);
