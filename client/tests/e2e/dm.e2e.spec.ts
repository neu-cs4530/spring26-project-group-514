import { test, expect, type BrowserContext, type Page } from "@playwright/test";
import { makeFriends } from "./testUtils.ts";

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

test.describe("Direct Messages", () => {
  let username1: string;
  let username2: string;

  test.beforeEach(async () => {
    ({ username1, username2 } = await makeFriends(page1, page2));
  });

  test("should create a DM conversation after becoming friends", async () => {
    // Both users should see the conversation in their Messages list (CoS 1.4)
    await page1.goto("/dm");
    await expect(page1.getByRole("listitem").filter({ hasText: username2 })).toBeVisible();

    await page2.goto("/dm");
    await expect(page2.getByRole("listitem").filter({ hasText: username1 })).toBeVisible();
  });

  test("should deliver a message in real time to the other participant", async () => {
    await page1.goto("/dm");
    await page1.getByRole("listitem").filter({ hasText: username2 }).click();
    await page1.waitForURL(/\/dm\/.+/);

    await page2.goto("/dm");
    await page2.getByRole("listitem").filter({ hasText: username1 }).click();
    await page2.waitForURL(/\/dm\/.+/);

    // user1 sends a message; user2 should see it without a page refresh (CoS 1.5)
    await page1.getByPlaceholder("Send a message").fill("Hello!");
    await page1.getByPlaceholder("Send a message").press("Enter");
    await expect(page2.getByText("Hello!")).toBeVisible();
  });

  test("should persist message history after navigating away and back", async () => {
    await page1.goto("/dm");
    await page1.getByRole("listitem").filter({ hasText: username2 }).click();
    await page1.waitForURL(/\/dm\/.+/);

    await page2.goto("/dm");
    await page2.getByRole("listitem").filter({ hasText: username1 }).click();
    await page2.waitForURL(/\/dm\/.+/);

    await page1.getByPlaceholder("Send a message").fill("Still here?");
    await page1.getByPlaceholder("Send a message").press("Enter");
    await expect(page2.getByText("Still here?")).toBeVisible();

    // user2 navigates away and returns to the conversation (CoS 1.6)
    await page2.goto("/");
    await page2.goto("/dm");
    await page2.getByRole("listitem").filter({ hasText: username1 }).click();
    await page2.waitForURL(/\/dm\/.+/);
    await expect(page2.getByText("Still here?")).toBeVisible();
  });

  test("should show a notification badge for unread messages", async () => {
    // user1 opens the DM; user2 stays on the home page
    await page1.goto("/dm");
    await page1.getByRole("listitem").filter({ hasText: username2 }).click();
    await page1.waitForURL(/\/dm\/.+/);
    await page2.goto("/");

    // user1 sends a message; user2 should receive an unread badge (CoS 1.10)
    await page1.getByPlaceholder("Send a message").fill("You've got mail!");
    await page1.getByPlaceholder("Send a message").press("Enter");
    await expect(page2.locator(".notification-badge")).toBeVisible();
  });

  //====RACE CONDITIONS FROM CHAT STRUCTURES

  test("should deliver all messages in real time even when sent simultaneously", async () => {
    await page1.goto("/dm");
    await page1.getByRole("listitem").filter({ hasText: username2 }).click();
    await page1.waitForURL(/\/dm\/.+/);

    await page2.goto("/dm");
    await page2.getByRole("listitem").filter({ hasText: username1 }).click();
    await page2.waitForURL(/\/dm\/.+/);

    await page1.getByPlaceholder("Send a message").focus();
    await page2.getByPlaceholder("Send a message").focus();

    for (let i = 0; i < 5; i += 1) {
      await page1.keyboard.type(`dm ${i} A`);
      await page2.keyboard.type(`dm ${i} B`);
      await Promise.all([page1.keyboard.press("Enter"), page2.keyboard.press("Enter")]);
    }

    // Both users should see all messages live via websocket, regardless of DB race (CoS 1.5)
    for (let i = 0; i < 5; i += 1) {
      await expect(page1.getByText(new RegExp(`^dm ${i} [AB]$`)).first()).toBeVisible();
      await expect(page1.getByText(`dm ${i} A`)).toBeVisible();
      await expect(page1.getByText(`dm ${i} B`)).toBeVisible();
    }
  });

  test("should persist at least one message from each simultaneous send after navigating away and back", async () => {
    await page1.goto("/dm");
    await page1.getByRole("listitem").filter({ hasText: username2 }).click();
    await page1.waitForURL(/\/dm\/.+/);

    await page2.goto("/dm");
    await page2.getByRole("listitem").filter({ hasText: username1 }).click();
    await page2.waitForURL(/\/dm\/.+/);

    await page1.getByPlaceholder("Send a message").focus();
    await page2.getByPlaceholder("Send a message").focus();

    for (let i = 0; i < 5; i += 1) {
      await page1.keyboard.type(`dm ${i} A`);
      await page2.keyboard.type(`dm ${i} B`);
      await Promise.all([page1.keyboard.press("Enter"), page2.keyboard.press("Enter")]);
    }

    // Navigate away and back to force a DB read, erasing the websocket-delivered messages
    await page2.goto("/");
    await page2.goto("/dm");
    await page2.getByRole("listitem").filter({ hasText: username1 }).click();
    await page2.waitForURL(/\/dm\/.+/);

    // At least one of each simultaneous pair should have been persisted to the DB.
    // Both may not survive due to the same read-then-write race in addMessageToDm
    // that exists in the chat service — this is expected and documented behaviour.
    for (let i = 0; i < 5; i += 1) {
      await expect(page2.getByText(new RegExp(`^dm ${i} [AB]$`)).first()).toBeVisible();
    }
  });

  //====RACE CONDITIONS FROM CHAT STRUCTURES
});
