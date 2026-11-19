import { afterEach, expect, it } from "vitest";
import { createApi } from "../src/app.js";

const origin = "http://localhost:5173";
const app = createApi(origin);

afterEach(() => app.close());

it("serves the health contract and only authorizes the configured browser origin", async () => {
  const response = await app.inject({ url: "/health", headers: { origin } });
  expect(response.statusCode).toBe(200);
  expect(response.json()).toEqual({
    status: "ok",
    service: "obsidian-abyss-api",
  });
  expect(response.headers["access-control-allow-origin"]).toBe(origin);

  const other = await app.inject({
    url: "/health",
    headers: { origin: "http://localhost:8000" },
  });
  expect(other.headers["access-control-allow-origin"]).not.toBe(
    "http://localhost:8000",
  );
});
