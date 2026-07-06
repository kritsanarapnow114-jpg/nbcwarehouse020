// Runs `prisma migrate deploy` with retries.
//
// On serverless Postgres (Neon), the compute auto-suspends when idle. The first
// connection from a cold Vercel build wakes it, but Prisma's migration advisory
// lock times out after ~10s (error P1002), which fails the whole build. Retrying
// gives the database time to wake and the previous lock time to release.
import { spawnSync } from "node:child_process";

const MAX_ATTEMPTS = 6;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const res = spawnSync("npx", ["--no-install", "prisma", "migrate", "deploy"], {
      stdio: "inherit",
      shell: true,
    });

    if (res.status === 0) {
      if (attempt > 1) console.log(`✓ migrate deploy succeeded on attempt ${attempt}`);
      process.exit(0);
    }

    if (attempt === MAX_ATTEMPTS) {
      console.error(`✗ migrate deploy failed after ${MAX_ATTEMPTS} attempts`);
      process.exit(res.status ?? 1);
    }

    const waitSec = attempt * 8; // 8s, 16s, 24s, 32s, 40s
    console.warn(
      `migrate deploy attempt ${attempt}/${MAX_ATTEMPTS} failed (likely a cold/locked database) — retrying in ${waitSec}s…`
    );
    await sleep(waitSec * 1000);
  }
}

main();
