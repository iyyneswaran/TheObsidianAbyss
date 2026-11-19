import { expect, test } from "@playwright/test";

test("guest progression screens fit a narrow viewport and expose the default loadout", async ({
  page,
}) => {
  test.skip(
    !process.env.TEST_DATABASE_URL,
    "Requires the isolated progression database",
  );
  await page.setViewportSize({ width: 390, height: 844 });
  for (const [route, selector] of [
    ["/profile", "profile-name"],
    ["/store", "store-item"],
    ["/vault", "vault-slot"],
    ["/quests", "quest-card"],
  ] as const) {
    await page.goto(route);
    await expect(page.getByTestId(selector).first()).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(390);
    if (route === "/store")
      await expect(
        page.getByRole("button", { name: "Insufficient funds" }),
      ).toHaveCount(7);
  }
});
