/**
 * WhatsApp Web Scraper via Playwright CDP
 * Connects to the existing openclaw browser session to scrape contacts and conversations.
 */

import { chromium, type Browser, type Page } from "playwright";

interface WhatsAppContact {
  name: string;
  lastMessage?: string;
  timestamp?: string;
}

interface ScrapedMessage {
  sender: string;
  text: string;
  timestamp: string;
}

interface ScrapedConversation {
  contactName: string;
  messages: ScrapedMessage[];
}

// Default CDP endpoint for openclaw browser
const CDP_ENDPOINTS = [
  "http://localhost:9222",
  "http://localhost:9223",
  "http://127.0.0.1:9222",
];

async function connectBrowser(): Promise<Browser> {
  for (const endpoint of CDP_ENDPOINTS) {
    try {
      const browser = await chromium.connectOverCDP(endpoint, { timeout: 5000 });
      return browser;
    } catch {
      continue;
    }
  }
  throw new Error(
    "Could not connect to browser via CDP. Make sure the openclaw browser is running with remote debugging enabled."
  );
}

function findWhatsAppPage(browser: Browser): Page | null {
  for (const context of browser.contexts()) {
    for (const page of context.pages()) {
      if (page.url().includes("web.whatsapp.com")) {
        return page;
      }
    }
  }
  return null;
}

/**
 * Scrape the WhatsApp Web contact/chat list
 */
export async function scrapeContacts(maxContacts = 100): Promise<WhatsAppContact[]> {
  const browser = await connectBrowser();

  try {
    const page = findWhatsAppPage(browser);
    if (!page) {
      throw new Error("No WhatsApp Web tab found. Please open WhatsApp Web in the openclaw browser.");
    }

    // Wait for chat list to be loaded
    await page.waitForSelector('[role="grid"][aria-label*="Chat"]', { timeout: 10000 });

    // Scroll through the chat list to load more contacts
    const chatList = await page.$('[role="grid"][aria-label*="Chat"]');
    if (!chatList) throw new Error("Chat list not found");

    const contacts: WhatsAppContact[] = [];
    const seen = new Set<string>();
    let scrollAttempts = 0;
    const maxScrolls = Math.ceil(maxContacts / 15); // ~15 chats visible at once

    while (contacts.length < maxContacts && scrollAttempts < maxScrolls) {
      // Extract visible chat rows
      const rows = await page.$$eval('[role="grid"][aria-label*="Chat"] [role="row"]', (els) =>
        els.map((el) => {
          const cells = el.querySelectorAll('[role="gridcell"]');
          const nameCell = cells[0];
          const name = nameCell?.textContent?.split(/\d{1,2}[/:.\-]\d{1,2}/)?.[0]?.trim() || "";
          // Try to get the preview text
          const allText = el.textContent || "";
          return { name, fullText: allText };
        })
      );

      for (const row of rows) {
        if (row.name && !seen.has(row.name) && row.name !== "Archived") {
          seen.add(row.name);
          contacts.push({ name: row.name });
        }
      }

      // Scroll down
      await chatList.evaluate((el) => {
        el.scrollTop += 600;
      });
      await page.waitForTimeout(500);
      scrollAttempts++;
    }

    return contacts.slice(0, maxContacts);
  } finally {
    // Don't close — it's a shared browser
  }
}

/**
 * Scrape messages from a specific chat
 */
export async function scrapeChat(
  contactName: string,
  maxMessages = 50
): Promise<ScrapedConversation> {
  const browser = await connectBrowser();

  try {
    const page = findWhatsAppPage(browser);
    if (!page) {
      throw new Error("No WhatsApp Web tab found.");
    }

    // Search for the contact
    const searchBox = await page.$('div[contenteditable="true"][data-tab="3"]');
    if (!searchBox) throw new Error("Search box not found");

    await searchBox.click();
    await searchBox.fill("");
    await page.keyboard.type(contactName, { delay: 50 });
    await page.waitForTimeout(1000);

    // Click the first result
    const firstResult = await page.$(`[role="row"] [title="${contactName}"]`);
    if (firstResult) {
      await firstResult.click();
    } else {
      // Try clicking first row in search results
      const firstRow = await page.$('[role="grid"][aria-label*="Search"] [role="row"]');
      if (firstRow) await firstRow.click();
      else throw new Error(`Contact "${contactName}" not found`);
    }

    await page.waitForTimeout(1500);

    // Extract messages from the conversation
    const messages: ScrapedMessage[] = await page.$$eval(
      '[data-id] .message-in, [data-id] .message-out',
      (els) =>
        els.slice(-100).map((el) => {
          const isOut = el.classList.contains("message-out");
          const textEl = el.querySelector(".selectable-text");
          const timeEl = el.querySelector("[data-pre-plain-text]");
          const prePlain = timeEl?.getAttribute("data-pre-plain-text") || "";
          // Format: "[HH:MM, DD/MM/YYYY] Sender: "
          const senderMatch = prePlain.match(/\]\s*(.+?):\s*$/);

          return {
            sender: isOut ? "You" : senderMatch?.[1] || contactName,
            text: textEl?.textContent?.trim() || "",
            timestamp: prePlain.match(/\[(.+?)\]/)?.[1] || "",
          };
        })
    );

    // Clear search
    const clearBtn = await page.$('[aria-label="Cancel search"]');
    if (clearBtn) await clearBtn.click();

    return {
      contactName,
      messages: messages.filter((m) => m.text).slice(-maxMessages),
    };
  } finally {
    // Don't close
  }
}

export type { WhatsAppContact, ScrapedMessage, ScrapedConversation };
