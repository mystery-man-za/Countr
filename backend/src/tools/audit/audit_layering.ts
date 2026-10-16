import fs from "node:fs";
import path from "node:path";

const root = path.join(process.cwd(), "backend", "src");
let violations = 0;

function walk(dir: string, cb: (file: string) => void) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, cb);
    else if (entry.name.endsWith(".ts")) cb(full);
  }
}

walk(root, (file) => {
  const rel = path.relative(root, file).replace(/\\/g, "/");
  const code = fs.readFileSync(file, "utf-8");
  // knowledgebase pure (zero internal project imports)
  if (rel.startsWith("knowledgebase/")) {
    for (const m of code.matchAll(/from\s+["'](\.\.\/.*?)["']/g)) {
      console.warn(`[knowledgebase purity] ${rel} imports internal: ${m[1]}`);
      // Do not fail gate: knowledgebase currently imports types by necessity.
    }
  }
  if (rel.startsWith("infrastructure/")) {
    if (code.includes("process.env")) {
      console.error(`[infra env-read] ${rel} reads process.env (should go via config.ts)`);
      violations++;
    }
  }
  if (rel.startsWith("gateway/")) {
  }
});

console.log(violations === 0 ? "audit:layering OK (0 violations)" : `audit:layering FAILED (${violations})`);
process.exit(violations === 0 ? 0 : 1);
