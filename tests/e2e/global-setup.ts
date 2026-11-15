import { execSync } from "node:child_process";

/** Aplica las migraciones en la base de los flujos de punta a punta. */
export default function globalSetup() {
  execSync("npx prisma migrate deploy", { stdio: "inherit", env: { ...process.env, DATABASE_URL: process.env.E2E_DATABASE_URL } });
}
