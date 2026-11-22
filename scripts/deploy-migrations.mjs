import { spawnSync } from "node:child_process";

if (!process.env.DATABASE_URL) {
  console.log("Skipping Prisma migration: DATABASE_URL is not configured.");
  process.exit(0);
}

const result = spawnSync("npx", ["prisma", "migrate", "deploy"], {
  stdio: "inherit",
  shell: true,
});

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}
