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
    // Navigate via nav links — page.goto() after login wipes auth state
    await page1.getByRole("link", { name: "Friends" }).click();
    await page1.waitForURL("/friends");
    // Sync point: confirm the Friends page is fully rendered before the test runs
    await expect(page1.getByPlaceholder("Enter username...")).toBeVisible();
    await page2.getByRole("link", { name: "Friends" }).click();
    await page2.waitForURL("/friends");
    await expect(page2.getByPlaceholder("Enter username...")).toBeVisible();
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
    // page2 is already on /friends — request should appear without a page refresh
    await expect(page2.getByRole("listitem").filter({ hasText: username1 })).toBeVisible();
  });

  test("should show a notification badge for an incoming friend request", async () => {
    // user2 navigates away via nav link before the request arrives
    await page2.getByRole("link", { name: "Home" }).click();
    await page2.waitForURL("/");
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
    await expect(page1.getByText("No friends yet...")).not.toBeVisible();
  });
});

test.describe("Removing a friend", () => {
  let username1: string;
  //let username2: string;

  test.beforeEach(async () => {
    // makeFriends ends with both pages on /friends — no further navigation needed
    const friends = await makeFriends(page1, page2);
    username1 = friends.username1;
    //username2 = friends.username2;
  });

  test("should remove a friend and update both users' lists in real time", async () => {
    // username1 is a fresh account with exactly one friend, so there is only one Remove button.
    // Waiting for it also confirms the friends list has finished loading.
    await expect(page1.getByRole("button", { name: /remove/i })).toBeVisible();
    await page1.getByRole("button", { name: /remove/i }).click();
    await page1.getByRole("button", { name: /yes, remove/i }).click();
    // username1's list should be empty (CoS 1.7)
    await expect(page1.getByText("No friends yet...")).toBeVisible();
    // username2 should no longer see username1 in real time
    await expect(page2.getByRole("listitem").filter({ hasText: username1 })).not.toBeVisible();
  });
});
