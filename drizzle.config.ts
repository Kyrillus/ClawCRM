import { defineConfig } from "drizzle-kit";
import fs from "fs";

// Ensure data directory exists before drizzle-kit tries to open the DB
if (!fs.existsSync("./data")) {
  fs.mkdirSync("./data", { recursive: true });
}

export default defineConfig({
  schema: "./src/lib/db/schema.ts",
  out: "./drizzle",
  dialect: "sqlite",
  dbCredentials: {
    url: "./data/clawcrm.db",
  },
});
