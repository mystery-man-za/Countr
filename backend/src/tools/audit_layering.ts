// Simple layering audit: forbidden cross-layer edges (cotrade-style).
// Exit non-zero on any violation so it can gate CI (`npm run audit:layers`).
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
  // domain/* must have no internal project imports
  if (rel.startsWith("domain/")) {
    for (const m of code.matchAll(/from\s+["'](\.\.\/.*?)["']/g)) {
      console.error(`[domain purity] ${rel} imports internal: ${m[1]}`);
      violations++;
    }
  }
  // infrastructure/db must not read process.env or reach into gateway/presentation/application
  if (rel.startsWith("infrastructure/")) {
    if (code.includes("process.env")) {
      console.error(`[infra env-read] ${rel} reads process.env (should go via config.ts)`);
      violations++;
    }
  }
  // gateway must not import server/presentation/persistent internal web stacking
  if (rel.startsWith("gateway/")) {
    for (const line of code.split(/\r?\n/)) {
      if (/from\s+["']\.\.\/(?!(shared|config)).*["']/.test(line) &&
          (line.includes("application/") || line.includes("presentation/"))) {
        console.warn(`[gateway isolation] ${rel}: ${line.trim()} (debt; introduce port)`);
      }
    }
  }
  // application/* should not import infra/db directly except adapters
  if (rel.startsWith("application/services/")) {
    if (/from\s+["']\.\.\/\.\.\/infrastructure\/db["']/.test(code)) {
      console.warn(`[application uses db directly] ${rel} (debt; consolidate in Stage 3)`);
    }
  }
});

console.log(violations === 0 ? "audit:layering OK (0 violations)" : `audit:layering FAILED (${violations})`);
process.exit(violations === 0 ? 0 : 1);
