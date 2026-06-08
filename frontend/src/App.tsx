import { useState, useEffect, useRef, useCallback } from "react";
import { Message } from "./types";
import { sendMessage, fetchHistory } from "./api";

const BOT_AVATAR = (
  <div className="bot-avatar" aria-label="Support agent">
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="3" y="7" width="18" height="12" rx="3" stroke="currentColor" strokeWidth="1.5"/>
      <circle cx="9" cy="13" r="1.5" fill="currentColor"/>
      <circle cx="15" cy="13" r="1.5" fill="currentColor"/>
      <path d="M9 7V5a3 3 0 016 0v2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M3 11h2M19 11h2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  </div>
);

function TypingIndicator() {
  return (
    <div className="msg-row msg-row--ai">
      {BOT_AVATAR}
      <div className="bubble bubble--typing" aria-live="polite" aria-label="Agent is typing">
        <span className="dot" />
        <span className="dot" />
        <span className="dot" />
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="empty-state">
      <div className="empty-icon">
        <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="4" y="10" width="40" height="28" rx="6" stroke="currentColor" strokeWidth="2"/>
          <circle cx="17" cy="24" r="3" fill="currentColor"/>
          <circle cx="31" cy="24" r="3" fill="currentColor"/>
          <path d="M17 10V7a7 7 0 0114 0v3" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          <path d="M4 20h4M40 20h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
        </svg>
      </div>
      <h2>Ask me anything</h2>
      <p>I'm your Spur Store support agent. Ask about shipping, returns, or anything else.</p>
      <div className="suggestion-chips">
        {["Do you ship to India?", "What's your return policy?", "Is shipping free?"].map((q) => (
          <button key={q} className="chip" onClick={() => {
            const input = document.querySelector<HTMLTextAreaElement>(".chat-input textarea");
            if (input) {
              const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value")?.set;
              nativeInputValueSetter?.call(input, q);
              input.dispatchEvent(new Event("input", { bubbles: true }));
              input.focus();
            }
          }}>
            {q}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [networkError, setNetworkError] = useState<string | null>(null);
  const [historyLoading, setHistoryLoading] = useState(true);
  const lastSentRef = useRef<{ text: string; time: number } | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const MAX_CHARS = 2000;

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading, scrollToBottom]);

  // Load session on mount
  useEffect(() => {
    const stored = localStorage.getItem("spur_session_id");
    if (stored) {
      setSessionId(stored);
      fetchHistory(stored)
        .then((msgs) => setMessages(msgs))
        .catch(() => {
          // Session may be stale — start fresh
          localStorage.removeItem("spur_session_id");
          setSessionId(null);
        })
        .finally(() => setHistoryLoading(false));
    } else {
      setHistoryLoading(false);
    }
  }, []);

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || loading) return;

    // Deduplicate rapid duplicate sends
    const now = Date.now();
    if (
      lastSentRef.current &&
      lastSentRef.current.text === text &&
      now - lastSentRef.current.time < 2000
    ) return;
    lastSentRef.current = { text, time: now };

    setInput("");
    setNetworkError(null);
    setLoading(true);

    // Optimistic user message
    const optimisticMsg: Message = {
      id: `opt-${now}`,
      sender: "USER",
      text,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimisticMsg]);

    try {
      const { reply, sessionId: newSessionId } = await sendMessage(text, sessionId);

      // Persist session
      if (!sessionId) {
        localStorage.setItem("spur_session_id", newSessionId);
        setSessionId(newSessionId);
      }

      const aiMsg: Message = {
        id: `ai-${Date.now()}`,
        sender: "AI",
        text: reply,
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, aiMsg]);
    } catch (err) {
      setNetworkError(
        err instanceof Error ? err.message : "Network error. Please check your connection."
      );
      // Remove optimistic message on failure
      setMessages((prev) => prev.filter((m) => m.id !== optimisticMsg.id));
    } finally {
      setLoading(false);
    }
  }, [input, loading, sessionId]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleNewConversation = () => {
    localStorage.removeItem("spur_session_id");
    setSessionId(null);
    setMessages([]);
    setNetworkError(null);
    setInput("");
    lastSentRef.current = null;
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (e.target.value.length <= MAX_CHARS) setInput(e.target.value);
  };

  const charCount = input.length;
  const isOverLimit = charCount >= MAX_CHARS * 0.9;

  return (
    <div className="app">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="brand-icon">S</div>
          <div>
            <div className="brand-name">Spur Store</div>
            <div className="brand-sub">Support</div>
          </div>
        </div>

        <nav className="sidebar-nav">
          <div className="nav-item nav-item--active">
            <svg viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z" clipRule="evenodd"/>
            </svg>
            Live Chat
          </div>
        </nav>

        <div className="sidebar-footer">
          <button className="new-chat-btn" onClick={handleNewConversation} title="Start a new conversation">
            <svg viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd"/>
            </svg>
            New Conversation
          </button>
          <div className="agent-status">
            <span className="status-dot" />
            Agent online
          </div>
        </div>
      </aside>

      {/* Main chat area */}
      <main className="chat-main">
        <header className="chat-header">
          <div className="header-agent">
            {BOT_AVATAR}
            <div>
              <div className="agent-name">Spur Assistant</div>
              <div className="agent-online">
                <span className="status-dot" />
                Online
              </div>
            </div>
          </div>
          <div className="header-meta">Typical reply time: instant</div>
        </header>

        {/* Network error banner */}
        {networkError && (
          <div className="error-banner" role="alert">
            <svg viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd"/>
            </svg>
            {networkError}
            <button className="error-close" onClick={() => setNetworkError(null)}>✕</button>
          </div>
        )}

        {/* Messages */}
        <div className="messages-area" role="log" aria-live="polite">
          {historyLoading ? (
            <div className="loading-history">Loading conversation…</div>
          ) : messages.length === 0 ? (
            <EmptyState />
          ) : (
            <>
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`msg-row msg-row--${msg.sender === "USER" ? "user" : "ai"}`}
                >
                  {msg.sender === "AI" && BOT_AVATAR}
                  <div className={`bubble bubble--${msg.sender === "USER" ? "user" : "ai"}`}>
                    <p>{msg.text}</p>
                    <time className="msg-time" dateTime={msg.createdAt}>
                      {new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </time>
                  </div>
                </div>
              ))}
              {loading && <TypingIndicator />}
            </>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="chat-input">
          <div className="input-wrapper">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder="Type a message… (Enter to send)"
              rows={1}
              disabled={loading}
              aria-label="Message input"
            />
            <button
              className="send-btn"
              onClick={handleSend}
              disabled={loading || !input.trim()}
              aria-label="Send message"
            >
              {loading ? (
                <svg className="spin" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="30 70" strokeLinecap="round"/>
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
                </svg>
              )}
            </button>
          </div>
          <div className={`char-count ${isOverLimit ? "char-count--warn" : ""}`}>
            {charCount} / {MAX_CHARS}
          </div>
        </div>
      </main>
    </div>
  );
}
