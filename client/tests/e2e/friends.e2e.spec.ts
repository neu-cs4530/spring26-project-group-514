import { test, expect, type BrowserContext, type Page } from "@playwright/test";
import { createTwoUsers, makeFriends } from "./testUtils.ts";

let userContext1: BrowserContext;
let userContext2: BrowserContext;
let page1: Page;
let page2: Page;

test.beforeEach(async ({ browser }) => {
  userContext1 = await browser.newContext();
  userContext2 = await browser.newContext();
  page1 = await userContext1.newPage();
  page2 = await userContext2.newPage();
});

test.afterEach(async () => {
  await userContext1.close();
  await userContext2.close();
});

test.describe("Friend requests", () => {
  let username1: string;
  let username2: string;

  test.beforeEach(async () => {
    ({ username1, username2 } = await createTwoUsers(page1, page2));
    await Promise.all([page1.goto("/friends"), page2.goto("/friends")]);
  });

  test("should show a sent request in the Sent Requests section", async () => {
    await page1.getByPlaceholder("Enter username...").fill(username2);
    await page1.getByRole("button", { name: "Send Request" }).click();
    await expect(page1.getByText("Request sent!")).toBeVisible();
    await expect(page1.getByText(/pending/i)).toBeVisible();
  });

  test("should deliver an incoming friend request in real time to the recipient", async () => {
    await page1.getByPlaceholder("Enter username...").fill(username2);
    await page1.getByRole("button", { name: "Send Request" }).click();
    // user2 should see the request appear without a page refresh
    await expect(page2.getByRole("listitem").filter({ hasText: username1 })).toBeVisible();
  });

  test("should show a notification badge for an incoming friend request", async () => {
    // user2 navigates away from /friends before the request arrives
    await page2.goto("/");
    await page1.getByPlaceholder("Enter username...").fill(username2);
    await page1.getByRole("button", { name: "Send Request" }).click();
    await expect(page2.locator(".notification-badge")).toBeVisible();
  });

  test("should show both users as friends after a request is accepted", async () => {
    await page1.getByPlaceholder("Enter username...").fill(username2);
    await page1.getByRole("button", { name: "Send Request" }).click();
    await expect(page2.getByRole("listitem").filter({ hasText: username1 })).toBeVisible();
    await page2
      .getByRole("listitem")
      .filter({ hasText: username1 })
      .getByRole("button")
      .first()
      .click();
    await expect(page2.getByText("No incoming requests.")).toBeVisible();
    // Both pages should update in real time without navigation (CoS 1.3, 1.5)
    await expect(page2.getByRole("listitem").filter({ hasText: username1 })).toBeVisible();
    await expect(page1.getByRole("listitem").filter({ hasText: username2 })).toBeVisible();
  });
});

test.describe("Removing a friend", () => {
  test.beforeEach(async () => {
    await makeFriends(page1, page2);
  });

  test("should remove a friend and update both users' lists in real time", async () => {
    await expect(page1.getByRole("button", { name: /remove/i })).toBeVisible();
    await page1.getByRole("button", { name: /remove/i }).click();
    await page1.getByRole("button", { name: /yes, remove/i }).click();
    // Both users should no longer see each other as friends (CoS 1.7)
    await expect(page1.getByText("No friends yet...")).toBeVisible();
    await expect(page2.getByText("No friends yet...")).toBeVisible();
  });
});
