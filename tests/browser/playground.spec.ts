import { expect, test } from "@playwright/test";

test("renders and replays Frost Nova, joins and leaves a room, and disposes Phaser on navigation", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });

  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "The Obsidian Abyss" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Open playground" }).click();
  await expect(page).toHaveURL(/\/playground$/);
  const stage = page.getByTestId("game-stage");
  const canvas = stage.locator("canvas");
  const play = page.getByRole("button", { name: "Play Frost Nova" });
  await expect(canvas).toHaveCount(1, { timeout: 25000 });
  await expect(play).toBeEnabled();
  const idle = await canvas.screenshot();

  await play.click();
  await expect
    .poll(async () => (await canvas.screenshot()).equals(idle))
    .toBe(false);
  await expect
    .poll(async () => (await canvas.screenshot()).equals(idle))
    .toBe(true);
  await play.click();
  await play.click();
  await expect
    .poll(async () => (await canvas.screenshot()).equals(idle))
    .toBe(false);

  const connect = page.getByRole("button", { name: "Connect", exact: true });
  const disconnect = page.getByRole("button", {
    name: "Disconnect",
    exact: true,
  });
  const status = page.getByRole("status");
  await connect.click();
  await expect(status).toHaveText("Connected to test room");
  await expect(page.locator("dd")).toHaveText([/\S+/, /\S+/]);
  await expect(canvas).toHaveCount(1);
  await disconnect.click();
  await expect(status).toHaveText("Disconnected");

  const nextSocket = page.waitForEvent("websocket");
  await connect.click();
  const socket = await nextSocket;
  await expect(status).toHaveText("Connected to test room");

  const oldCanvas = await canvas.elementHandle();
  const closed = socket.waitForEvent("close");
  await page.getByRole("link", { name: "The Obsidian Abyss" }).click();
  await closed;
  await expect
    .poll(() => oldCanvas.evaluate((node) => node.parentNode === null))
    .toBe(true);
  await oldCanvas.dispose();
  await expect(page.locator("canvas")).toHaveCount(0);

  await page.getByRole("link", { name: "Open playground" }).click();
  await expect(play).toBeEnabled();
  await expect(canvas).toHaveCount(1);
  expect(errors).toEqual([]);
});

test("reports a failed connection and can retry", async ({ page }) => {
  await page.route("**/matchmake/joinOrCreate/test_room", (route) =>
    route.abort("connectionrefused"),
  );
  await page.goto("/playground");
  const connect = page.getByRole("button", { name: "Connect", exact: true });
  await connect.click();
  await expect(page.getByRole("status")).toContainText(
    "Could not connect to the game server",
  );
  await expect(connect).toBeEnabled();

  await page.unroute("**/matchmake/joinOrCreate/test_room");
  await connect.click();
  await expect(page.getByRole("status")).toHaveText("Connected to test room");
  await page.getByRole("button", { name: "Disconnect", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("Disconnected");
});
