import { test, expect, type BrowserContext, type Page } from "@playwright/test";
import { createTwoUsers } from "./testUtils.ts";

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

/** Helper: create two users and navigate both to /lobbies via the nav link. */
async function setupBothOnLobbies(p1: Page, p2: Page) {
  const creds = await createTwoUsers(p1, p2);
  await p1.getByRole("link", { name: "Lobbies" }).click();
  await p1.waitForURL("/lobbies");
  await p2.getByRole("link", { name: "Lobbies" }).click();
  await p2.waitForURL("/lobbies");
  return creds;
}

/** Helper: host creates a lobby through the UI and lands on the lobby page. */
async function createLobbyViaUI(page: Page, options?: { isPrivate?: boolean }) {
  await page.getByRole("button", { name: "Create Lobby" }).click();
  await page.waitForURL("/lobby/new");
  await page.getByLabel("Game selection").selectOption("nim");
  if (options?.isPrivate === false) {
    // Checkbox is checked (private) by default — uncheck it for public
    await page.getByText("Private Lobby").click();
  }
  await page.getByRole("button", { name: "Create" }).click();
  await page.waitForURL(/\/lobby\/.+/);
}

/**
 * Helper: user2 navigates to the lobby list and opens a public lobby
 * created by username1 via the "Open" button. Handles nav-away-and-back
 * to refresh the list.
 */
async function openPublicLobbyAsUser2(p2: Page, username1: string) {
  await p2.getByRole("link", { name: "Home" }).click();
  await p2.waitForURL("/");
  await p2.getByRole("link", { name: "Lobbies" }).click();
  await p2.waitForURL("/lobbies");
  await p2
    .getByRole("listitem")
    .filter({ hasText: username1 })
    .getByRole("button", { name: "Open" })
    .click();
  await p2.waitForURL(/\/lobby\/.+/);
}

test.describe("Lobby list page", () => {
  test("should show empty state when no lobbies exist", async () => {
    const { username1 } = await createTwoUsers(page1, page2);
    await page1.getByRole("link", { name: "Lobbies" }).click();
    await page1.waitForURL("/lobbies");

    await expect(page1.getByRole("heading", { name: "Lobbies", exact: true })).toBeVisible();
    await expect(page1.getByRole("button", { name: "Create Lobby" })).toBeVisible();
    await expect(page1.getByLabel("Lobby code")).toBeVisible();
    await expect(page1.getByText("No public lobbies found.")).toBeVisible();
    await expect(page1.getByText("No lobby invitations found.")).toBeVisible();
    // Sanity: username visible somewhere confirms we're logged in
    await expect(page1.getByText(username1)).toBeVisible();
  });

  test("should navigate to /lobby/new when clicking Create Lobby", async () => {
    await createTwoUsers(page1, page2);
    await page1.getByRole("link", { name: "Lobbies" }).click();
    await page1.waitForURL("/lobbies");

    await page1.getByRole("button", { name: "Create Lobby" }).click();
    await page1.waitForURL("/lobby/new");
    await expect(page1.getByRole("heading", { name: "Create Lobby" })).toBeVisible();
  });

  test("should show a public lobby in the list for another user", async () => {
    const { username1 } = await setupBothOnLobbies(page1, page2);

    // User 1 creates a public lobby
    await createLobbyViaUI(page1, { isPrivate: false });
    await expect(page1.getByText("Nim Lobby")).toBeVisible();

    // User 2 refreshes the lobby list by navigating away and back
    await page2.getByRole("link", { name: "Home" }).click();
    await page2.waitForURL("/");
    await page2.getByRole("link", { name: "Lobbies" }).click();
    await page2.waitForURL("/lobbies");

    // The public lobby should appear with the creator's name
    await expect(page2.getByText(username1)).toBeVisible();
    await expect(
      page2
        .getByRole("listitem")
        .filter({ hasText: username1 })
        .getByRole("button", { name: "Open" }),
    ).toBeVisible();
  });

  test("should join a lobby by code", async () => {
    await setupBothOnLobbies(page1, page2);

    // User 1 creates a private lobby
    await createLobbyViaUI(page1);
    // Grab the lobby code from the lobby page
    const codeText = await page1.getByText(/Code:/).textContent();
    const code = codeText!.replace("Code:", "").trim();

    // User 2 enters the code on the lobby list page
    await page2.getByLabel("Lobby code").fill(code);
    await page2.getByRole("button", { name: "Join" }).first().click();

    // Should navigate to the lobby page
    await page2.waitForURL(/\/lobby\/.+/);
    await expect(page2.getByText("Nim Lobby")).toBeVisible();
  });

  test("should show an error for an invalid lobby code", async () => {
    await createTwoUsers(page1, page2);
    await page1.getByRole("link", { name: "Lobbies" }).click();
    await page1.waitForURL("/lobbies");

    await page1.getByLabel("Lobby code").fill("INVALID123");
    await page1.getByRole("button", { name: "Join" }).first().click();

    await expect(page1.locator(".error-message")).toBeVisible();
  });

  test("should show an invited lobby under Invited Lobbies", async () => {
    const { username2 } = await setupBothOnLobbies(page1, page2);

    // User 1 creates a private lobby
    await createLobbyViaUI(page1);

    // Host invites user 2
    await page1.getByLabel("Invite username").fill(username2);
    await page1.getByRole("button", { name: "Invite" }).click();

    // User 2 navigates away and back to refresh lobby list
    await page2.getByRole("link", { name: "Home" }).click();
    await page2.waitForURL("/");
    await page2.getByRole("link", { name: "Lobbies" }).click();
    await page2.waitForURL("/lobbies");

    // Should see it under Invited Lobbies
    await expect(page2.getByText("No lobby invitations found.")).not.toBeVisible();
    await expect(
      page2
        .locator(".spacedSection")
        .filter({ hasText: "Invited Lobbies" })
        .getByRole("button", { name: "Join" }),
    ).toBeVisible();
  });
});

