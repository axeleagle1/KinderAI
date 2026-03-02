"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Plus,
  Search,
  Image as ImageIcon,
  Grid,
  MoreHorizontal,
  Share2,
  Users,
  Pencil,
  Pin,
  Archive,
  Trash2,
  X,
  SendHorizontal,
  PanelLeft,
  Menu,
  Check,
  Lock,
  Sparkles,
  ChevronRight,
  ChevronDown,
} from "lucide-react";

type Tier = "lite" | "pro";

const MODEL_LABEL: Record<Tier, string> = {
  lite: "KinderAI Lite 3.6",
  pro: "KinderAI Pro 4.1",
};

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  image?: string; // stored, but not rendered
  quickReplies?: string[];
  statusLine?: string;
};

type Chat = {
  id: string;
  title: string;
  messages: Message[];
};

const LS_CHATS = "kinderai-chats";
const LS_TIER = "kinderai-tier";

const newId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

const makeTitle = (text: string) => {
  const cleaned = text
    .replace(/\s+/g, " ")
    .replace(/[^\w\s.,!?'"-]/g, "")
    .trim();

  if (!cleaned) return "Untitled";
  if (cleaned.length <= 42) return cleaned;

  const cut = cleaned.slice(0, 42);
  const words = cut.split(" ");
  if (words.length <= 1) return cut + "…";
  return words.slice(0, -1).join(" ") + "…";
};

const clamp = (n: number, min: number, max: number) =>
  Math.max(min, Math.min(max, n));

const cleanQuickReplyLabel = (t: string) =>
  t.replace(/^\[MODE:[A-Z]+\]\s*/i, "");

const pickStatusLine = () => {
  const options = [
    "Ready when you are.",
    "No rush. Take your time.",
    "We can keep it simple.",
    "One step at a time.",
  ];
  return options[Math.floor(Math.random() * options.length)];
};

// Hover glow for clickable things
const INTERACTIVE_GLOW =
  "transition-all duration-300 ease-out hover:text-white hover:drop-shadow-[0_0_10px_rgba(59,130,246,0.35)]";

export default function ChatClient() {
  const [chats, setChats] = useState<Chat[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);

  // Model UI
  const [tier, setTier] = useState<Tier>("lite");
  const [modelMenuOpen, setModelMenuOpen] = useState(false); // desktop
  const [modelSheetOpen, setModelSheetOpen] = useState(false); // mobile
  const [upgradeOpen, setUpgradeOpen] = useState(false);

  // Chat UI
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [showApps, setShowApps] = useState(false);

  // Sidebar
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  // Collapsible "Your chats"
  const [chatsExpanded, setChatsExpanded] = useState(true);

  // Menus (chat options)
  const [openMenuFor, setOpenMenuFor] = useState<string | null>(null);
  const [mobileMenu, setMobileMenu] = useState<null | {
    chatId: string;
    top: number;
    left: number;
    openUp: boolean;
  }>(null);

  // Modals
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [renameTargetId, setRenameTargetId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const modelMenuRef = useRef<HTMLDivElement>(null);

  const activeChat = useMemo(
    () => chats.find((c) => c.id === activeChatId),
    [chats, activeChatId]
  );

  const closeAllChatMenus = () => {
    setOpenMenuFor(null);
    setMobileMenu(null);
  };

  // Close chat menus when clicking outside
  useEffect(() => {
    const close = () => closeAllChatMenus();
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, []);

  // Close mobile chat menu on scroll/resize
  useEffect(() => {
    const close = () => setMobileMenu(null);
    window.addEventListener("resize", close);
    window.addEventListener("scroll", close, true);
    return () => {
      window.removeEventListener("resize", close);
      window.removeEventListener("scroll", close, true);
    };
  }, []);

  // Close model menu on outside click + ESC
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!modelMenuRef.current) return;
      if (!modelMenuRef.current.contains(e.target as Node)) {
        setModelMenuOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setModelMenuOpen(false);
        setModelSheetOpen(false);
        setUpgradeOpen(false);
      }
    };

    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  // Load tier
  useEffect(() => {
    const savedTier = localStorage.getItem(LS_TIER) as Tier | null;
    if (savedTier === "lite" || savedTier === "pro") setTier(savedTier);
  }, []);

  // Save tier
  useEffect(() => {
    localStorage.setItem(LS_TIER, tier);
  }, [tier]);

  // Load chats (always ensure one exists)
  useEffect(() => {
    const saved = localStorage.getItem(LS_CHATS);
    if (saved) {
      try {
        const parsed: Chat[] = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setChats(parsed);
          setActiveChatId(parsed[0].id);
          return;
        }
      } catch {
        // ignore
      }
    }
    const firstChat: Chat = {
      id: newId(),
      title: "Untitled",
      messages: [],
    };
    setChats([firstChat]);
    setActiveChatId(firstChat.id);
  }, []);

  // Save chats
  useEffect(() => {
    localStorage.setItem(LS_CHATS, JSON.stringify(chats));
  }, [chats]);

  // Auto scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeChat?.messages, loading]);

  const createNewChat = () => {
    const newChat: Chat = { id: newId(), title: "Untitled", messages: [] };
    setChats((prev) => [newChat, ...prev]);
    setActiveChatId(newChat.id);
    closeAllChatMenus();
    setMobileSidebarOpen(false);
    setInput("");
  };

  const hideQuickRepliesForMessage = (chatId: string, messageId: string) => {
    setChats((prev) =>
      prev.map((c) => {
        if (c.id !== chatId) return c;
        return {
          ...c,
          messages: c.messages.map((m) =>
            m.id === messageId ? { ...m, quickReplies: [] } : m
          ),
        };
      })
    );
  };

  const sendMessage = async (text: string) => {
    if (!activeChat || loading) return;
    const messageToSend = (text ?? "").trim();
    if (!messageToSend) return;

    const userMessage: Message = {
      id: newId(),
      role: "user",
      content: messageToSend,
    };

    setChats((prev) =>
      prev.map((chat) =>
        chat.id === activeChat.id
          ? {
              ...chat,
              title:
                chat.messages.length === 0
                  ? makeTitle(messageToSend)
                  : chat.title,
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
        quickReplies: Array.isArray(data?.quickReplies)
          ? data.quickReplies
          : [],
        statusLine: pickStatusLine(),
      };

      setChats((prev) =>
        prev.map((chat) =>
          chat.id === activeChat.id
            ? { ...chat, messages: [...chat.messages, aiMessage] }
            : chat
        )
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
        prev.map((chat) =>
          chat.id === activeChat.id
            ? { ...chat, messages: [...chat.messages, aiMessage] }
            : chat
        )
      );
    } finally {
      setLoading(false);
    }
  };

  const sendText = async () => {
    await sendMessage(input);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeChat) return;

    const reader = new FileReader();
    reader.onload = () => {
      const imageMessage: Message = {
        id: newId(),
        role: "user",
        content: `📎 ${file.name}`,
        image: reader.result as string,
      };

      setChats((prev) =>
        prev.map((chat) =>
          chat.id === activeChat.id
            ? { ...chat, messages: [...chat.messages, imageMessage] }
            : chat
        )
      );
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const requestRenameChat = (chatId: string) => {
    const current = chats.find((c) => c.id === chatId)?.title ?? "Untitled";
    setRenameTargetId(chatId);
    setRenameValue(current);
  };

  const confirmRenameChat = () => {
    if (!renameTargetId) return;
    const next = renameValue.trim();
    if (!next) return;
    setChats((prev) =>
      prev.map((c) => (c.id === renameTargetId ? { ...c, title: next } : c))
    );
    setRenameTargetId(null);
  };

  const requestDeleteChat = (chatId: string) => setDeleteTargetId(chatId);

  const confirmDeleteChat = () => {
    if (!deleteTargetId) return;

    const remaining = chats.filter((c) => c.id !== deleteTargetId);
    const nextChats =
      remaining.length > 0
        ? remaining
        : [{ id: newId(), title: "Untitled", messages: [] }];

    setChats(nextChats);

    if (activeChatId === deleteTargetId) {
      setActiveChatId(nextChats[0].id);
    }

    setDeleteTargetId(null);
  };

  const filteredChats = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return chats;
    return chats.filter(
      (chat) =>
        chat.title.toLowerCase().includes(q) ||
        chat.messages.some((msg) =>
          (msg.content ?? "").toLowerCase().includes(q)
        )
    );
  }, [chats, searchQuery]);

  const visibleChats = useMemo(() => {
    const base = searchQuery ? filteredChats : chats;
    return base.filter((c) => c.messages.length > 0);
  }, [chats, filteredChats, searchQuery]);

  const selectChat = (id: string) => {
    setActiveChatId(id);
    setMobileSidebarOpen(false);
  };

  const openMobileMenu = (chatId: string, buttonEl: HTMLElement) => {
    const rect = buttonEl.getBoundingClientRect();
    const MENU_W = 224;
    const MENU_H = 310;
    const PAD = 10;
    const openUp = rect.bottom + MENU_H + PAD > window.innerHeight;

    const left = clamp(
      rect.right - MENU_W,
      PAD,
      window.innerWidth - MENU_W - PAD
    );
    const top = openUp ? rect.top - MENU_H - 8 : rect.bottom + 8;

    setMobileMenu({
      chatId,
      left,
      top: clamp(top, PAD, window.innerHeight - MENU_H - PAD),
      openUp,
    });
  };

  const SidebarContent = ({ isMobile }: { isMobile?: boolean }) => (
    <>
      {isMobile ? (
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/5 border border-white/10 overflow-hidden">
              <img
                src="/logo.png"
                alt="KinderAI"
                className="w-full h-full object-contain"
              />
            </div>
            <div className="text-sm font-semibold text-white/90">KinderAI</div>
          </div>

          <button
            onClick={() => setMobileSidebarOpen(false)}
            className={`h-9 w-9 rounded-xl border border-white/10 bg-white/5 flex items-center justify-center text-white/70 hover:bg-white/10 ${INTERACTIVE_GLOW}`}
            aria-label="Close sidebar"
          >
            <X size={16} />
          </button>
        </div>
      ) : sidebarCollapsed ? (
        <div className="flex items-center justify-center mb-3">
          <button
            onClick={() => setSidebarCollapsed(false)}
            className={`h-10 w-10 rounded-xl border border-white/10 bg-white/5 flex items-center justify-center text-white/70 hover:bg-white/10 ${INTERACTIVE_GLOW}`}
            title="Expand sidebar"
          >
            <PanelLeft size={16} />
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-3 mb-6">
          <div className="w-11 h-11 flex items-center justify-center rounded-2xl bg-white/5 border border-white/10 shadow-lg overflow-hidden">
            <img
              src="/logo.png"
              alt="KinderAI Logo"
              className="w-full h-full object-contain"
            />
          </div>

          <div>
            <h2 className="text-lg font-semibold text-white/90 leading-tight">
              KinderAI
            </h2>
          </div>

          <button
            onClick={() => setSidebarCollapsed(true)}
            className={`ml-auto h-9 w-9 rounded-xl border border-white/10 bg-white/5 flex items-center justify-center text-white/70 hover:bg-white/10 ${INTERACTIVE_GLOW}`}
            title="Collapse sidebar"
          >
            <PanelLeft size={16} />
          </button>
        </div>
      )}

      <button
        onClick={createNewChat}
        className={`flex items-center justify-center gap-2 rounded-2xl bg-linear-to-r from-blue-600 to-blue-500 shadow-lg shadow-blue-600/20 hover:shadow-blue-500/25 hover:brightness-[1.03] transition ${
          !isMobile && sidebarCollapsed ? "h-12 w-12 mx-auto" : "px-4 py-2"
        }`}
        title="New chat"
      >
        <Plus size={18} />
        {(isMobile || (!isMobile && !sidebarCollapsed)) && "New Chat"}
      </button>

      {(isMobile || (!isMobile && !sidebarCollapsed)) && (
        <div className="mt-6">
          <div className="flex items-center gap-2 text-white/60 mb-2 text-sm">
            <Search size={16} />
            Search chats
          </div>
          <input
            type="text"
            placeholder="Type a keyword..."
            className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm text-white/90 placeholder:text-white/35 outline-none focus:ring-2 focus:ring-blue-500/30"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      )}

      {isMobile || (!isMobile && !sidebarCollapsed) ? (
        <div className="mt-6 flex gap-3 text-sm">
          <button
            onClick={() => fileInputRef.current?.click()}
            className={`flex flex-1 items-center justify-center gap-2 rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-white/70 hover:bg-white/10 ${INTERACTIVE_GLOW}`}
          >
            <ImageIcon size={16} />
            Images
          </button>

          <button
            onClick={() => setShowApps(true)}
            className={`flex flex-1 items-center justify-center gap-2 rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-white/70 hover:bg-white/10 ${INTERACTIVE_GLOW}`}
          >
            <Grid size={16} />
            Apps
          </button>
        </div>
      ) : (
        <div className="mt-5 flex flex-col items-center gap-4">
          <button
            onClick={() => fileInputRef.current?.click()}
            className={`h-12 w-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-white/70 hover:bg-white/10 ${INTERACTIVE_GLOW}`}
            title="Images"
          >
            <ImageIcon size={20} />
          </button>

          <button
            onClick={() => setShowApps(true)}
            className={`h-12 w-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-white/70 hover:bg-white/10 ${INTERACTIVE_GLOW}`}
            title="Apps"
          >
            <Grid size={20} />
          </button>
        </div>
      )}

      {(isMobile || (!isMobile && !sidebarCollapsed)) && (
        <div className="mt-8 mb-3 flex items-center justify-between text-xs uppercase tracking-wider text-white/40">
          <span>Your chats</span>

          {/* Arrow only glows */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setChatsExpanded((v) => !v);
            }}
            className="group flex items-center justify-center"
            aria-label={chatsExpanded ? "Collapse chats" : "Expand chats"}
            title={chatsExpanded ? "Collapse chats" : "Expand chats"}
          >
            <span className="inline-flex items-center justify-center text-white/40 transition-all duration-300 ease-out group-hover:text-blue-400 group-hover:drop-shadow-[0_0_8px_rgba(59,130,246,0.9)] group-hover:translate-x-1">
              {chatsExpanded ? (
                <ChevronDown size={16} />
              ) : (
                <ChevronRight size={16} />
              )}
            </span>
          </button>
        </div>
      )}

      {(isMobile || (!isMobile && !sidebarCollapsed)) && chatsExpanded && (
        <div className="flex-1 overflow-y-auto space-y-2 pr-1">
          {visibleChats.map((chat) => {
            const isActive = chat.id === activeChatId;
            const desktopMenuOpen = !isMobile && openMenuFor === chat.id;
            const mobileMenuOpen = !!isMobile && mobileMenu?.chatId === chat.id;

            return (
              <div
                key={chat.id}
                className={`group relative flex items-center rounded-xl border transition ${
                  isActive
                    ? "bg-blue-500/10 border-blue-400/20 shadow-sm shadow-blue-500/10"
                    : "bg-white/0 border-transparent hover:bg-white/5 hover:border-white/10"
                }`}
              >
                <button
                  onClick={() => selectChat(chat.id)}
                  className={`flex-1 text-left px-3 py-2 text-sm truncate ${INTERACTIVE_GLOW}`}
                  title={chat.title}
                >
                  {chat.title}
                </button>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (isMobile) {
                      const el = e.currentTarget as HTMLElement;
                      if (mobileMenu?.chatId === chat.id) setMobileMenu(null);
                      else openMobileMenu(chat.id, el);
                    } else {
                      setOpenMenuFor((prev) =>
                        prev === chat.id ? null : chat.id
                      );
                    }
                  }}
                  className={`mr-2 h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-white/70 hover:bg-white/10 transition ${
                    isMobile ? "flex" : "hidden group-hover:flex"
                  }`}
                  aria-label="Chat options"
                  title="Options"
                >
                  <MoreHorizontal size={16} />
                </button>

                {desktopMenuOpen && (
                  <div
                    onClick={(e) => e.stopPropagation()}
                    className="absolute right-2 top-11 z-50 w-56 rounded-xl border border-white/10 bg-[#0b1220]/95 backdrop-blur-xl shadow-2xl overflow-hidden"
                  >
                    <button
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-white/80 hover:bg-white/5"
                      onClick={() => {
                        closeAllChatMenus();
                        alert("Share (coming soon)");
                      }}
                    >
                      <Share2 size={16} />
                      Share
                    </button>

                    <button
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-white/80 hover:bg-white/5"
                      onClick={() => {
                        closeAllChatMenus();
                        alert("Start a group chat (coming soon)");
                      }}
                    >
                      <Users size={16} />
                      Start a group chat
                    </button>

                    <button
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-white/80 hover:bg-white/5"
                      onClick={() => {
                        closeAllChatMenus();
                        requestRenameChat(chat.id);
                      }}
                    >
                      <Pencil size={16} />
                      Rename
                    </button>

                    <div className="h-px bg-white/10 my-1" />

                    <button
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-white/80 hover:bg-white/5"
                      onClick={() => {
                        closeAllChatMenus();
                        alert("Pin chat (coming soon)");
                      }}
                    >
                      <Pin size={16} />
                      Pin chat
                    </button>

                    <button
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-white/80 hover:bg-white/5"
                      onClick={() => {
                        closeAllChatMenus();
                        alert("Archive (coming soon)");
                      }}
                    >
                      <Archive size={16} />
                      Archive
                    </button>

                    <button
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-red-500/10"
                      onClick={() => {
                        closeAllChatMenus();
                        setTimeout(() => requestDeleteChat(chat.id), 120);
                      }}
                    >
                      <Trash2 size={16} />
                      Delete
                    </button>
                  </div>
                )}

                {mobileMenuOpen && mobileMenu && (
                  <div
                    onClick={(e) => e.stopPropagation()}
                    style={{ top: mobileMenu.top, left: mobileMenu.left }}
                    className="fixed z-50 w-56 rounded-xl border border-white/10 bg-[#0b1220]/95 backdrop-blur-xl shadow-2xl overflow-hidden"
                  >
                    <button
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-white/80 hover:bg-white/5"
                      onClick={() => {
                        closeAllChatMenus();
                        alert("Share (coming soon)");
                      }}
                    >
                      <Share2 size={16} />
                      Share
                    </button>

                    <button
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-white/80 hover:bg-white/5"
                      onClick={() => {
                        closeAllChatMenus();
                        alert("Start a group chat (coming soon)");
                      }}
                    >
                      <Users size={16} />
                      Start a group chat
                    </button>

                    <button
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-white/80 hover:bg-white/5"
                      onClick={() => {
                        closeAllChatMenus();
                        requestRenameChat(chat.id);
                      }}
                    >
                      <Pencil size={16} />
                      Rename
                    </button>

                    <div className="h-px bg-white/10 my-1" />

                    <button
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-white/80 hover:bg-white/5"
                      onClick={() => {
                        closeAllChatMenus();
                        alert("Pin chat (coming soon)");
                      }}
                    >
                      <Pin size={16} />
                      Pin chat
                    </button>

                    <button
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-white/80 hover:bg-white/5"
                      onClick={() => {
                        closeAllChatMenus();
                        alert("Archive (coming soon)");
                      }}
                    >
                      <Archive size={16} />
                      Archive
                    </button>

                    <button
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-red-500/10"
                      onClick={() => {
                        closeAllChatMenus();
                        setTimeout(() => requestDeleteChat(chat.id), 120);
                      }}
                    >
                      <Trash2 size={16} />
                      Delete
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </>
  );

  return (
    <div className="min-h-screen text-white">
      {/* Background */}
      <div className="fixed inset-0 -z-10 bg-[#020617]" />
      <div className="fixed inset-0 -z-10 bg-[radial-gradient(900px_circle_at_50%_0%,rgba(59,130,246,0.18),transparent_55%),radial-gradient(700px_circle_at_80%_20%,rgba(236,72,153,0.12),transparent_55%),radial-gradient(900px_circle_at_20%_80%,rgba(34,197,94,0.08),transparent_55%)]" />

      <div className="flex min-h-screen">
        {/* Desktop sidebar */}
        <aside
          className={`hidden md:flex border-r border-white/5 bg-white/3 backdrop-blur-2xl flex-col transition-all duration-200 ${
            sidebarCollapsed ? "w-20 p-4" : "w-72 p-6"
          }`}
        >
          <SidebarContent />
        </aside>

        {/* Mobile drawer sidebar */}
        {mobileSidebarOpen && (
          <div className="fixed inset-0 z-50 md:hidden">
            <div
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setMobileSidebarOpen(false)}
            />
            <div className="absolute left-0 top-0 h-full w-[85%] max-w-[320px] border-r border-white/10 bg-[#0b1220]/95 backdrop-blur-2xl p-5 flex flex-col">
              <SidebarContent isMobile />
            </div>
          </div>
        )}

        {/* Main */}
        <main className="flex-1 flex flex-col items-center px-3 sm:px-6 py-5 sm:py-10">
          <div className="w-full max-w-4xl flex-1">
            <div className="h-full rounded-3xl border border-white/10 bg-white/4 backdrop-blur-2xl shadow-[0_0_60px_rgba(0,0,0,0.55)] overflow-hidden flex flex-col">
              {/* Top bar */}
              <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-white/5">
                <div className="flex items-center gap-3 min-w-0">
                  <button
                    className={`md:hidden h-9 w-9 rounded-xl border border-white/10 bg-white/5 flex items-center justify-center text-white/70 hover:bg-white/10 ${INTERACTIVE_GLOW}`}
                    onClick={() => setMobileSidebarOpen(true)}
                    aria-label="Open sidebar"
                    title="Menu"
                  >
                    <Menu size={18} />
                  </button>

                  {/* Model selector */}
                  <div className="relative" ref={modelMenuRef}>
                    <button
                      type="button"
                      onClick={() => setModelMenuOpen((v) => !v)}
                      className={`hidden md:flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/85 hover:bg-white/10 ${INTERACTIVE_GLOW}`}
                      aria-label="Select model"
                      title="Select model"
                    >
                      <span className="font-semibold">{MODEL_LABEL[tier]}</span>
                      <span className="text-white/50">▾</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setModelSheetOpen(true)}
                      className={`md:hidden flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/85 hover:bg-white/10 ${INTERACTIVE_GLOW}`}
                      aria-label="Select model"
                      title="Select model"
                    >
                      <span className="font-semibold">{MODEL_LABEL[tier]}</span>
                      <span className="text-white/50">▾</span>
                    </button>

                    {modelMenuOpen && (
                      <div
                        onClick={(e) => e.stopPropagation()}
                        className="hidden md:block absolute left-0 top-10 z-50 w-75 rounded-2xl border border-white/10 bg-[#0b1220]/95 backdrop-blur-xl shadow-2xl overflow-hidden"
                      >
                        <div className="px-3 py-2 text-[11px] uppercase tracking-wider text-white/40">
                          Model
                        </div>

                        <button
                          className="w-full flex items-center justify-between px-3 py-3 text-sm text-white/85 hover:bg-white/5 transition"
                          onClick={() => {
                            setTier("lite");
                            setModelMenuOpen(false);
                          }}
                        >
                          <div className="flex flex-col items-start">
                            <span className="font-semibold">{MODEL_LABEL.lite}</span>
                            <span className="text-xs text-white/45">
                              Free • Calm-first replies
                            </span>
                          </div>
                          {tier === "lite" && (
                            <Check size={16} className="text-white/70" />
                          )}
                        </button>

                        <button
                          className="w-full flex items-center justify-between px-3 py-3 text-sm text-white/75 hover:bg-white/5 transition"
                          onClick={() => {
                            setModelMenuOpen(false);
                            setUpgradeOpen(true);
                          }}
                        >
                          <div className="flex flex-col items-start">
                            <span className="font-semibold">{MODEL_LABEL.pro}</span>
                            <span className="text-xs text-white/45">
                              Locked • Smarter, more contextual
                            </span>
                          </div>
                          <Lock size={16} className="text-white/45" />
                        </button>

                        <div className="h-px bg-white/10" />

                        <button
                          className="w-full px-3 py-3 text-sm text-white/90 hover:bg-white/5 transition flex items-center gap-2"
                          onClick={() => {
                            setModelMenuOpen(false);
                            setUpgradeOpen(true);
                          }}
                        >
                          <Sparkles size={16} className="text-white/80" />
                          Upgrade to Pro
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                <div className="text-xs text-white/35 hidden sm:block truncate max-w-[55%]">
                  {activeChat?.messages.length ? activeChat.title : "KinderAI"}
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 p-4 sm:p-6 overflow-y-auto">
                {activeChat && activeChat.messages.length === 0 && (
                  <div className="h-full flex items-center justify-center">
                    <div className="max-w-lg text-center">
                      <h1 className="text-3xl sm:text-4xl font-semibold text-white/90">
                        How are you today?
                      </h1>
                      <p className="mt-2 text-sm sm:text-base text-white/50">
                        KinderAI helps you move from emotion → clarity → action.
                      </p>

                      <div className="mt-6 flex flex-wrap justify-center gap-2">
                        {[
                          "[MODE:GROUND] Calm down",
                          "Get clarity",
                          "Make a plan",
                          "[MODE:PAUSE] Rewrite a message",
                        ].map((t) => (
                          <button
                            key={t}
                            onClick={() => setInput(t)}
                            className={`rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white/70 hover:bg-white/10 ${INTERACTIVE_GLOW}`}
                          >
                            {cleanQuickReplyLabel(t)}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {activeChat?.messages.map((msg) => (
                  <div key={msg.id} className="mb-4">
                    <div
                      className={`flex ${
                        msg.role === "user" ? "justify-end" : "justify-start"
                      }`}
                    >
                      <div
                        className={`max-w-[90%] sm:max-w-[78%] rounded-2xl px-4 py-3 whitespace-pre-wrap border shadow-sm ${
                          msg.role === "user"
                            ? "bg-linear-to-br from-blue-600/30 to-blue-500/10 border-blue-400/20 text-white/90 shadow-blue-500/10"
                            : "bg-white/5.5 border-white/10 text-white/85"
                        }`}
                      >
                        {msg.content}
                      </div>
                    </div>

                    {msg.role === "assistant" && msg.statusLine && (
                      <div className="mt-1 ml-2 text-[11px] text-white/35">
                        {msg.statusLine}
                      </div>
                    )}

                    {msg.role === "assistant" &&
                      msg.quickReplies &&
                      msg.quickReplies.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {msg.quickReplies.map((qr) => (
                            <button
                              key={`${msg.id}-${qr}`}
                              onClick={() => {
                                if (!activeChat) return;
                                hideQuickRepliesForMessage(activeChat.id, msg.id);
                                sendMessage(qr);
                              }}
                              className={`rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/70 hover:bg-white/10 ${INTERACTIVE_GLOW}`}
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
                    className="min-h-14 flex-1 resize-none bg-transparent px-3 py-3 text-white/90 placeholder:text-white/35 outline-none"
                    rows={2}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        sendText();
                      }
                    }}
                    placeholder="Write a message…"
                  />

                  <button
                    onClick={sendText}
                    disabled={loading || !input.trim()}
                    className={`h-11 w-11 rounded-full flex items-center justify-center transition-all duration-200 ${
                      input.trim()
                        ? "bg-white/10 text-white hover:bg-white/15"
                        : "bg-white/5 text-white/30"
                    }`}
                    aria-label="Send"
                    title="Send"
                  >
                    <SendHorizontal size={18} strokeWidth={2} />
                  </button>
                </div>

                <div className="mt-2 flex flex-wrap gap-2 px-1 pb-1">
                  {[
                    "[MODE:GROUND] Calm down",
                    "Get clarity",
                    "Make a plan",
                    "[MODE:PAUSE] Rewrite kindly",
                  ].map((t) => (
                    <button
                      key={t}
                      onClick={() => setInput((prev) => (prev ? prev + " " + t : t))}
                      className={`rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/65 hover:bg-white/10 ${INTERACTIVE_GLOW}`}
                    >
                      {cleanQuickReplyLabel(t)}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </main>

        <input
          type="file"
          accept="image/*"
          ref={fileInputRef}
          className="hidden"
          onChange={handleImageUpload}
        />

        {/* Apps Modal */}
        {showApps && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-md flex items-center justify-center p-4">
            <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0b1220]/90 p-6 shadow-2xl">
              <h3 className="text-lg font-semibold mb-2">Apps</h3>
              <p className="text-white/55 text-sm mb-5">Future tools will appear here.</p>
              <button
                onClick={() => setShowApps(false)}
                className="rounded-xl bg-blue-600 px-4 py-2 hover:bg-blue-500 transition"
              >
                Close
              </button>
            </div>
          </div>
        )}

        {/* Mobile model sheet */}
        {modelSheetOpen && (
          <div className="fixed inset-0 z-50 md:hidden">
            <div
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setModelSheetOpen(false)}
            />
            <div className="absolute bottom-0 left-0 right-0 rounded-t-3xl border-t border-white/10 bg-[#0b1220]/95 backdrop-blur-2xl p-4 shadow-2xl">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold text-white/90">Select model</div>
                <button
                  onClick={() => setModelSheetOpen(false)}
                  className={`h-9 w-9 rounded-xl border border-white/10 bg-white/5 flex items-center justify-center text-white/70 hover:bg-white/10 ${INTERACTIVE_GLOW}`}
                  aria-label="Close"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="mt-4 space-y-2">
                <button
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-left hover:bg-white/10 transition"
                  onClick={() => {
                    setTier("lite");
                    setModelSheetOpen(false);
                  }}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-semibold text-white/90">{MODEL_LABEL.lite}</div>
                      <div className="text-xs text-white/45 mt-0.5">Free • Calm-first replies</div>
                    </div>
                    {tier === "lite" && <div className="text-white/70">✓</div>}
                  </div>
                </button>

                <button
                  className="w-full rounded-2xl border border-white/10 bg-white/4 px-4 py-3 text-left hover:bg-white/10 transition"
                  onClick={() => {
                    setModelSheetOpen(false);
                    setUpgradeOpen(true);
                  }}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-semibold text-white/80">
                        {MODEL_LABEL.pro} <span className="text-white/40">• Locked</span>
                      </div>
                      <div className="text-xs text-white/45 mt-0.5">Smarter responses + more context</div>
                    </div>
                    <div className="text-white/45">🔒</div>
                  </div>
                </button>

                <button
                  className="w-full rounded-2xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-500 transition"
                  onClick={() => {
                    setModelSheetOpen(false);
                    setUpgradeOpen(true);
                  }}
                >
                  Upgrade to Pro
                </button>
              </div>

              <div className="mt-3 text-[11px] text-white/35">
                Lite is steady & safe. Pro adds smarter, more contextual replies.
              </div>
            </div>
          </div>
        )}

        {/* Upgrade modal */}
        {upgradeOpen && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-4"
            onClick={() => setUpgradeOpen(false)}
          >
            <div
              className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0b1220]/95 shadow-2xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-white/90 flex items-center gap-2">
                      <Sparkles size={18} className="text-white/80" />
                      Upgrade to Pro
                    </h3>
                    <p className="mt-2 text-sm text-white/55">
                      Unlock more accurate responses, better context, and less repetition.
                    </p>
                  </div>

                  <button
                    onClick={() => setUpgradeOpen(false)}
                    className={`h-9 w-9 rounded-xl border border-white/10 bg-white/5 flex items-center justify-center text-white/60 hover:bg-white/10 hover:text-white ${INTERACTIVE_GLOW}`}
                    aria-label="Close"
                  >
                    <X size={16} />
                  </button>
                </div>

                <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-4">
                  <div className="text-sm font-semibold text-white/85">{MODEL_LABEL.pro}</div>
                  <ul className="mt-2 text-sm text-white/60 space-y-1">
                    <li>• More contextual replies</li>
                    <li>• Better emotional accuracy</li>
                    <li>• Cleaner “what to do next” guidance</li>
                  </ul>
                </div>

                <div className="mt-3 text-xs text-white/35">
                  Payments aren’t enabled yet — this is UI-ready for later.
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 border-t border-white/10 px-6 py-4">
                <button
                  onClick={() => setUpgradeOpen(false)}
                  className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/80 hover:bg-white/10 transition"
                >
                  Close
                </button>
                <button
                  onClick={() => {
                    setUpgradeOpen(false);
                    alert("Upgrade flow coming soon.");
                  }}
                  className="rounded-full bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-500 transition"
                >
                  Continue
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Delete modal */}
        {deleteTargetId && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-4"
            onClick={() => setDeleteTargetId(null)}
          >
            <div
              className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0b1220]/95 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6">
                <div className="flex items-start justify-between">
                  <h3 className="text-lg font-semibold text-white/90">Delete chat?</h3>
                  <button
                    onClick={() => setDeleteTargetId(null)}
                    className={`h-9 w-9 rounded-xl border border-white/10 bg-white/5 flex items-center justify-center text-white/60 hover:bg-white/10 hover:text-white ${INTERACTIVE_GLOW}`}
                    aria-label="Close"
                  >
                    <X size={16} />
                  </button>
                </div>

                <p className="mt-3 text-sm text-white/60">
                  This will delete{" "}
                  <span className="font-semibold text-white/80">
                    {chats.find((c) => c.id === deleteTargetId)?.title ?? "this chat"}
                  </span>
                  .
                </p>
                <p className="mt-2 text-xs text-white/35">This action can’t be undone.</p>
              </div>

              <div className="flex items-center justify-end gap-3 border-t border-white/10 px-6 py-4">
                <button
                  onClick={() => setDeleteTargetId(null)}
                  className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/80 hover:bg-white/10 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDeleteChat}
                  className="rounded-full bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-500 transition"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Rename modal */}
        {renameTargetId && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-4"
            onClick={() => setRenameTargetId(null)}
          >
            <div
              className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0b1220]/95 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6">
                <div className="flex items-start justify-between">
                  <h3 className="text-lg font-semibold text-white/90">Rename chat</h3>
                  <button
                    onClick={() => setRenameTargetId(null)}
                    className={`h-9 w-9 rounded-xl border border-white/10 bg-white/5 flex items-center justify-center text-white/60 hover:bg-white/10 hover:text-white ${INTERACTIVE_GLOW}`}
                    aria-label="Close"
                  >
                    <X size={16} />
                  </button>
                </div>

                <div className="mt-4">
                  <label className="text-xs text-white/45">Chat name</label>
                  <input
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") confirmRenameChat();
                    }}
                    className="mt-2 w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm text-white/90 placeholder:text-white/35 outline-none focus:ring-2 focus:ring-blue-500/30"
                    placeholder="Untitled"
                    autoFocus
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 border-t border-white/10 px-6 py-4">
                <button
                  onClick={() => setRenameTargetId(null)}
                  className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/80 hover:bg-white/10 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmRenameChat}
                  className="rounded-full bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-500 transition"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}