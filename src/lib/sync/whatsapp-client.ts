/**
 * WhatsApp Client Manager (Singleton)
 * Uses whatsapp-web.js to maintain a persistent WhatsApp Web connection.
 */

import { Client, LocalAuth, type Message, type Contact } from "whatsapp-web.js";
import * as QRCode from "qrcode";

export type WAStatus = "disconnected" | "qr_pending" | "connecting" | "ready" | "error";

interface WAClientState {
  status: WAStatus;
  qrCode: string | null; // data URL
  connectedNumber: string | null;
  connectedName: string | null;
  error: string | null;
  messagesSynced: number;
}

type MessageHandler = (msg: Message) => void | Promise<void>;

class WhatsAppClient {
  private client: Client | null = null;
  private state: WAClientState = {
    status: "disconnected",
    qrCode: null,
    connectedNumber: null,
    connectedName: null,
    error: null,
    messagesSynced: 0,
  };
  private onMessageHandlers: MessageHandler[] = [];
  private initPromise: Promise<void> | null = null;

  getStatus(): WAClientState {
    return { ...this.state };
  }

  onMessage(handler: MessageHandler) {
    this.onMessageHandlers.push(handler);
  }

  incrementMessageCount() {
    this.state.messagesSynced++;
  }

  async initialize(): Promise<void> {
    if (this.client && this.state.status !== "disconnected" && this.state.status !== "error") {
      return; // Already running or starting
    }

    if (this.initPromise) return this.initPromise;

    this.initPromise = this._doInitialize();
    try {
      await this.initPromise;
    } finally {
      this.initPromise = null;
    }
  }

  private async _doInitialize(): Promise<void> {
    this.state = {
      status: "connecting",
      qrCode: null,
      connectedNumber: null,
      connectedName: null,
      error: null,
      messagesSynced: 0,
    };

    try {
      this.client = new Client({
        authStrategy: new LocalAuth({
          dataPath: "./data/whatsapp-session",
        }),
        puppeteer: {
          headless: true,
          args: [
            "--no-sandbox",
            "--disable-setuid-sandbox",
            "--disable-dev-shm-usage",
            "--disable-gpu",
          ],
        },
      });

      this.client.on("qr", async (qr: string) => {
        try {
          this.state.qrCode = await QRCode.toDataURL(qr, { width: 300, margin: 2 });
          this.state.status = "qr_pending";
          console.log("[WA] QR code generated, waiting for scan...");
        } catch (err) {
          console.error("[WA] QR generation error:", err);
        }
      });

      this.client.on("ready", async () => {
        this.state.status = "ready";
        this.state.qrCode = null;
        try {
          const info = this.client?.info;
          if (info) {
            this.state.connectedNumber = info.wid?.user || null;
            this.state.connectedName = info.pushname || null;
          }
        } catch { /* ignore */ }
        console.log(`[WA] Ready! Connected as ${this.state.connectedName} (${this.state.connectedNumber})`);
      });

      this.client.on("disconnected", (reason: string) => {
        console.log("[WA] Disconnected:", reason);
        this.state.status = "disconnected";
        this.state.connectedNumber = null;
        this.state.connectedName = null;
        this.client = null;
      });

      this.client.on("auth_failure", (msg: string) => {
        console.error("[WA] Auth failure:", msg);
        this.state.status = "error";
        this.state.error = `Auth failure: ${msg}`;
      });

      this.client.on("message_create", async (msg: Message) => {
        for (const handler of this.onMessageHandlers) {
          try {
            await handler(msg);
          } catch (err) {
            console.error("[WA] Message handler error:", err);
          }
        }
      });

      await this.client.initialize();
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error("[WA] Initialize error:", errMsg);
      this.state.status = "error";
      this.state.error = errMsg;
      this.client = null;
      throw err;
    }
  }

  async stop(): Promise<void> {
    if (this.client) {
      try {
        await this.client.destroy();
      } catch { /* ignore */ }
      this.client = null;
    }
    this.state.status = "disconnected";
    this.state.qrCode = null;
    this.state.connectedNumber = null;
    this.state.connectedName = null;
    this.state.error = null;
  }

  async logout(): Promise<void> {
    if (this.client) {
      try {
        await this.client.logout();
      } catch { /* ignore */ }
      try {
        await this.client.destroy();
      } catch { /* ignore */ }
      this.client = null;
    }
    this.state.status = "disconnected";
    this.state.qrCode = null;
    this.state.connectedNumber = null;
    this.state.connectedName = null;
    this.state.error = null;
  }

  async getContacts(): Promise<Contact[]> {
    if (!this.client || this.state.status !== "ready") {
      throw new Error("Client not ready");
    }
    return this.client.getContacts();
  }

  async getChatMessages(chatId: string, limit = 50): Promise<Message[]> {
    if (!this.client || this.state.status !== "ready") {
      throw new Error("Client not ready");
    }
    const chat = await this.client.getChatById(chatId);
    return chat.fetchMessages({ limit });
  }

  getClient(): Client | null {
    return this.client;
  }
}

// True singleton via globalThis
const globalForWA = globalThis as unknown as { waClient: WhatsAppClient | undefined };
export const waClient = globalForWA.waClient ?? new WhatsAppClient();
if (process.env.NODE_ENV !== "production") globalForWA.waClient = waClient;
