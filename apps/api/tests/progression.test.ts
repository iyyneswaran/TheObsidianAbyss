import { randomBytes, randomUUID } from "node:crypto";
import { describe, it, expect } from "vitest";
import { isolatedTestDatabase } from "../../../tests/fixtures/progression.js";
import { createApi } from "../src/app.js";

const database = isolatedTestDatabase();
const origin = "http://localhost:5173";
describe.skipIf(!database)("public progression API", () => {
  it("validates sessions, authenticated ownership, CSRF, strict payloads and privileged route isolation", async () => {
    const app = createApi(
      origin,
      false,
      randomBytes(32).toString("hex"),
      database,
    );
    try {
      for (const url of ["/profile", "/wallet", "/quests", "/vault", "/store"])
        expect((await app.inject({ url })).statusCode).toBe(401);
      const guest = await app.inject({
        url: "/session/guest",
        method: "POST",
        headers: { origin },
      });
      const cookie = guest.headers["set-cookie"]!.toString().split(";")[0]!;
      const post = (
        url: string,
        payload: object,
        credentials = cookie,
        source = origin,
      ) =>
        app.inject({
          method: "POST",
          url,
          headers: { origin: source, cookie: credentials },
          payload,
        });
      expect(
        (await post("/auth/register", { username: "bad", password: "short" }))
          .statusCode,
      ).toBe(400);
      expect(
        (
          await post("/auth/register", {
            username: "wizard",
            password: randomUUID(),
            profileId: randomUUID(),
          })
        ).statusCode,
      ).toBe(400);
      const account = {
        username: "api_" + randomUUID().slice(0, 8),
        password: randomUUID(),
      };
      const created = await post("/auth/register", account);
      expect(created.statusCode).toBe(201);
      expect(created.headers["set-cookie"]).toMatch(/HttpOnly/i);
      expect(created.headers["set-cookie"]).toMatch(/SameSite=/i);
      const signed = created.headers["set-cookie"]!.toString().split(";")[0]!;
      expect((await post("/auth/register", account)).statusCode).toBe(409);
      const failed = await post("/auth/login", {
        ...account,
        password: "incorrect",
      });
      const unknown = await post("/auth/login", {
        ...account,
        username: "missing_" + randomUUID().slice(0, 8),
      });
      expect(unknown.json()).toEqual(failed.json());
      expect(failed.statusCode).toBe(401);
      expect(
        (
          await post(
            "/vault/equip",
            { wizard: "fire", skill3: "meteor", ultimate: null },
            signed,
          )
        ).statusCode,
      ).toBe(403);
      expect(
        (
          await post(
            "/store/purchase",
            { itemId: "meteor", requestKey: randomUUID(), price: 0 },
            signed,
          )
        ).statusCode,
      ).toBe(400);
      expect(
        (
          await post(
            "/store/purchase",
            { itemId: "meteor", requestKey: randomUUID() },
            signed,
            "https://invalid.example",
          )
        ).statusCode,
      ).toBe(403);
      for (const url of [
        "/wallet/credit",
        "/run/settle",
        "/profile/xp",
        "/vault/unlock",
        "/quests/progress",
        "/stage",
      ])
        expect((await post(url, {}, signed)).statusCode).toBe(404);
      const profile = (
        await app.inject({ url: "/profile", headers: { cookie: signed } })
      ).json();
      expect(profile).toMatchObject({
        wallet: { coins: 0, gems: 0 },
        xp: 0,
        displayName: account.username,
      });
      expect(Object.keys(profile)).not.toEqual(
        expect.arrayContaining(["accountId", "guestId"]),
      );
      expect((await post("/auth/logout", {}, signed)).statusCode).toBe(204);
      expect(
        (
          await app.inject({
            url: "/profile",
            headers: { cookie: signed + "; " + cookie },
          })
        ).statusCode,
      ).toBe(401);
    } finally {
      await app.close();
    }
  });
});