test.describe("Lobby detail page", () => {
  test("should render lobby details for the host", async () => {
    await createTwoUsers(page1, page2);
    await page1.getByRole("link", { name: "Lobbies" }).click();
    await page1.waitForURL("/lobbies");

    await createLobbyViaUI(page1, { isPrivate: false });

    await expect(page1.getByText("Nim Lobby")).toBeVisible();
    await expect(page1.getByText(/Code:/)).toBeVisible();
    await expect(page1.getByText("Public")).toBeVisible();
    await expect(page1.getByText("1 players joined")).toBeVisible();
    await expect(page1.getByRole("heading", { name: "Players", exact: true })).toBeVisible();
    await expect(page1.getByRole("heading", { name: "Lobby Settings" })).toBeVisible();
    await expect(page1.getByRole("button", { name: "Start Game" })).toBeVisible();
  });

  test("should allow the host to invite a player", async () => {
    const { username2 } = await setupBothOnLobbies(page1, page2);

    await createLobbyViaUI(page1);

    await page1.getByLabel("Invite username").fill(username2);
    await page1.getByRole("button", { name: "Invite" }).click();

    // The invited player should appear in the player list with pending status
    await expect(page1.getByText(username2)).toBeVisible();
    await expect(page1.getByText("(pending)")).toBeVisible();
  });

  test("should allow an invited player to accept the invite", async () => {
    const { username1, username2 } = await setupBothOnLobbies(page1, page2);

    // Host creates a PUBLIC lobby so user 2 can find it via the list's "Open" button
    await createLobbyViaUI(page1, { isPrivate: false });

    // Host invites user 2
    await page1.getByLabel("Invite username").fill(username2);
    await page1.getByRole("button", { name: "Invite" }).click();
    await expect(page1.getByText("(pending)")).toBeVisible();

    // User 2 opens the lobby via the public list (does not auto-join)
    await openPublicLobbyAsUser2(page2, username1);

    // User 2 should see Accept Invite since they are invited with pending status
    await page2.getByRole("button", { name: "Accept Invite" }).click();

    // Host should see 2 players joined
    await expect(page1.getByText("2 players joined")).toBeVisible();
  });

  test("should allow an invited player to decline the invite", async () => {
    const { username1, username2 } = await setupBothOnLobbies(page1, page2);

    // Host creates a PUBLIC lobby so user 2 can find it via the list's "Open" button
    await createLobbyViaUI(page1, { isPrivate: false });

    await page1.getByLabel("Invite username").fill(username2);
    await page1.getByRole("button", { name: "Invite" }).click();
    await expect(page1.getByText("(pending)")).toBeVisible();

    // User 2 opens the lobby via the public list (does not auto-join)
    await openPublicLobbyAsUser2(page2, username1);

    // Decline the invite
    await page2.getByRole("button", { name: "Decline Invite" }).click();

    // Host should see the player status change to declined
    await expect(page1.getByText("(declined)")).toBeVisible();
  });

  test("should allow a joined player to leave the lobby", async () => {
    const { username1 } = await setupBothOnLobbies(page1, page2);

    // Host creates a public lobby
    await createLobbyViaUI(page1, { isPrivate: false });

    // User 2 opens the lobby from the public list
    await openPublicLobbyAsUser2(page2, username1);

    // User 2 joins
    await page2.getByRole("button", { name: "Join Lobby" }).click();
    await expect(page1.getByText("2 players joined")).toBeVisible();

    // User 2 leaves
    await page2.getByRole("button", { name: "Leave Lobby" }).click();

    // Host should see player count drop
    await expect(page1.getByText("1 players joined")).toBeVisible();
  });

  test("should allow the host to remove a player", async () => {
    const { username1 } = await setupBothOnLobbies(page1, page2);

    await createLobbyViaUI(page1, { isPrivate: false });

    // User 2 opens the lobby and joins
    await openPublicLobbyAsUser2(page2, username1);
    await page2.getByRole("button", { name: "Join Lobby" }).click();
    await expect(page1.getByText("2 players joined")).toBeVisible();

    // Host removes user 2
    await page1.getByRole("button", { name: "Remove" }).click();
    await expect(page1.getByText("1 players joined")).toBeVisible();
  });

  test("should allow the host to change lobby settings", async () => {
    await createTwoUsers(page1, page2);
    await page1.getByRole("link", { name: "Lobbies" }).click();
    await page1.waitForURL("/lobbies");

    await createLobbyViaUI(page1);

    // Change mode to Casual
    await page1.locator("select").filter({ hasText: "Standard" }).selectOption("casual");

    // Change difficulty to Hard
    await page1.locator("select").filter({ hasText: "Normal" }).selectOption("hard");

    // Verify the selects hold their values
    await expect(page1.locator("select").filter({ hasText: "Casual" })).toBeVisible();
    await expect(page1.locator("select").filter({ hasText: "Hard" })).toBeVisible();
  });

  test("should allow host to start the game and redirect both players", async () => {
    const { username1 } = await setupBothOnLobbies(page1, page2);

    await createLobbyViaUI(page1, { isPrivate: false });

    // User 2 opens the lobby and joins
    await openPublicLobbyAsUser2(page2, username1);
    await page2.getByRole("button", { name: "Join Lobby" }).click();
    await expect(page1.getByText("2 players joined")).toBeVisible();

    // Host starts the game
    await page1.getByRole("button", { name: "Start Game" }).click();

    // Both players should be redirected to the game page
    await page1.waitForURL(/\/game\/.+/);
    await page2.waitForURL(/\/game\/.+/);
  });

  test("should show lobby chat and allow sending messages", async () => {
    await createTwoUsers(page1, page2);
    await page1.getByRole("link", { name: "Lobbies" }).click();
    await page1.waitForURL("/lobbies");

    await createLobbyViaUI(page1);

    await expect(page1.getByRole("heading", { name: "Lobby Chat" })).toBeVisible();

    // Send a chat message
    await page1.getByPlaceholder("Send a message to chat").fill("Hello lobby!");
    await page1.getByPlaceholder("Send a message to chat").press("Enter");

    await expect(page1.getByText("Hello lobby!")).toBeVisible();
  });
});
