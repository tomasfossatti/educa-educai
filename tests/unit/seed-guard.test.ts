import { describe, expect, it } from "vitest";
import { seedBlockReason } from "../../prisma/seed/guard";

const local = "postgresql://educai:educai@localhost:5432/educai";
const remote = "postgresql://u:p@dpg-abc.oregon-postgres.render.com/educai";

describe("seedBlockReason", () => {
  it("permite una base local", () => {
    expect(seedBlockReason({ DATABASE_URL: local })).toBeNull();
    expect(seedBlockReason({ DATABASE_URL: "postgresql://educai:educai@db:5432/educai" })).toBeNull();
  });
  it("rechaza producción aunque la base sea local", () => {
    expect(seedBlockReason({ DATABASE_URL: local, NODE_ENV: "production" })).toMatch(/producción/);
    expect(seedBlockReason({ DATABASE_URL: local, APP_ENV: "production" })).toMatch(/producción/);
  });
  it("rechaza una base remota salvo SEED_ALLOW_REMOTE=1", () => {
    expect(seedBlockReason({ DATABASE_URL: remote })).toMatch(/no es local/);
    expect(seedBlockReason({ DATABASE_URL: remote, SEED_ALLOW_REMOTE: "1" })).toBeNull();
  });
  it("rechaza sin DATABASE_URL", () => {
    expect(seedBlockReason({})).toMatch(/DATABASE_URL/);
  });
});
