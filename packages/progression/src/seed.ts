import { catalog } from "@obsidian/game-core";
import { createDatabase, readDatabaseUrl } from "./db.js";
import { rotationVersion, staticQuestCatalog } from "./quests.js";

const url = readDatabaseUrl();
if (!url) throw new Error("Set DATABASE_URL before seeding progression.");
const db = createDatabase(url);
try {
  const entries = [
    ...catalog.map((data) => ({
      id: "ability-" + data.id,
      kind: "ability",
      version: rotationVersion,
      data,
    })),
    ...staticQuestCatalog().map((data) => ({
      id: "quest-" + data.key,
      kind: "quest",
      version: rotationVersion,
      data,
    })),
  ];
  await db.$transaction(
    entries.map((entry) =>
      db.catalogEntry.upsert({
        where: { id: entry.id },
        create: entry,
        update: entry,
      }),
    ),
  );
  console.log("Seeded " + entries.length + " catalog entries.");
} finally {
  await db.$disconnect();
}
