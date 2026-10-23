import fs from "node:fs";
import path from "node:path";

const url = process.env.DATABASE_URL ?? "";
if (!url.startsWith("file:")) {
  console.error("DATABASE_URL must be a sqlite file: URL.");
  process.exit(1);
}

let file = url.slice("file:".length);
const query = file.indexOf("?");
if (query >= 0) file = file.slice(0, query);
file = decodeURIComponent(file);
if (!path.isAbsolute(file)) {
  file = path.resolve("prisma", file);
}

fs.mkdirSync(path.dirname(file), { recursive: true });
console.log("SQLite directory is ready.");
