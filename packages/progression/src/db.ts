import { Prisma, PrismaClient } from "../generated/client/index.js";

export type Transaction = Prisma.TransactionClient;

export function readDatabaseUrl(value = process.env.DATABASE_URL) {
  if (!value) return undefined;
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error("DATABASE_URL must be a PostgreSQL connection URL.");
  }
  if (
    !["postgres:", "postgresql:"].includes(parsed.protocol) ||
    !parsed.hostname ||
    parsed.pathname.length < 2
  )
    throw new Error("DATABASE_URL must select a PostgreSQL database.");
  return value;
}

export function createDatabase(url: string) {
  return new PrismaClient({ datasourceUrl: url });
}

export class ProgressionError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status = 409,
  ) {
    super(message);
  }
}

export function databaseCode(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError
    ? error.code
    : undefined;
}

export async function transaction<T>(
  db: PrismaClient,
  action: (tx: Transaction) => Promise<T>,
) {
  // PostgreSQL can abort serializable transactions under simultaneous purchases,
  // claims and run settlements. Retry only known write conflicts.
  for (let attempt = 0; ; attempt++) {
    try {
      return await db.$transaction(action, {
        isolationLevel: "Serializable",
        timeout: 10000,
      });
    } catch (error) {
      if (
        attempt >= 6 ||
        !["P2002", "P2034"].includes(databaseCode(error) ?? "")
      )
        throw error;
      await new Promise((resolve) => setTimeout(resolve, 12 * (attempt + 1)));
    }
  }
}
