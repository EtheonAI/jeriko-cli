import { customType } from "drizzle-orm/pg-core";

/**
 * pgvector custom type for Drizzle ORM
 * Stores embeddings as vector(N) columns in PostgreSQL with pgvector extension
 */
export const vector = (name: string, config: { dimensions: number }) =>
  customType<{ data: number[]; driverData: string }>({
    dataType() {
      return `vector(${config.dimensions})`;
    },
    toDriver(value: number[]): string {
      return `[${value.join(",")}]`;
    },
    fromDriver(value: string): number[] {
      // pgvector returns strings like "[0.1,0.2,0.3]"
      return value.slice(1, -1).split(",").map(Number);
    },
  })(name);
