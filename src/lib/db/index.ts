import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";

import * as schema from "./schema";

type Database = ReturnType<typeof createDb>;

function createDb() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set");
  }
  return drizzle(neon(url), { schema, casing: "snake_case" });
}

let instance: Database | null = null;

// Lazy proxy so `next build` can import route modules without DATABASE_URL.
export const db: Database = new Proxy({} as Database, {
  get(_target, prop) {
    instance ??= createDb();
    return Reflect.get(instance, prop, instance);
  },
});

export { schema };
