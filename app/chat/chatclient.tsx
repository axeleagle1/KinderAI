"use client";

import React, { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

/** ---------- Tiny inline icons (no dependencies) ---------- */
function Icon({
  children,
  size = 18,
  title,
}: {
  children: React.ReactNode;
  size?: number;
  title?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden={title ? undefined : true}
      role={title ? "img" : "presentation"}
    >
      {title ? <title>{title}</title> : null}
      {children}
    </svg>
  );
}

const IPlus = (p: { size?: number }) => (
  <Icon size={p.size} title="Plus">
    <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </Icon>
);

const ISearch = (p: { size?: number }) => (
  <Icon size={p.size} title="Search">
    <path
      d="M10.5 18a7.5 7.5 0 1 1 5.2-12.9A7.5 7.5 0 0 1 10.5 18Z"
      stroke="currentColor"
      strokeWidth="2"
    />
    <path d="M16.3 16.3 21 21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </Icon>
);

const IMenu = (p: { size?: number }) => (
  <Icon size={p.size} title="Menu">
    <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </Icon>
);

const IX = (p: { size?: number }) => (
  <Icon size={p.size} title="Close">
    <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </Icon>
);

const ISend = (p: { size?: number }) => (
  <Icon size={p.size} title="Send">
    <path
      d="M4 12l16-8-6.5 16-2.8-6.2L4 12Z"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinejoin="round"
    />
  </Icon>
);

/** ---------- Types ---------- */
type Tier = "lite" | "pro";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  quickReplies?: string[];
  statusLine?: string;
};

type Chat = {
  id: string;
  title: string;
  messages: Message[];
};

const MODEL_LABEL: Record<Tier, string> = {
  lite: "KinderAI Lite",
  pro: "KinderAI Pro (Locked)",
};

const LS_CHATS = "kinderai-chats";
const LS_TIER = "kinderai-tier";

const newId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

function makeTitle(text: string) {
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (!cleaned) return "Untitled";
  if (cleaned.length <= 42) return cleaned;
  return cleaned.slice(0, 42).trim() + "…";
}

function pickStatusLine() {
  const options = ["Ready when you are.", "No rush. Take your time.", "We can keep it simple."];
  return options[Math.floor(Math.random() * options.length)];
}

function cleanQuickReplyLabel(t: string) {
  return t.replace(/^\[MODE:[A-Z]+\]\s*/i, "");
}

