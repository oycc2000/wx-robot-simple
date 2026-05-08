export interface ChatMessage {
  id: number;
  from: string;
  to: string;
  text: string;
  direction: "in" | "out";
  timestamp: number;
}

const MAX_MESSAGES = 1000;
const messages: ChatMessage[] = [];
let nextId = 1;

export function addMessage(msg: Omit<ChatMessage, "id" | "timestamp">): ChatMessage {
  const full: ChatMessage = {
    ...msg,
    id: nextId++,
    timestamp: Date.now(),
  };
  messages.push(full);
  if (messages.length > MAX_MESSAGES) {
    messages.splice(0, messages.length - MAX_MESSAGES);
  }
  return full;
}

export function getMessages(opts: {
  limit?: number;
  user?: string;
  since?: number;
}): ChatMessage[] {
  let result = [...messages];
  if (opts.user) {
    result = result.filter(
      (m) => m.from === opts.user || m.to === opts.user,
    );
  }
  if (opts.since !== undefined) {
    const since = opts.since;
    result = result.filter((m) => m.timestamp >= since);
  }
  result.reverse();
  const limit = Math.min(opts.limit ?? 20, 100);
  return result.slice(0, limit);
}

export function getMessageCount(): number {
  return messages.length;
}
