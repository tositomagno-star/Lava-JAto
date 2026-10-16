import { defineConfig } from "drizzle-kit";

const migrationUrl = process.env.LOVABLE_DB_MIGRATION_URL;
const migrationUrlWithSsl = migrationUrl
  ? (() => {
      const url = new URL(migrationUrl);
      url.searchParams.set("sslmode", "require");
      return url.toString();
    })()
  : "";

export default defineConfig({
  dialect: "postgresql",
  schema: "./drizzle/schema.ts",
  out: "./drizzle/migrations",
  dbCredentials: {
    url: migrationUrlWithSsl,
  },
});
