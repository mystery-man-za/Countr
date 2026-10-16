const cmd = process.argv[2] ?? "serve";

async function main() {
  if (cmd === "serve") {
    await import("./commands/serve");
  } else if (cmd === "doctor") {
    const { runDoctor } = await import("./commands/doctor");
    const code = await runDoctor();
    process.exit(code);
  } else if (cmd === "switch-symbol") {
    const { runSwitchSymbol } = await import("./commands/switch-symbol");
    const code = await runSwitchSymbol(process.argv[3]);
    process.exit(code);
  } else {
    console.log("Usage: tsx backend/src/cli/app.ts [serve|doctor|switch-symbol <symbol>]");
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
