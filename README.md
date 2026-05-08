# wx-robot-simple

[![Node.js](https://img.shields.io/badge/Node.js-22+-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Docker](https://img.shields.io/badge/Docker-✓-2496ED?logo=docker&logoColor=white)](https://www.docker.com/)
[![WeChat](https://img.shields.io/badge/WeChat-iLink_API-07C160?logo=wechat&logoColor=white)](https://www.npmjs.com/package/@tencent-weixin/openclaw-weixin)
[![License](https://img.shields.io/badge/License-MIT-blue)](./LICENSE)

基于腾讯 iLink API 的微信通讯接口。支持 AI 自动回复 + 文件轮询主动发送，可作为电脑端与微信之间的双向通讯桥梁。

## 核心功能

- **AI 自动回复** — 接收微信消息，调用 AI 模型自动回复（兼容 OpenAI 接口的任意模型）
- **文件轮询发送** — 写入 JSON 到文件 → 5 秒内自动发送到微信 → 自动清空文件
- **HTTP API** — REST 接口查看聊天记录、发送消息、查询服务状态
- **扫码登录** — 终端显示二维码，微信扫码完成授权
- **多轮对话** — 按用户维度维护上下文
- **凭证持久化** — 登录后自动保存，重启无需重新扫码
- **Docker 部署** — 一键部署到 Docker Desktop

## 前提条件

- Node.js >= 22（本地开发）
- Docker Desktop（Docker 部署）

## 快速开始

### 本地开发

```bash
git clone https://github.com/oycc2000/wx-robot-simple.git
cd wx-robot-simple
npm install
cp .env.example .env  # 编辑 .env 填入 API Key
npm run dev            # 终端显示二维码，微信扫码登录
```

### Docker 部署

```bash
cp .env.example .env  # 编辑 .env 填入 API Key
docker compose up -d   # 启动
docker compose logs -f  # 查看日志（含二维码，首次需扫码）
```

## 电脑端主动发送消息到微信

将 JSON 写入 `data/outgoing-messages.json`，程序每 5 秒检测一次，发现修改后自动发送并清空文件。

**消息格式：**

```json
{"to": "USER_ID@im.wechat", "text": "从电脑端发送的消息"}
```

**Bash：**

```bash
cat > data/outgoing-messages.json << 'EOF'
{"to": "目标用户ID@im.wechat", "text": "消息内容"}
EOF
```

**Python：**

```python
import json
msg = {"to": "user@im.wechat", "text": "消息内容"}
with open("data/outgoing-messages.json", "w") as f:
    json.dump(msg, f)
```

文件被程序读取 → 发送到微信 → 文件自动清空。一切在 5 秒内完成。

## HTTP API

服务启动后在 `http://localhost:3000` 提供 REST API（端口通过 `API_PORT` 环境变量配置）。

### GET /api/messages

查看聊天记录（最新在前）。

```bash
curl http://localhost:3000/api/messages                  # 最近 20 条
curl http://localhost:3000/api/messages?limit=50          # 最近 50 条
curl http://localhost:3000/api/messages?user=USER_ID      # 按用户筛选
```

**响应：**
```json
{
  "count": 2,
  "total": 100,
  "messages": [
    {
      "id": 100,
      "from": "USER_ID@im.wechat",
      "to": "BOT_ID@im.bot",
      "text": "你好",
      "direction": "in",
      "timestamp": 1778211100000
    },
    {
      "id": 99,
      "from": "BOT_ID@im.bot",
      "to": "USER_ID@im.wechat",
      "text": "你好！有什么可以帮你？",
      "direction": "out",
      "timestamp": 1778211090000
    }
  ]
}
```

### POST /api/send

发送消息到微信。

```bash
curl -X POST http://localhost:3000/api/send \
  -H "Content-Type: application/json" \
  -d '{"to":"USER_ID@im.wechat","text":"消息内容"}'
```

**响应：** `{"success": true}`

### GET /api/status

服务运行状态。

```bash
curl http://localhost:3000/api/status
```

**响应：**
```json
{
  "status": "running",
  "accountId": "BOT_ID@im.bot",
  "userId": "USER_ID@im.wechat",
  "messageCount": 42,
  "uptime": 3600.5
}
```

## 环境变量（.env）

```env
OPENAI_API_KEY=sk-xxx
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_MODEL=gpt-4o
SYSTEM_PROMPT=你是一个友好的AI助手，简洁明了地回答问题。
API_PORT=3000
```

<details>
<summary>国内模型配置示例</summary>

**MiniMax：**
```env
OPENAI_API_KEY=sk-xxx
OPENAI_BASE_URL=https://api.minimaxi.com/v1
OPENAI_MODEL=MiniMax-M2.5
```

**DeepSeek：**
```env
OPENAI_API_KEY=sk-xxx
OPENAI_BASE_URL=https://api.deepseek.com
OPENAI_MODEL=deepseek-chat
```

**智谱 GLM：**
```env
OPENAI_API_KEY=sk-xxx
OPENAI_BASE_URL=https://open.bigmodel.cn/api/paas/v4
OPENAI_MODEL=glm-4
```

</details>

## 微信指令

| 指令 | 说明 |
|------|------|
| `/clear` | 清除当前对话上下文 |
| `任意文字` | AI 自动回复 |

启动参数 `--logout` 清除已保存的登录凭证：

```bash
npm run dev -- --logout
```

## 项目结构

```
src/
├── index.ts              # 入口，加载配置并启动
├── bot.ts                # Bot 主循环（长轮询 + 消息分发）
├── ai/
│   └── chat.ts           # AI 对话层（OpenAI 兼容接口）
├── api/
│   ├── server.ts         # HTTP API 服务器
│   └── message-store.ts  # 聊天记录存储
└── weixin/
    ├── types.ts          # 微信协议类型定义
    ├── api.ts            # 微信 HTTP API（收发消息）
    ├── auth.ts           # 扫码登录认证
    └── file-poller.ts    # 文件轮询发送模块
```

## 数据流

```
HTTP API (localhost:3000)
 GET  /api/messages → 聊天记录
 POST /api/send     → 发送消息
 GET  /api/status   → 服务状态
        │
        ▼
┌─────────────────┐    文件写入    ┌──────────────┐
│  wx-robot-simple  │ ←─────────── │ 外部程序/脚本  │
│                 │              └──────────────┘
│  微信用户发消息   │ ←── iLink 长轮询 ── 微信消息
│  AI 自动回复     │ ─── iLink API ──→ 微信用户收到回复
│  文件轮询发送    │ ─── iLink API ──→ 微信用户收到推送
└─────────────────┘
```

## 协议说明

本项目使用腾讯官方 OpenClaw 微信渠道的公开 HTTP API 协议（`ilink/bot/*`），通过扫码授权方式合法接入微信。

## License

MIT
