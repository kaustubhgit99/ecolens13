"use client";
import { useState, useRef, useEffect, useCallback } from "react";

interface Message {
  id: string;
  role: "user" | "bot";
  text: string;
  timestamp: Date;
}

const WHATSAPP_LINK = "https://wa.me/qr/FXWJ2ERM5IJYM1";

const QUICK_ACTIONS = [
  { emoji: "📝", label: "How to report?" },
  { emoji: "🔍", label: "Track complaint" },
  { emoji: "🪙", label: "EcoCoins info" },
  { emoji: "📍", label: "Amravati wards" },
];

export default function EcoBotWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [hasNewMessage, setHasNewMessage] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  // Focus input when chat opens
  useEffect(() => {
    if (isOpen && !isMinimized && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 200);
    }
  }, [isOpen, isMinimized]);

  // Welcome message
  useEffect(() => {
    if (isOpen && messages.length === 0) {
      setMessages([
        {
          id: "welcome",
          role: "bot",
          text: "Hi! I'm **EcoBot** 🌿 — your EcoLens support assistant.\n\nI can help you with:\n• 📝 Reporting complaints\n• 🔍 Tracking status\n• 🪙 EcoCoins & rewards\n• 📍 Wards & locations\n\nHow can I help you today?",
          timestamp: new Date(),
        },
      ]);
    }
  }, [isOpen, messages.length]);

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || isTyping) return;

      const userMsg: Message = {
        id: `user-${Date.now()}`,
        role: "user",
        text: text.trim(),
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, userMsg]);
      setInput("");
      setIsTyping(true);

      try {
        const history = messages
          .filter((m) => m.id !== "welcome")
          .map((m) => ({ role: m.role, text: m.text }));

        const resp = await fetch("/api/chatbot", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: text.trim(), history }),
        });

        const data = await resp.json();

        const botMsg: Message = {
          id: `bot-${Date.now()}`,
          role: "bot",
          text: data.reply || "Sorry, I couldn't process that. Please try again.",
          timestamp: new Date(),
        };

        setMessages((prev) => [...prev, botMsg]);
        if (!isOpen) setHasNewMessage(true);
      } catch {
        setMessages((prev) => [
          ...prev,
          {
            id: `err-${Date.now()}`,
            role: "bot",
            text: "Connection error. Please try again. 🔄",
            timestamp: new Date(),
          },
        ]);
      } finally {
        setIsTyping(false);
      }
    },
    [messages, isTyping, isOpen]
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  const toggleChat = () => {
    if (isOpen) {
      setIsOpen(false);
      setIsMinimized(false);
    } else {
      setIsOpen(true);
      setIsMinimized(false);
      setHasNewMessage(false);
    }
  };

  const toggleMinimize = () => {
    setIsMinimized((v) => !v);
  };

  // Simple markdown-like bold rendering
  const renderText = (text: string) => {
    const parts = text.split(/(\*\*[^*]+\*\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return (
          <strong key={i} style={{ color: "#0EA5E9", fontWeight: 700 }}>
            {part.slice(2, -2)}
          </strong>
        );
      }
      return part.split("\n").map((line, j) => (
        <span key={`${i}-${j}`}>
          {j > 0 && <br />}
          {line}
        </span>
      ));
    });
  };

  const formatTime = (d: Date) =>
    `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;

  return (
    <>
      {/* ── Chat Window ──────────────────────────────────────────── */}
      {isOpen && (
        <div
          style={{
            position: "fixed",
            bottom: 90,
            right: 20,
            width: 380,
            maxWidth: "calc(100vw - 32px)",
            height: isMinimized ? 62 : 560,
            maxHeight: isMinimized ? 62 : "calc(100vh - 120px)",
            background: "#FFFFFF",
            border: "1px solid var(--border)",
            borderRadius: 20,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            zIndex: 10000,
            boxShadow: "8px 8px 30px rgba(163,199,224,0.45), -4px -4px 12px rgba(255,255,255,0.8)",
            animation: "chatSlideUp 0.3s ease",
            transition: "height 0.3s ease",
          }}
        >
          {/* Header — always visible, click to minimize/expand */}
          <div
            style={{
              background: "linear-gradient(135deg, #0EA5E9 0%, #0284C7 100%)",
              borderBottom: isMinimized ? "none" : "1px solid rgba(14,165,233,0.3)",
              padding: "14px 16px",
              display: "flex",
              alignItems: "center",
              gap: 12,
              flexShrink: 0,
              cursor: "pointer",
              userSelect: "none",
            }}
            onClick={toggleMinimize}
          >
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: "50%",
                overflow: "hidden",
                border: "2px solid rgba(255,255,255,0.5)",
                flexShrink: 0,
                background: "rgba(255,255,255,0.2)",
              }}
            >
              <img src="/ecobot-avatar.png" alt="EcoBot" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 15, fontFamily: "var(--font-syne)", color: "#FFFFFF" }}>
                Eco<span style={{ color: "#BAE6FD" }}>Bot</span>
              </div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.8)", display: "flex", alignItems: "center", gap: 4 }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#4ADE80", display: "inline-block", boxShadow: "0 0 6px #4ADE80" }} />
                Online · EcoLens Support
              </div>
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              {/* Minimize/Expand */}
              <button
                onClick={(e) => { e.stopPropagation(); toggleMinimize(); }}
                style={{
                  background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.2)", color: "rgba(255,255,255,0.8)",
                  width: 28, height: 28, borderRadius: 6, cursor: "pointer", fontSize: 14,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}
              >
                {isMinimized ? "▲" : "▼"}
              </button>
              {/* Close */}
              <button
                onClick={(e) => { e.stopPropagation(); toggleChat(); }}
                style={{
                  background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.2)", color: "rgba(255,255,255,0.8)",
                  width: 28, height: 28, borderRadius: 6, cursor: "pointer", fontSize: 14,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}
              >
                ✕
              </button>
            </div>
          </div>

          {/* Body — hidden when minimized */}
          {!isMinimized && (
            <>
              {/* Messages area */}
              <div
                ref={scrollRef}
                style={{
                  flex: 1, overflowY: "auto", padding: "14px 14px 8px",
                  display: "flex", flexDirection: "column", gap: 10,
                }}
              >
                {messages.map((msg) => (
                  <div key={msg.id} style={{ display: "flex", flexDirection: "column", alignItems: msg.role === "user" ? "flex-end" : "flex-start" }}>
                    <div style={{ display: "flex", alignItems: "flex-end", gap: 8, flexDirection: msg.role === "user" ? "row-reverse" : "row", maxWidth: "88%" }}>
                      {msg.role === "bot" && (
                        <div style={{ width: 26, height: 26, borderRadius: "50%", overflow: "hidden", flexShrink: 0, border: "1.5px solid var(--primary3)" }}>
                          <img src="/ecobot-avatar.png" alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        </div>
                      )}
                      <div
                        style={{
                          padding: "10px 14px",
                          borderRadius: msg.role === "user" ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
                          background: msg.role === "user" ? "linear-gradient(135deg, #0EA5E9, #0284C7)" : "var(--surface2)",
                          color: msg.role === "user" ? "#FFFFFF" : "var(--text)",
                          fontSize: 13, lineHeight: 1.55,
                          border: msg.role === "user" ? "none" : "1px solid var(--border)",
                          wordBreak: "break-word",
                          boxShadow: msg.role === "user" ? "0 3px 10px rgba(14,165,233,0.2)" : "var(--clay-shadow-sm)",
                        }}
                      >
                        {renderText(msg.text)}
                      </div>
                    </div>
                    <div style={{ fontSize: 9, color: "var(--text3)", marginTop: 3, paddingLeft: msg.role === "bot" ? 34 : 0, paddingRight: msg.role === "user" ? 4 : 0 }}>
                      {formatTime(msg.timestamp)}
                    </div>
                  </div>
                ))}

                {/* Typing indicator */}
                {isTyping && (
                  <div style={{ display: "flex", alignItems: "flex-end", gap: 8 }}>
                    <div style={{ width: 26, height: 26, borderRadius: "50%", overflow: "hidden", flexShrink: 0, border: "1.5px solid var(--primary3)" }}>
                      <img src="/ecobot-avatar.png" alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    </div>
                    <div style={{ padding: "12px 18px", borderRadius: "16px 16px 16px 4px", background: "var(--surface2)", border: "1px solid var(--border)", display: "flex", gap: 5, boxShadow: "var(--clay-shadow-sm)" }}>
                      {[0, 1, 2].map((i) => (
                        <div key={i} style={{ width: 7, height: 7, borderRadius: "50%", background: "#0EA5E9", animation: `typingDot 1.4s ease-in-out ${i * 0.2}s infinite` }} />
                      ))}
                    </div>
                  </div>
                )}

                {/* Quick actions */}
                {messages.length <= 1 && !isTyping && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 4 }}>
                    {QUICK_ACTIONS.map((qa) => (
                      <button
                        key={qa.label}
                        onClick={() => sendMessage(qa.label)}
                        style={{
                          padding: "7px 12px", borderRadius: 20, border: "1px solid var(--border)",
                          background: "var(--surface)", color: "var(--text2)", fontSize: 12, cursor: "pointer",
                          transition: "all .15s", display: "flex", alignItems: "center", gap: 5,
                          boxShadow: "var(--clay-shadow-sm)",
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#0EA5E9"; e.currentTarget.style.color = "#0EA5E9"; e.currentTarget.style.background = "#E0F2FE"; }}
                        onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.color = "var(--text2)"; e.currentTarget.style.background = "var(--surface)"; }}
                      >
                        <span>{qa.emoji}</span>{qa.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* WhatsApp button */}
              <div style={{ padding: "0 14px 8px" }}>
                <a
                  href={WHATSAPP_LINK} target="_blank" rel="noopener noreferrer"
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                    padding: "9px 14px", borderRadius: 12,
                    background: "linear-gradient(135deg, #075E54, #128C7E)",
                    color: "#fff", fontSize: 12, fontWeight: 600, textDecoration: "none",
                    transition: "all .2s", border: "1px solid #25D366",
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="#fff">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                  </svg>
                  Connect via WhatsApp Support
                </a>
              </div>

              {/* Input area */}
              <form
                onSubmit={handleSubmit}
                style={{ padding: "10px 14px 14px", borderTop: "1px solid var(--border)", display: "flex", gap: 8, background: "var(--surface)" }}
              >
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask about EcoLens..."
                  disabled={isTyping}
                  style={{
                    flex: 1, background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 12,
                    padding: "10px 14px", color: "var(--text)", fontSize: 13, outline: "none", fontFamily: "inherit",
                    transition: "border-color .15s", boxShadow: "var(--clay-inset)",
                  }}
                  onFocus={(e) => (e.currentTarget.style.borderColor = "#0EA5E9")}
                  onBlur={(e) => (e.currentTarget.style.borderColor = "var(--border)")}
                />
                <button
                  type="submit"
                  disabled={!input.trim() || isTyping}
                  style={{
                    width: 42, height: 42, borderRadius: 12, border: "none",
                    background: input.trim() && !isTyping ? "linear-gradient(135deg, #0EA5E9, #0284C7)" : "var(--surface2)",
                    color: input.trim() && !isTyping ? "#FFFFFF" : "var(--text3)",
                    fontSize: 18, cursor: input.trim() && !isTyping ? "pointer" : "not-allowed",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    transition: "all .2s", flexShrink: 0,
                  }}
                >
                  ↑
                </button>
              </form>
            </>
          )}
        </div>
      )}

      {/* ── Floating Button ──────────────────────────────────────── */}
      <button
        onClick={toggleChat}
        style={{
          position: "fixed",
          bottom: 20,
          right: 20,
          width: 58,
          height: 58,
          borderRadius: "50%",
          border: "2px solid #0EA5E9",
          background: isOpen ? "#FFFFFF" : "linear-gradient(135deg, #0EA5E9, #0284C7)",
          cursor: "pointer",
          zIndex: 10001,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: isOpen
            ? "6px 6px 16px rgba(163,199,224,0.45), -4px -4px 12px rgba(255,255,255,0.8)"
            : "0 4px 24px rgba(14,165,233,0.35), 6px 6px 16px rgba(163,199,224,0.35)",
          transition: "all .3s ease",
          overflow: "hidden",
          padding: 0,
        }}
      >
        {isOpen ? (
          <span style={{ fontSize: 22, color: "var(--text3)", lineHeight: 1 }}>✕</span>
        ) : (
          <img src="/ecobot-avatar.png" alt="Chat" style={{ width: 40, height: 40, borderRadius: "50%", objectFit: "cover" }} />
        )}
        {hasNewMessage && !isOpen && (
          <div
            style={{
              position: "absolute", top: 2, right: 2, width: 14, height: 14,
              borderRadius: "50%", background: "#EF4444", border: "2px solid #FFFFFF",
              animation: "pulse 2s infinite",
            }}
          />
        )}
      </button>

      {/* ── Animations ────────────────────────────────────────────── */}
      <style>{`
        @keyframes chatSlideUp {
          from { opacity: 0; transform: translateY(20px) scale(0.95); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes typingDot {
          0%, 60%, 100% { opacity: 0.3; transform: translateY(0); }
          30% { opacity: 1; transform: translateY(-4px); }
        }
      `}</style>
    </>
  );
}
