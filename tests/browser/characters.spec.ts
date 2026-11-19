import { expect, test } from "@playwright/test";

test.use({ viewport: { width: 1380, height: 980 } });

test("offers seven visually distinct wizard choices and requires a selection", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Select Wizard" }).click();
  await expect(page).toHaveURL(/\/characters$/);
  await expect(page.getByRole("radio")).toHaveCount(7);
  const enter = page.getByRole("button", { name: "Enter Dungeon" });
  await expect(enter).toBeDisabled();

  const previews = await page
    .getByTestId(/^wizard-preview-/)
    .evaluateAll(async (elements) =>
      Promise.all(
        elements.map(async (element) => {
          const url = getComputedStyle(element).backgroundImage.slice(5, -2);
          const image = new Image();
          image.src = url;
          await image.decode();
          const canvas = new OffscreenCanvas(32, 48);
          const context = canvas.getContext("2d")!;
          context.drawImage(image, 0, 0);
          const rgba = context.getImageData(0, 0, 32, 48).data;
          return {
            colors: new Set(rgba).size,
            pixels: Array.from(rgba),
          };
        }),
      ),
    );
  expect(previews.every(({ colors }) => colors > 20)).toBe(true);
  expect(new Set(previews.map(({ pixels }) => pixels.join(","))).size).toBe(7);
  for (const radio of await page.getByRole("radio").all()) {
    await radio.focus();
    await radio.press("Space");
    await expect(radio).toBeChecked();
  }
  const fire = page.getByRole("radio", { name: "Fire Wizard" });
  await fire.focus();
  await fire.press("Space");
  await expect(fire).toBeChecked();
  await expect(enter).toBeEnabled();
  await page.screenshot({
    path: "artifacts/milestone-2/character-selection.png",
    fullPage: true,
  });
});
