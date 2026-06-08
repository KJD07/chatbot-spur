import { Message } from "./types";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

export async function sendMessage(
  message: string,
  sessionId: string | null
): Promise<{ reply: string; sessionId: string }> {
  const res = await fetch(`${API_URL}/chat/message`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, sessionId: sessionId ?? undefined }),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `Server error: ${res.status}`);
  }

  return res.json();
}

export async function fetchHistory(sessionId: string): Promise<Message[]> {
  const res = await fetch(`${API_URL}/chat/history/${sessionId}`);

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `Server error: ${res.status}`);
  }

  const data = await res.json();
  return data.messages as Message[];
}
