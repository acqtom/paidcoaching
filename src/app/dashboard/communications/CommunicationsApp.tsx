"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Hash, MessageCircle, Plus, Send, Image as ImageIcon, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Conversation = {
  id: string;
  type: "channel" | "dm";
  name: string | null;
  dm_user_id: string | null;
  dmUsername?: string;
};

type Message = {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string | null;
  image_path: string | null;
  created_at: string;
  senderUsername: string;
};

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

// Matches is_admin() in 0009_communications.sql: admin status is just a
// one-letter username, nothing else.
function isAdminUsername(name: string) {
  return name.length === 1;
}

export function CommunicationsApp({
  userId,
  username,
  isAdmin,
}: {
  userId: string;
  username: string;
  isAdmin: boolean;
}) {
  const supabase = useMemo(() => createClient(), []);
  const usernameCache = useRef<Record<string, string>>({ [userId]: username });

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [conversationsLoaded, setConversationsLoaded] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  // Which conversation `messages` currently holds data for -- compared
  // against `activeId` to derive a loading flag, rather than a separate
  // piece of state set synchronously at the top of the load effect (which
  // React Compiler's set-state-in-effect rule flags).
  const [messagesConversationId, setMessagesConversationId] = useState<string | null>(null);
  const messagesLoading = activeId !== null && activeId !== messagesConversationId;

  const [composerText, setComposerText] = useState("");
  const [pendingImage, setPendingImage] = useState<File | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [showNewChannelForm, setShowNewChannelForm] = useState(false);
  const [newChannelName, setNewChannelName] = useState("");

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  async function resolveUsername(id: string): Promise<string> {
    if (usernameCache.current[id]) return usernameCache.current[id];
    const { data } = await supabase.from("profiles").select("username").eq("id", id).maybeSingle();
    const name = data?.username ?? "unknown";
    usernameCache.current[id] = name;
    return name;
  }

  // ---- Load the conversation list once on mount ----
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: channels } = await supabase
        .from("conversations")
        .select("id, type, name, dm_user_id, created_at")
        .eq("type", "channel")
        .order("created_at", { ascending: true });

      let dms: Conversation[] = [];
      if (isAdmin) {
        const { data } = await supabase
          .from("conversations")
          .select("id, type, name, dm_user_id, created_at, profiles!conversations_dm_user_id_fkey(username)")
          .eq("type", "dm")
          .order("created_at", { ascending: true });
        dms = (data ?? []).map((d) => {
          const joined = d.profiles as unknown as { username?: string } | null;
          if (joined?.username && d.dm_user_id) usernameCache.current[d.dm_user_id] = joined.username;
          return { id: d.id, type: "dm" as const, name: d.name, dm_user_id: d.dm_user_id, dmUsername: joined?.username };
        });
      } else {
        const { data } = await supabase
          .from("conversations")
          .select("id, type, name, dm_user_id, created_at")
          .eq("type", "dm")
          .eq("dm_user_id", userId)
          .maybeSingle();
        if (data) dms = [{ id: data.id, type: "dm", name: data.name, dm_user_id: data.dm_user_id }];
      }

      if (cancelled) return;
      const all = [...(channels ?? []), ...dms];
      setConversations(all);
      setConversationsLoaded(true);
      if (all.length) setActiveId(all[0].id);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- Live: new channels appearing for everyone as they're created ----
  useEffect(() => {
    const channel = supabase
      .channel("communications-channels")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "conversations", filter: "type=eq.channel" },
        (payload) => {
          const row = payload.new as Conversation;
          setConversations((prev) => (prev.some((c) => c.id === row.id) ? prev : [...prev, row]));
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- Load messages + subscribe live whenever the active conversation changes ----
  useEffect(() => {
    if (!activeId) return;
    let cancelled = false;

    (async () => {
      const { data } = await supabase
        .from("messages")
        .select("id, conversation_id, sender_id, body, image_path, created_at, profiles!messages_sender_id_fkey(username)")
        .eq("conversation_id", activeId)
        .order("created_at", { ascending: true })
        .limit(200);
      if (cancelled) return;
      const rows: Message[] = (data ?? []).map((m) => {
        const joined = m.profiles as unknown as { username?: string } | null;
        if (joined?.username) usernameCache.current[m.sender_id] = joined.username;
        return {
          id: m.id,
          conversation_id: m.conversation_id,
          sender_id: m.sender_id,
          body: m.body,
          image_path: m.image_path,
          created_at: m.created_at,
          senderUsername: joined?.username ?? usernameCache.current[m.sender_id] ?? "unknown",
        };
      });
      setMessages(rows);
      setMessagesConversationId(activeId);
    })();

    const channel = supabase
      .channel(`messages:${activeId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${activeId}` },
        async (payload) => {
          const row = payload.new as Omit<Message, "senderUsername">;
          const senderUsername = await resolveUsername(row.sender_id);
          setMessages((prev) => (prev.some((m) => m.id === row.id) ? prev : [...prev, { ...row, senderUsername }]));
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ block: "end" });
  }, [messages, activeId]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!activeId) return;
    const text = composerText.trim();
    if (!text && !pendingImage) return;

    setSending(true);
    setError(null);
    try {
      let imagePath: string | null = null;
      if (pendingImage) {
        const safeName = pendingImage.name.replace(/[^a-zA-Z0-9.\-_]/g, "_");
        const path = `${activeId}/${crypto.randomUUID()}-${safeName}`;
        const { error: uploadError } = await supabase.storage.from("chat-uploads").upload(path, pendingImage);
        if (uploadError) throw uploadError;
        imagePath = path;
      }
      const { error: insertError } = await supabase.from("messages").insert({
        conversation_id: activeId,
        sender_id: userId,
        body: text || null,
        image_path: imagePath,
      });
      if (insertError) throw insertError;
      setComposerText("");
      setPendingImage(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch {
      setError("Couldn't send that — check your connection and try again.");
    } finally {
      setSending(false);
    }
  }

  function handleFilePick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Only images are supported.");
      e.target.value = "";
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setError("That image is too large — 8MB max.");
      e.target.value = "";
      return;
    }
    setError(null);
    setPendingImage(file);
  }

  async function handleCreateChannel(e: React.FormEvent) {
    e.preventDefault();
    const name = newChannelName.trim();
    if (!name) return;
    const { data, error: insertError } = await supabase
      .from("conversations")
      .insert({ type: "channel", name, created_by: userId })
      .select("id, type, name, dm_user_id")
      .single();
    if (!insertError && data) {
      setConversations((prev) => (prev.some((c) => c.id === data.id) ? prev : [...prev, data]));
      setActiveId(data.id);
    }
    setNewChannelName("");
    setShowNewChannelForm(false);
  }

  const channels = conversations.filter((c) => c.type === "channel");
  const dms = conversations.filter((c) => c.type === "dm");
  const active = conversations.find((c) => c.id === activeId) ?? null;
  const activeLabel = active
    ? active.type === "channel"
      ? active.name ?? ""
      : isAdmin
        ? `@${active.dmUsername ?? "unknown"}`
        : "Direct Messages"
    : "";

  return (
    <div className="flex h-full overflow-hidden">
      <aside className="flex w-60 shrink-0 flex-col border-r border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
        <div className="flex-1 overflow-y-auto px-3 py-4">
          <div className="mb-1 flex items-center justify-between px-2">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">Channels</span>
            {isAdmin && (
              <button
                type="button"
                onClick={() => setShowNewChannelForm((v) => !v)}
                className="text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100"
                title="New channel"
              >
                <Plus size={14} />
              </button>
            )}
          </div>
          {isAdmin && showNewChannelForm && (
            <form onSubmit={handleCreateChannel} className="mb-2 flex items-center gap-1 px-2">
              <input
                autoFocus
                value={newChannelName}
                onChange={(e) => setNewChannelName(e.target.value)}
                placeholder="channel-name"
                className="w-full rounded-md border border-neutral-300 px-2 py-1 text-xs outline-none focus:border-neutral-500 dark:border-neutral-700 dark:bg-neutral-800"
              />
              <button type="submit" className="shrink-0 rounded-md bg-neutral-900 px-2 py-1 text-xs font-medium text-white dark:bg-neutral-100 dark:text-neutral-900">
                Add
              </button>
            </form>
          )}
          <ul className="space-y-0.5">
            {channels.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => setActiveId(c.id)}
                  className={`flex w-full items-center gap-1.5 rounded-lg px-2 py-1.5 text-left text-sm ${
                    c.id === activeId
                      ? "bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900"
                      : "text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
                  }`}
                >
                  <Hash size={13} className="shrink-0 opacity-60" />
                  <span className="truncate">{c.name}</span>
                </button>
              </li>
            ))}
            {conversationsLoaded && channels.length === 0 && (
              <li className="px-2 py-1 text-xs text-neutral-400">No channels yet.</li>
            )}
          </ul>

          <div className="mb-1 mt-5 px-2 text-[11px] font-semibold uppercase tracking-wide text-neutral-400">
            {isAdmin ? "Direct Messages" : "Support"}
          </div>
          <ul className="space-y-0.5">
            {dms.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => setActiveId(c.id)}
                  className={`flex w-full items-center gap-1.5 rounded-lg px-2 py-1.5 text-left text-sm ${
                    c.id === activeId
                      ? "bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900"
                      : "text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
                  }`}
                >
                  <MessageCircle size={13} className="shrink-0 opacity-60" />
                  <span className="truncate">{isAdmin ? `@${c.dmUsername ?? "unknown"}` : "Message an admin"}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </aside>

      <div className="flex flex-1 flex-col overflow-hidden">
        {!active ? (
          <div className="flex flex-1 items-center justify-center text-sm text-neutral-400">
            {conversationsLoaded ? "Pick a channel to get started." : "Loading…"}
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2 border-b border-neutral-200 px-6 py-3 dark:border-neutral-800">
              {active.type === "channel" ? <Hash size={15} className="opacity-60" /> : <MessageCircle size={15} className="opacity-60" />}
              <h2 className="text-sm font-semibold">{activeLabel}</h2>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-4">
              {messagesLoading ? (
                <p className="text-sm text-neutral-400">Loading messages…</p>
              ) : messages.length === 0 ? (
                <p className="text-sm text-neutral-400">No messages yet — say hello.</p>
              ) : (
                <ul className="space-y-3">
                  {messages.map((m) => (
                    <li key={m.id}>
                      <div className="flex items-baseline gap-2">
                        <span
                          className={`text-sm font-semibold ${
                            isAdminUsername(m.senderUsername)
                              ? "text-amber-700 dark:text-amber-400"
                              : "text-neutral-900 dark:text-neutral-100"
                          }`}
                        >
                          @{m.senderUsername}
                        </span>
                        <span className="text-[11px] text-neutral-400">
                          {new Date(m.created_at).toLocaleString(undefined, {
                            month: "short",
                            day: "numeric",
                            hour: "numeric",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                      {m.body && <p className="mt-0.5 whitespace-pre-wrap break-words text-sm text-neutral-700 dark:text-neutral-300">{m.body}</p>}
                      {m.image_path && (
                        <img
                          src={supabase.storage.from("chat-uploads").getPublicUrl(m.image_path).data.publicUrl}
                          alt=""
                          className="mt-1.5 max-h-72 max-w-sm rounded-lg border border-neutral-200 object-contain dark:border-neutral-800"
                        />
                      )}
                    </li>
                  ))}
                  <div ref={messagesEndRef} />
                </ul>
              )}
            </div>

            <form onSubmit={handleSend} className="border-t border-neutral-200 p-4 dark:border-neutral-800">
              {pendingImage && (
                <div className="mb-2 flex items-center gap-2 text-xs text-neutral-500">
                  <ImageIcon size={13} />
                  <span className="truncate">{pendingImage.name}</span>
                  <button type="button" onClick={() => setPendingImage(null)} className="text-neutral-400 hover:text-rose-500">
                    <X size={13} />
                  </button>
                </div>
              )}
              {error && <p className="mb-2 text-xs text-rose-600 dark:text-rose-400">{error}</p>}
              <div className="flex items-end gap-2">
                <input ref={fileInputRef} type="file" accept="image/*" hidden onChange={handleFilePick} />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-neutral-300 text-neutral-500 hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800"
                  title="Attach a photo"
                >
                  <ImageIcon size={16} />
                </button>
                <textarea
                  value={composerText}
                  onChange={(e) => setComposerText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSend(e);
                    }
                  }}
                  placeholder={`Message ${active.type === "channel" ? "#" + active.name : activeLabel}`}
                  rows={1}
                  className="flex-1 resize-none rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-500 dark:border-neutral-700 dark:bg-neutral-800"
                />
                <button
                  type="submit"
                  disabled={sending || (!composerText.trim() && !pendingImage)}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-neutral-900 text-white disabled:opacity-40 dark:bg-neutral-100 dark:text-neutral-900"
                  title="Send"
                >
                  <Send size={15} />
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
