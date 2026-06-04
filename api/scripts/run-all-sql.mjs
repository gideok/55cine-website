/**
 * api/sql/*.sql 순서대로 실행
 */
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sqlDir = path.join(__dirname, "../sql");
const files = fs
  .readdirSync(sqlDir)
  .filter((f) => f.endsWith(".sql"))
  .sort();

for (const file of files) {
  const rel = `sql/${file}`;
  console.log(">>", rel);
  await new Promise((resolve, reject) => {
    const child = spawn("node", ["scripts/run-sql.mjs", rel], {
      cwd: path.join(__dirname, ".."),
      stdio: "inherit",
      shell: true
    });
    child.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`${rel} failed`))));
  });
}
console.log("All SQL migrations done.");
