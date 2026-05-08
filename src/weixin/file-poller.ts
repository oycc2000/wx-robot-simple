import fs from "node:fs";
import path from "node:path";
import { sendTextMessage } from "./api.js";
import type { LoginCredentials } from "./types.js";
import { addMessage } from "../api/message-store.js";

const POLL_INTERVAL_MS = 5_000;
const OUTGOING_FILE = path.resolve("data/outgoing-messages.json");

interface OutgoingMessage {
  to?: string;
  text: string;
}

export class FilePoller {
  private credentials: LoginCredentials;
  private lastMtime = 0;
  private timer: ReturnType<typeof setInterval> | null = null;
  private sending = false;

  constructor(credentials: LoginCredentials) {
    this.credentials = credentials;
  }

  start(): void {
    const dir = path.dirname(OUTGOING_FILE);
    fs.mkdirSync(dir, { recursive: true });
    if (!fs.existsSync(OUTGOING_FILE)) {
      fs.writeFileSync(OUTGOING_FILE, "", "utf-8");
    }
    this.lastMtime = fs.statSync(OUTGOING_FILE).mtimeMs;

    console.log("[file-poller] 已启动，监控文件:", OUTGOING_FILE);
    this.timer = setInterval(() => this.poll(), POLL_INTERVAL_MS);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    console.log("[file-poller] 已停止");
  }

  private async poll(): Promise<void> {
    if (this.sending) return;

    try {
      const stat = fs.statSync(OUTGOING_FILE);
      if (stat.mtimeMs === this.lastMtime || stat.size === 0) return;
      this.lastMtime = stat.mtimeMs;

      const raw = fs.readFileSync(OUTGOING_FILE, "utf-8");
      if (!raw.trim()) return;

      let msg: OutgoingMessage;
      try {
        msg = JSON.parse(raw) as OutgoingMessage;
      } catch {
        console.error("[file-poller] JSON 解析失败，清空文件");
        fs.writeFileSync(OUTGOING_FILE, "", "utf-8");
        return;
      }

      if (!msg.text) {
        console.error("[file-poller] 消息格式无效，需要 text 字段");
        fs.writeFileSync(OUTGOING_FILE, "", "utf-8");
        return;
      }
      const recipient = msg.to || this.credentials.userId;
      if (!recipient) {
        console.error("[file-poller] 未指定接收人，且无默认用户");
        fs.writeFileSync(OUTGOING_FILE, "", "utf-8");
        return;
      }

      this.sending = true;
      console.log(`[file-poller] 发送消息 to=${recipient}: ${msg.text.slice(0, 100)}`);
      await sendTextMessage(
        this.credentials.baseUrl,
        this.credentials.token,
        recipient,
        msg.text,
      );
      console.log("[file-poller] 消息发送成功");
      addMessage({ from: this.credentials.userId ?? "bot", to: recipient, text: msg.text, direction: "out" });

      fs.writeFileSync(OUTGOING_FILE, "", "utf-8");
      this.lastMtime = fs.statSync(OUTGOING_FILE).mtimeMs;
    } catch (err) {
      console.error(`[file-poller] 发送失败: ${err}`);
    } finally {
      this.sending = false;
    }
  }
}