/** ---------- Main Component ---------- */
export default function ChatClient() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const didAutoSend = useRef(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [tier, setTier] = useState<Tier>("lite");

  const [chats, setChats] = useState<Chat[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);

  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const activeChat = useMemo(
    () => chats.find((c) => c.id === activeChatId) ?? null,
    [chats, activeChatId]
  );

  /** ---------- Load / Save ---------- */
  useEffect(() => {
    // Tier
    const savedTier = localStorage.getItem(LS_TIER) as Tier | null;
    if (savedTier === "lite" || savedTier === "pro") setTier(savedTier);

    // Chats
    const saved = localStorage.getItem(LS_CHATS);
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as Chat[];
        if (Array.isArray(parsed) && parsed.length) {
          setChats(parsed);
          setActiveChatId(parsed[0].id);
          return;
        }
      } catch {
        // ignore
      }
    }

    const first: Chat = { id: newId(), title: "Untitled", messages: [] };
    setChats([first]);
    setActiveChatId(first.id);
  }, []);

  useEffect(() => {
    localStorage.setItem(LS_TIER, tier);
  }, [tier]);

  useEffect(() => {
    localStorage.setItem(LS_CHATS, JSON.stringify(chats));
  }, [chats]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeChat?.messages, loading]);

  /** ---------- Chat helpers ---------- */
  const createNewChat = () => {
    const c: Chat = { id: newId(), title: "Untitled", messages: [] };
    setChats((prev) => [c, ...prev]);
    setActiveChatId(c.id);
    setMobileSidebarOpen(false);
    setInput("");
  };

  const selectChat = (id: string) => {
    setActiveChatId(id);
    setMobileSidebarOpen(false);
  };

  const hideQuickRepliesForMessage = (chatId: string, messageId: string) => {
    setChats((prev) =>
      prev.map((c) =>
        c.id !== chatId
          ? c
          : { ...c, messages: c.messages.map((m) => (m.id === messageId ? { ...m, quickReplies: [] } : m)) }
      )
    );
  };

  /** ---------- API call ---------- */
  const sendMessage = async (text: string) => {
    if (!activeChat || loading) return;
    const messageToSend = (text ?? "").trim();
    if (!messageToSend) return;

    const userMessage: Message = { id: newId(), role: "user", content: messageToSend };

    setChats((prev) =>
      prev.map((chat) =>
        chat.id === activeChat.id
          ? {
              ...chat,
              title: chat.messages.length === 0 ? makeTitle(messageToSend) : chat.title,
              messages: [...chat.messages, userMessage],
            }
          : chat
      )
    );

    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: messageToSend, tier }),
      });

      const data = await res.json();

      const aiMessage: Message = {
        id: newId(),
        role: "assistant",
        content: data?.reply ?? "No response.",
        quickReplies: Array.isArray(data?.quickReplies) ? data.quickReplies : [],
        statusLine: pickStatusLine(),
      };

      setChats((prev) =>
        prev.map((chat) => (chat.id === activeChat.id ? { ...chat, messages: [...chat.messages, aiMessage] } : chat))
      );
    } catch {
      const aiMessage: Message = {
        id: newId(),
        role: "assistant",
        content: "Something went wrong.",
        quickReplies: ["Try again", "Start over", "[MODE:GROUND] Calm down"],
        statusLine: "Network issue. Try again when ready.",
      };

      setChats((prev) =>
        prev.map((chat) => (chat.id === activeChat.id ? { ...chat, messages: [...chat.messages, aiMessage] } : chat))
      );
    } finally {
      setLoading(false);
    }
  };

  /** ---------- Auto-send ?prompt= ---------- */
  useEffect(() => {
    const prompt = searchParams.get("prompt");
    if (!prompt) return;
    if (!activeChat) return;
    if (didAutoSend.current) return;

    didAutoSend.current = true;
    sendMessage(prompt);

    // optional: clean URL (keeps /chat)
    // If you ever see weird navigation loops, comment this line out.
    router.replace("/chat");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeChat, searchParams]);

  /** ---------- File upload (optional stub) ---------- */
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeChat) return;

    // You can wire this into your API later. For now just acknowledge.
    const msg: Message = { id: newId(), role: "user", content: `📎 ${file.name}` };

    setChats((prev) =>
      prev.map((chat) => (chat.id === activeChat.id ? { ...chat, messages: [...chat.messages, msg] } : chat))
    );

    e.target.value = "";
  };

  /** ---------- Derived lists ---------- */
  const filteredChats = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return chats;
    return chats.filter(
      (chat) =>
        chat.title.toLowerCase().includes(q) ||
        chat.messages.some((m) => (m.content ?? "").toLowerCase().includes(q))
    );
  }, [chats, searchQuery]);

  const visibleChats = useMemo(() => filteredChats.filter((c) => c.messages.length > 0), [filteredChats]);

  /** ---------- UI ---------- */
  return (
    <div className="min-h-screen text-white">
      {/* Background */}
      <div className="fixed inset-0 -z-10 bg-[#020617]" />
      <div className="fixed inset-0 -z-10 bg-[radial-gradient(900px_circle_at_50%_0%,rgba(59,130,246,0.18),transparent_55%),radial-gradient(700px_circle_at_80%_20%,rgba(236,72,153,0.12),transparent_55%),radial-gradient(900px_circle_at_20%_80%,rgba(34,197,94,0.08),transparent_55%)]" />

      <div className="flex min-h-screen">
        {/* Desktop Sidebar */}
        <aside
          className={`hidden md:flex border-r border-white/5 bg-white/[0.03] backdrop-blur-2xl flex-col transition-all duration-200 ${
            sidebarCollapsed ? "w-20 p-4" : "w-72 p-6"
          }`}
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="w-11 h-11 flex items-center justify-center rounded-2xl bg-white/5 border border-white/10 shadow-lg overflow-hidden">
              <img src="/logo.png" alt="KinderAI" className="w-full h-full object-contain" />
            </div>

            {!sidebarCollapsed && (
              <div>
                <div className="text-lg font-semibold text-white/90 leading-tight">KinderAI</div>
                <div className="text-xs text-white/45">Chat</div>
              </div>
            )}

            <button
              onClick={() => setSidebarCollapsed((v) => !v)}
              className="ml-auto h-9 w-9 rounded-xl border border-white/10 bg-white/5 flex items-center justify-center text-white/70 hover:bg-white/10 transition"
              title={sidebarCollapsed ? "Expand" : "Collapse"}
            >
              <IMenu size={16} />
            </button>
          </div>

          <button
            onClick={createNewChat}
            className={`flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 to-blue-500 shadow-lg shadow-blue-600/20 hover:shadow-blue-500/25 transition ${
              sidebarCollapsed ? "h-12 w-12 mx-auto" : "px-4 py-2"
            }`}
            title="New chat"
          >
            <IPlus size={18} />
            {!sidebarCollapsed && "New Chat"}
          </button>

          {!sidebarCollapsed && (
            <div className="mt-6">
              <div className="flex items-center gap-2 text-white/60 mb-2 text-sm">
                <ISearch size={16} />
                Search chats
              </div>
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Type a keyword..."
                className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm text-white/90 placeholder:text-white/35 outline-none focus:ring-2 focus:ring-blue-500/30"
              />
            </div>
          )}

          {!sidebarCollapsed && (
            <div className="mt-6">
              <div className="text-xs uppercase tracking-wider text-white/40 mb-2">Model</div>
              <div className="flex gap-2">
                <button
                  onClick={() => setTier("lite")}
                  className={`flex-1 rounded-xl border px-3 py-2 text-xs transition ${
                    tier === "lite" ? "border-blue-400/30 bg-blue-500/10 text-white/90" : "border-white/10 bg-white/5 text-white/70 hover:bg-white/10"
                  }`}
                >
                  {MODEL_LABEL.lite}
                </button>
                <button
                  onClick={() => setTier("pro")}
                  className={`flex-1 rounded-xl border px-3 py-2 text-xs transition ${
                    tier === "pro" ? "border-blue-400/30 bg-blue-500/10 text-white/90" : "border-white/10 bg-white/5 text-white/70 hover:bg-white/10"
                  }`}
                  title="UI only (locked)"
                >
                  Pro
                </button>
              </div>
            </div>
          )}

          {!sidebarCollapsed && (
            <div className="mt-8 mb-3 text-xs uppercase tracking-wider text-white/40">Your chats</div>
          )}

          {!sidebarCollapsed && (
            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {visibleChats.map((chat) => {
                const isActive = chat.id === activeChatId;
                return (
                  <button
                    key={chat.id}
                    onClick={() => selectChat(chat.id)}
                    className={`w-full text-left px-3 py-2 rounded-xl border transition truncate ${
                      isActive
                        ? "bg-blue-500/10 border-blue-400/20 shadow-sm shadow-blue-500/10"
                        : "bg-white/0 border-transparent hover:bg-white/5 hover:border-white/10"
                    }`}
                    title={chat.title}
                  >
                    {chat.title}
                  </button>
                );
              })}
            </div>
          )}

          <button
            onClick={() => fileInputRef.current?.click()}
            className={`mt-5 rounded-2xl border border-white/10 bg-white/5 text-white/70 hover:bg-white/10 transition ${
              sidebarCollapsed ? "h-12 w-12 mx-auto flex items-center justify-center" : "px-4 py-2 text-sm"
            }`}
            title="Upload (stub)"
          >
            {sidebarCollapsed ? "＋" : "Upload (stub)"}
          </button>
        </aside>

        {/* Mobile Sidebar */}
        {mobileSidebarOpen && (
          <div className="fixed inset-0 z-[200] md:hidden">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setMobileSidebarOpen(false)} />
            <div className="absolute left-0 top-0 h-full w-[85%] max-w-[320px] border-r border-white/10 bg-[#0b1220]/95 backdrop-blur-2xl p-5 flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-white/5 border border-white/10 overflow-hidden">
                    <img src="/logo.png" alt="KinderAI" className="w-full h-full object-contain" />
                  </div>
                  <div className="text-sm font-semibold text-white/90">KinderAI</div>
                </div>

                <button
                  onClick={() => setMobileSidebarOpen(false)}
                  className="h-9 w-9 rounded-xl border border-white/10 bg-white/5 flex items-center justify-center text-white/70 hover:bg-white/10 transition"
                  aria-label="Close sidebar"
                >
                  <IX size={16} />
                </button>
              </div>

              <button
                onClick={createNewChat}
                className="flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 to-blue-500 shadow-lg shadow-blue-600/20 hover:shadow-blue-500/25 transition px-4 py-2"
              >
                <IPlus size={18} />
                New Chat
              </button>

              <div className="mt-6">
                <div className="flex items-center gap-2 text-white/60 mb-2 text-sm">
                  <ISearch size={16} />
                  Search chats
                </div>
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Type a keyword..."
                  className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm text-white/90 placeholder:text-white/35 outline-none"
                />
              </div>

              <div className="mt-6">
                <div className="text-xs uppercase tracking-wider text-white/40 mb-2">Model</div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setTier("lite")}
                    className={`flex-1 rounded-xl border px-3 py-2 text-xs transition ${
                      tier === "lite" ? "border-blue-400/30 bg-blue-500/10 text-white/90" : "border-white/10 bg-white/5 text-white/70"
                    }`}
                  >
                    Lite
                  </button>
                  <button
                    onClick={() => setTier("pro")}
                    className={`flex-1 rounded-xl border px-3 py-2 text-xs transition ${
                      tier === "pro" ? "border-blue-400/30 bg-blue-500/10 text-white/90" : "border-white/10 bg-white/5 text-white/70"
                    }`}
                    title="UI only (locked)"
                  >
                    Pro
                  </button>
                </div>
              </div>

              <div className="mt-8 mb-3 text-xs uppercase tracking-wider text-white/40">Your chats</div>
              <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                {visibleChats.map((chat) => {
                  const isActive = chat.id === activeChatId;
                  return (
                    <button
                      key={chat.id}
                      onClick={() => selectChat(chat.id)}
                      className={`w-full text-left px-3 py-2 rounded-xl border transition truncate ${
                        isActive
                          ? "bg-blue-500/10 border-blue-400/20 shadow-sm shadow-blue-500/10"
                          : "bg-white/0 border-transparent hover:bg-white/5 hover:border-white/10"
                      }`}
                      title={chat.title}
                    >
                      {chat.title}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Main */}
        <main className="flex-1 flex flex-col items-center px-3 sm:px-6 py-5 sm:py-10">
          <div className="w-full max-w-4xl flex-1">
            <div className="h-full rounded-3xl border border-white/10 bg-white/[0.04] backdrop-blur-2xl shadow-[0_0_60px_rgba(0,0,0,0.55)] overflow-hidden flex flex-col">
              {/* Header */}
              <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-white/5">
                <div className="flex items-center gap-3 min-w-0">
                  <button
                    className="md:hidden h-9 w-9 rounded-xl border border-white/10 bg-white/5 flex items-center justify-center text-white/70 hover:bg-white/10 transition"
                    onClick={() => setMobileSidebarOpen(true)}
                    aria-label="Open sidebar"
                  >
                    <IMenu size={18} />
                  </button>

                  <div className="text-xs sm:text-sm font-semibold text-white/85">
                    {tier === "lite" ? MODEL_LABEL.lite : MODEL_LABEL.pro}
                  </div>
                </div>

                <div className="text-xs text-white/35 hidden sm:block truncate max-w-[50%]">
                  {activeChat?.messages.length ? activeChat.title : "KinderAI"}
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 p-4 sm:p-6 overflow-y-auto">
                {activeChat && activeChat.messages.length === 0 && (
                  <div className="h-full flex items-center justify-center">
                    <div className="max-w-md text-center">
                      <div className="mx-auto mb-4 h-14 w-14 rounded-3xl bg-white/5 border border-white/10 overflow-hidden shadow-lg shadow-blue-500/10">
                        <img src="/logo.png" alt="KinderAI" className="h-full w-full object-contain" />
                      </div>

                      <h1 className="text-2xl font-semibold text-white/90">KinderAI</h1>
                      <p className="mt-2 text-sm text-white/50">
                        Tell me what’s happening. I’ll help you step by step.
                      </p>

                      <div className="mt-5 flex flex-wrap justify-center gap-2">
                        {["[MODE:GROUND] Calm down", "Get clarity", "Make a plan", "[MODE:PAUSE] Rewrite a message"].map(
                          (t) => (
                            <button
                              key={t}
                              onClick={() => setInput(t)}
                              className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white/70 hover:bg-white/10 transition"
                            >
                              {cleanQuickReplyLabel(t)}
                            </button>
                          )
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {activeChat?.messages.map((msg) => (
                  <div key={msg.id} className="mb-4">
                    <div className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                      <div
                        className={`max-w-[90%] sm:max-w-[78%] rounded-2xl px-4 py-3 whitespace-pre-wrap border shadow-sm ${
                          msg.role === "user"
                            ? "bg-gradient-to-br from-blue-600/30 to-blue-500/10 border-blue-400/20 text-white/90 shadow-blue-500/10"
                            : "bg-white/[0.055] border-white/10 text-white/85"
                        }`}
                      >
                        {msg.content}
                      </div>
                    </div>

                    {msg.role === "assistant" && msg.statusLine && (
                      <div className="mt-1 ml-2 text-[11px] text-white/35">{msg.statusLine}</div>
                    )}

                    {msg.role === "assistant" && msg.quickReplies && msg.quickReplies.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {msg.quickReplies.map((qr) => (
                          <button
                            key={`${msg.id}-${qr}`}
                            onClick={() => {
                              if (!activeChat) return;
                              hideQuickRepliesForMessage(activeChat.id, msg.id);
                              sendMessage(qr);
                            }}
                            className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/70 hover:bg-white/10 transition"
                          >
                            {cleanQuickReplyLabel(qr)}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ))}

                {loading && <div className="text-white/45 text-sm">Thinking…</div>}
                <div ref={messagesEndRef} />
              </div>
            </div>
          </div>

          {/* Composer */}
          {activeChat && (
            <div className="w-full max-w-4xl mt-4 sm:mt-5">
              <div className="rounded-2xl border border-white/10 bg-[#0b1220]/70 backdrop-blur-xl p-2 focus-within:ring-2 focus-within:ring-blue-500/40 focus-within:border-blue-400/30 transition-all duration-200 shadow-[0_10px_40px_rgba(0,0,0,0.45)]">
                <div className="flex items-end gap-2">
                  <textarea
                    className="min-h-[56px] flex-1 resize-none bg-transparent px-3 py-3 text-white/90 placeholder:text-white/35 outline-none"
                    rows={2}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        sendMessage(input);
                      }
                    }}
                    placeholder="Write a message…"
                  />

                  <button
                    onClick={() => sendMessage(input)}
                    disabled={loading || !input.trim()}
                    className={`h-11 w-11 rounded-full flex items-center justify-center transition-all duration-200 ${
                      input.trim() ? "bg-white/10 text-white hover:bg-white/15" : "bg-white/5 text-white/30"
                    }`}
                    aria-label="Send"
                    title="Send"
                  >
                    <ISend size={18} />
                  </button>
                </div>

                <div className="mt-2 flex flex-wrap gap-2 px-1 pb-1">
                  {["[MODE:GROUND] Calm down", "Get clarity", "Make a plan", "[MODE:PAUSE] Rewrite kindly"].map((t) => (
                    <button
                      key={t}
                      onClick={() => setInput((prev) => (prev ? prev + " " + t : t))}
                      className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/65 hover:bg-white/10 transition"
                    >
                      {cleanQuickReplyLabel(t)}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </main>

        <input type="file" accept="image/*" ref={fileInputRef} className="hidden" onChange={handleImageUpload} />
      </div>
    </div>
  );
}