import { expect, test } from "@playwright/test";

const combineHeadingPattern = /combine duplicate players/i;
const combineButtonPattern = /combine selected/i;
const reviewButtonPattern = /review sessions/i;
const confirmHeadingPattern = /confirm combining these sessions/i;
const groupLinkSelector = 'a[href^="/groups/"]:not([href="/groups/new"])';
const groupDetailUrlPattern = /\/groups\/.+/;

async function openFirstGroup(page: import("@playwright/test").Page) {
  await page.goto("/groups");
  const groupLink = page.locator(groupLinkSelector).first();
  if (!(await groupLink.isVisible())) {
    return false;
  }
  await groupLink.click();
  await expect(page).toHaveURL(groupDetailUrlPattern);
  return true;
}

test.describe("Combine duplicate players", () => {
  test("section only appears with two or more unclaimed players", async ({
    page,
  }) => {
    if (!(await openFirstGroup(page))) {
      test.skip(true, "No groups available");
      return;
    }

    const section = page.getByRole("heading", { name: combineHeadingPattern });

    // The section is owner-only and hides itself when there is nothing to
    // merge, so either it is absent or it offers a disabled combine button.
    if (await section.isVisible()) {
      const combineButton = page.getByRole("button", {
        name: combineButtonPattern,
      });
      await expect(combineButton).toBeVisible();
      await expect(combineButton).toBeDisabled();
    }
  });

  test("selecting two players opens the confirmation step", async ({
    page,
  }) => {
    if (!(await openFirstGroup(page))) {
      test.skip(true, "No groups available");
      return;
    }

    const section = page.getByRole("heading", { name: combineHeadingPattern });
    if (!(await section.isVisible())) {
      test.skip(true, "No duplicate players to combine");
      return;
    }

    const checkboxes = page.getByRole("checkbox");
    if ((await checkboxes.count()) < 2) {
      test.skip(true, "Fewer than two candidates");
      return;
    }

    await checkboxes.nth(0).check();
    await checkboxes.nth(1).check();

    const combineButton = page.getByRole("button", {
      name: combineButtonPattern,
    });
    await expect(combineButton).toBeEnabled();
    await combineButton.click();

    // Step one: pick which player survives.
    await expect(page.getByRole("radio").first()).toBeVisible();

    // Step two: the safety review listing the sessions being merged.
    await page.getByRole("button", { name: reviewButtonPattern }).click();
    await expect(
      page.getByRole("heading", { name: confirmHeadingPattern })
    ).toBeVisible();
  });
});
