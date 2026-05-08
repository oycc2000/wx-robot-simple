import http from "node:http";
import { getMessages, getMessageCount, addMessage } from "./message-store.js";
import { sendTextMessage } from "../weixin/api.js";
import type { LoginCredentials } from "../weixin/types.js";

const JSON_HEADERS: Record<string, string> = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function json(res: http.ServerResponse, code: number, body: unknown): void {
  res.writeHead(code, JSON_HEADERS);
  res.end(JSON.stringify(body));
}

function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve) => {
    let data = "";
    req.on("data", (chunk) => (data += chunk));
    req.on("end", () => resolve(data));
  });
}

function parseUrl(req: http.IncomingMessage): URL {
  return new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
}

export function createServer(credentials: LoginCredentials, port: number): http.Server {
  const server = http.createServer(async (req, res) => {
    const url = parseUrl(req);
    const path = url.pathname;
    const method = req.method ?? "GET";

    // CORS preflight
    if (method === "OPTIONS") {
      res.writeHead(204, JSON_HEADERS);
      res.end();
      return;
    }

    // GET /api/messages
    if (method === "GET" && path === "/api/messages") {
      const limit = parseInt(url.searchParams.get("limit") ?? "20", 10);
      const user = url.searchParams.get("user") ?? undefined;
      const since = url.searchParams.get("since")
        ? parseInt(url.searchParams.get("since")!, 10)
        : undefined;

      const msgs = getMessages({ limit, user, since });
      json(res, 200, { count: msgs.length, total: getMessageCount(), messages: msgs });
      return;
    }

    // POST /api/send
    if (method === "POST" && path === "/api/send") {
      try {
        const body = await readBody(req);
        const { to, text } = JSON.parse(body);
        if (!to || !text) {
          json(res, 400, { error: "缺少 to 或 text 字段" });
          return;
        }

        console.log(`[api] 发送消息 to=${to}: ${text.slice(0, 100)}`);
        await sendTextMessage(credentials.baseUrl, credentials.token, to, text);

        addMessage({ from: credentials.userId ?? "bot", to, text, direction: "out" });
        json(res, 200, { success: true });
      } catch (err) {
        console.error(`[api] 发送失败: ${err}`);
        json(res, 500, { error: "发送失败", detail: String(err) });
      }
      return;
    }

    // GET /api/status
    if (method === "GET" && path === "/api/status") {
      json(res, 200, {
        status: "running",
        accountId: credentials.accountId,
        userId: credentials.userId,
        messageCount: getMessageCount(),
        uptime: process.uptime(),
      });
      return;
    }

    // 404
    json(res, 404, { error: "not found" });
  });

  server.listen(port, () => {
    console.log(`[api] HTTP API 已启动: http://localhost:${port}`);
    console.log(`[api]   GET  /api/messages  — 查看聊天记录`);
    console.log(`[api]   POST /api/send     — 发送消息到微信`);
    console.log(`[api]   GET  /api/status   — 服务状态`);
  });

  return server;
}
