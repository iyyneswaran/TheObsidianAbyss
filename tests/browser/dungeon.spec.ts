import { expect, test, type Locator, type Page } from "@playwright/test";

test.use({ viewport: { width: 1380, height: 980 } });

async function canvasRegion(
  page: Page,
  canvas: Locator,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  const box = await canvas.boundingBox();
  if (!box) throw new Error("Dungeon canvas is not visible.");
  const scale = box.width / 640;
  return page.screenshot({
    clip: {
      x: box.x + x * scale,
      y: box.y + y * scale,
      width: width * scale,
      height: height * scale,
    },
  });
}

async function countBrightPixels(
  page: Page,
  png: Buffer,
  color: "lava" | "shrine",
) {
  return page.evaluate(
    async ({ bytes, color }) => {
      const image = await createImageBitmap(
        new Blob([Uint8Array.from(bytes)], { type: "image/png" }),
      );
      const context = new OffscreenCanvas(image.width, image.height).getContext(
        "2d",
      );
      if (!context) throw new Error("Cannot read screenshot pixels.");
      context.drawImage(image, 0, 0);
      const { data } = context.getImageData(0, 0, image.width, image.height);
      let count = 0;
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i]!,
          g = data[i + 1]!,
          b = data[i + 2]!;
        if (
          color === "lava"
            ? r > 180 && g > 36 && g < 200 && b < 120
            : b > 175 && g > 125 && r < 170
        )
          count++;
      }
      return count;
    },
    { bytes: [...png], color },
  );
}

test("renders all rooms, animates lava and the shrine, and exposes bounded camera controls", async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });

  await page.goto("/");
  await page.getByRole("link", { name: "Explore dungeon" }).click();
  await expect(page).toHaveURL(/\/dungeon$/);
  const stage = page.getByTestId("dungeon-stage");
  const canvas = stage.locator("canvas");
  const roomA = page.getByRole("button", { name: "Forsaken Entrance" });
  const roomB = page.getByRole("button", { name: "Molten Guard Chamber" });
  const roomC = page.getByRole("button", {
    name: "Sanctuary of the Azure Flame",
  });
  await expect(roomA).toBeVisible();
  await expect(canvas).toHaveCount(1);
  await expect(canvas).toHaveAttribute("width", "640");
  await expect(canvas).toHaveAttribute("height", "360");
  const debug = page.getByRole("region", { name: "Dungeon debug" });
  const center = debug.getByTestId("camera-center");
  const zoom = debug.getByTestId("camera-zoom");
  const room = debug.getByTestId("camera-room");
  await expect(debug).toBeHidden();

  await page.keyboard.press("F3");
  await expect(center).toHaveText("640, 528");
  await expect(room).toHaveText("room_a");
  await expect(debug.getByText("2560 × 2048 px")).toBeVisible();

  await page.keyboard.down("d");
  try {
    await expect
      .poll(async () => Number((await center.innerText()).split(",")[0]))
      .toBeGreaterThan(660);
  } finally {
    await page.keyboard.up("d");
  }
  await page.keyboard.down("ArrowDown");
  try {
    await expect
      .poll(async () => Number((await center.innerText()).split(",")[1]))
      .toBeGreaterThan(548);
  } finally {
    await page.keyboard.up("ArrowDown");
  }
  await canvas.hover();
  await page.mouse.wheel(0, -120);
  await expect(zoom).toHaveText("1×");
  await page.mouse.wheel(0, -120);
  await expect(zoom).toHaveText("2×");
  await page.mouse.wheel(0, -120);
  await expect(zoom).toHaveText("2×");

  await page.keyboard.press("r");
  await expect(center).toHaveText("640, 528");
  await expect(zoom).toHaveText("0.5×");
  await page.mouse.wheel(0, 120);
  await expect(zoom).toHaveText("0.25×");
  await expect(center).toHaveText("1280, 720");
  await page.keyboard.press("r");

  await page.keyboard.press("F3");
  await expect(debug).toBeHidden();
  await canvas.screenshot({ path: info.outputPath("forsaken-entrance.png") });
  const captureTorch = () => canvasRegion(page, canvas, 191, 43, 18, 19);
  const firstTorch = await captureTorch();
  expect(await countBrightPixels(page, firstTorch, "lava")).toBeGreaterThan(20);
  await expect
    .poll(async () => (await captureTorch()).equals(firstTorch))
    .toBe(false);

  await roomB.click();
  await page.keyboard.press("F3");
  await expect(room).toHaveText("room_b");
  await page.keyboard.press("F3");
  await expect(debug).toBeHidden();
  await canvas.screenshot({
    path: info.outputPath("molten-guard-chamber.png"),
  });

  await canvas.hover();
  await page.keyboard.press("F3");
  await page.mouse.wheel(0, -120);
  await expect(zoom).toHaveText("1×");
  await roomB.click();
  await expect(center).toHaveText("2032, 576");
  await canvas.hover({ position: { x: 638, y: 355 } });
  await expect(debug.getByText(/room_b, bridge/)).toBeVisible();
  await canvas.screenshot({ path: info.outputPath("bridge-debug.png") });
  await page.keyboard.press("F3");
  await expect(debug).toBeHidden();

  const captureLava = () => canvasRegion(page, canvas, 306, 118, 28, 28);
  const firstLava = await captureLava();
  expect(await countBrightPixels(page, firstLava, "lava")).toBeGreaterThan(100);
  await expect
    .poll(async () => (await captureLava()).equals(firstLava))
    .toBe(false);

  await canvas.hover();
  await page.mouse.wheel(0, 120);
  await roomC.click();
  await page.keyboard.press("F3");
  await expect(room).toHaveText("room_c");
  await expect(zoom).toHaveText("0.5×");
  await expect(debug.getByText(/mana_restoration_zone/)).toBeVisible();
  await page.keyboard.press("F3");
  await expect(debug).toBeHidden();
  await canvas.screenshot({ path: info.outputPath("azure-sanctuary.png") });

  await canvas.hover();
  await page.mouse.wheel(0, -120);
  await page.keyboard.press("F3");
  await expect(zoom).toHaveText("1×");
  await page.keyboard.press("F3");
  await expect(debug).toBeHidden();

  const captureShrine = () => canvasRegion(page, canvas, 307, 70, 26, 26);
  const firstShrine = await captureShrine();
  expect(await countBrightPixels(page, firstShrine, "shrine")).toBeGreaterThan(
    50,
  );
  await expect
    .poll(async () => (await captureShrine()).equals(firstShrine))
    .toBe(false);
  expect(errors).toEqual([]);
});

