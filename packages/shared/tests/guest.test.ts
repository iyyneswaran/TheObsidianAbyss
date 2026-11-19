import { randomBytes } from "node:crypto";
import { expect, it } from "vitest";
import { createGuestSessions, createRequestLimit } from "../src/guest.js";

it("signs host-only HttpOnly guest cookies and refreshes the same verified identity", () => {
  const guests = createGuestSessions(randomBytes(32).toString("hex"));
  const cookie = guests.issue(undefined, true);
  expect(cookie).toContain("HttpOnly; SameSite=Lax; Secure");
  const identity = guests.verify(cookie);
  expect(identity?.guestId).toMatch(/^[a-f0-9-]{36}$/);
  expect(guests.verify(guests.issue(cookie, true))?.guestId).toBe(
    identity?.guestId,
  );
  expect(guests.verify(guests.issue(undefined, false))?.guestId).not.toBe(
    identity?.guestId,
  );
});

it("rejects unsigned, modified, wrong-key, and expired guest credentials", () => {
  const guests = createGuestSessions(randomBytes(32).toString("hex"));
  const now = Date.now();
  const cookie = guests.issue(undefined, false, now);
  expect(
    guests.verify(
      cookie.replace(
        /v1\.([0-9a-f])/,
        (_match, first) => "v1." + (first === "a" ? "b" : "a"),
      ),
      now,
    ),
  ).toBeUndefined();
  expect(guests.verify("obsidian_guest=forged", now)).toBeUndefined();
  expect(
    createGuestSessions(randomBytes(32).toString("hex")).verify(cookie, now),
  ).toBeUndefined();
  expect(guests.verify(cookie, now + 12 * 3600 * 1000)).toBeUndefined();
});

it("bounds both request frequency and tracked identities", () => {
  const allow = createRequestLimit(2, 1000, 1);
  expect([
    allow("a", 0),
    allow("a", 1),
    allow("a", 2),
    allow("b", 2),
    allow("b", 1000),
  ]).toEqual([true, true, false, false, true]);
});
