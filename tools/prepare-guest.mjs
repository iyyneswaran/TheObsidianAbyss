import { randomBytes } from "node:crypto";
import { writeFileSync } from "node:fs";

if (
  !process.env.GUEST_SESSION_SECRET &&
  process.env.NODE_ENV !== "production"
) {
  try {
    writeFileSync(
      new URL("../.guest-key", import.meta.url),
      randomBytes(32).toString("hex") + "\n",
      {
        flag: "wx",
        mode: 0o600,
      },
    );
  } catch (error) {
    if (error.code !== "EEXIST") throw error;
  }
}