test("disposes dungeon rendering and input when switching to the original playground", async ({
  page,
}) => {
  const errors: string[] = [];
  const sockets: string[] = [];
  const matchmaking: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("websocket", (socket) => sockets.push(socket.url()));
  page.on("request", (request) => {
    if (request.url().includes("/matchmake/")) matchmaking.push(request.url());
  });

  await page.goto("/dungeon");
  await expect(
    page.getByRole("button", { name: "Forsaken Entrance" }),
  ).toBeVisible();
  const dungeon = await page
    .getByTestId("dungeon-stage")
    .locator("canvas")
    .elementHandle();
  const networkUrl = /\/matchmake\/|sessionId=/i;
  expect(sockets.filter((url) => networkUrl.test(url))).toEqual([]);
  expect(matchmaking).toEqual([]);

  await page.getByRole("link", { name: "Open playground" }).click();
  const play = page.getByRole("button", { name: "Play Frost Nova" });
  const playground = page.getByTestId("game-stage").locator("canvas");
  await expect(play).toBeEnabled();
  await expect
    .poll(() => dungeon.evaluate((node) => node.parentNode === null))
    .toBe(true);
  await dungeon.dispose();
  await expect(page.locator("canvas")).toHaveCount(1);

  const idle = await playground.screenshot();
  await play.click();
  await expect
    .poll(async () => (await playground.screenshot()).equals(idle))
    .toBe(false);
  await page.getByRole("button", { name: "Connect", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("Connected to test room");
  await page.getByRole("button", { name: "Disconnect", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("Disconnected");

  const oldPlayground = await playground.elementHandle();
  await page.goBack();
  await expect(
    page.getByRole("button", { name: "Forsaken Entrance" }),
  ).toBeVisible();
  await expect
    .poll(() => oldPlayground.evaluate((node) => node.parentNode === null))
    .toBe(true);
  await oldPlayground.dispose();
  await expect(page.locator("canvas")).toHaveCount(1);
  expect(errors).toEqual([]);
});
