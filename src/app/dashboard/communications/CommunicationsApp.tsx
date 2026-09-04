"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Hash, MessageCircle, Plus, Send, Image as ImageIcon, X, Trash2, Lock, LockOpen, SmilePlus, Pencil, Search } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { EMOJI_CATEGORIES, EMOJI_KEYWORDS } from "./emoji-data";
import { isAdminUsername } from "@/lib/is-admin-username";
import { ProfileModal } from "@/components/ProfileModal";

type Conversation = {
  id: string;
  type: "channel" | "dm";
  name: string | null;
  dm_user_id: string | null;
  admin_only_posting: boolean;
  dmUsername?: string;
};

type Reaction = { emoji: string; userId: string };

// The raw shape a `messages` row realtime payload carries -- deliberately
// missing `senderUsername` (resolved separately) and `reactions` (lives
// in a different table entirely, never present on a messages row/payload).
type MessageRow = {
  id: string;
  conversation_id: string;
  sender_id: string | null;
  body: string | null;
  image_path: string | null;
  created_at: string;
  deleted_at: string | null;
  edited_at: string | null;
};

type Message = MessageRow & {
  senderUsername: string;
  senderAvatarPath: string | null;
  reactions: Reaction[];
};

// A message with no sender_id is a bot/system post -- e.g. the automatic
// #general welcome when someone new joins (see handle_new_profile_welcome
// in 0012_welcome_bot.sql) -- not a real account, so there's no profile
// to look up.
const BOT_NAME = "paidcoaching.com BOT";

// Renders a message body with any @username tokens (that match a real
// user) highlighted -- plain text otherwise, so "someone@example.com" or
// an @mention of a name nobody has doesn't get styled.
function renderBodyWithMentions(body: string, knownUsernames: Set<string>) {
  const parts = body.split(/(@[a-zA-Z0-9_]+)/g);
  return parts.map((part, i) => {
    if (part.startsWith("@") && knownUsernames.has(part.slice(1))) {
      return (
        <span key={i} className="font-semibold text-indigo-600 dark:text-indigo-400">
          {part}
        </span>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

// Rendered inline right under whichever message's react button was
// clicked, rather than as a floating/portaled popover -- keeps this
// simple with no viewport-aware positioning logic, at the cost of
// pushing later messages down while it's open (an acceptable trade-off
// for a picker that's only open briefly).
function EmojiPicker({
  search,
  onSearchChange,
  onPick,
  onClose,
}: {
  search: string;
  onSearchChange: (value: string) => void;
  onPick: (emoji: string) => void;
  onClose: () => void;
}) {
  const [activeCategory, setActiveCategory] = useState(0);

  const searchResults = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return null;
    return Object.entries(EMOJI_KEYWORDS)
      .filter(([, keywords]) => keywords.some((k) => k.includes(q)))
      .map(([emoji]) => emoji);
  }, [search]);

  return (
    <div className="mt-2 w-72 rounded-xl border border-neutral-200 bg-white p-2 shadow-lg dark:border-neutral-700 dark:bg-neutral-800">
      <div className="mb-2 flex items-center gap-1.5 rounded-lg border border-neutral-200 px-2 py-1 dark:border-neutral-700">
        <Search size={13} className="shrink-0 text-neutral-400" />
        <input
          autoFocus
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search emoji…"
          className="w-full bg-transparent text-xs outline-none dark:text-neutral-100"
        />
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200"
        >
          <X size={13} />
        </button>
      </div>

      {searchResults === null && (
        <div className="mb-1.5 flex gap-1 overflow-x-auto pb-1">
          {EMOJI_CATEGORIES.map((cat, i) => (
            <button
              key={cat.name}
              type="button"
              onClick={() => setActiveCategory(i)}
              title={cat.name}
              className={`shrink-0 rounded-md px-1.5 py-0.5 text-sm ${
                i === activeCategory ? "bg-neutral-200 dark:bg-neutral-600" : "hover:bg-neutral-100 dark:hover:bg-neutral-700"
              }`}
            >
              {cat.emojis[0]}
            </button>
          ))}
        </div>
      )}

      <div className="grid max-h-48 grid-cols-8 gap-0.5 overflow-y-auto">
        {(searchResults ?? EMOJI_CATEGORIES[activeCategory].emojis).map((emoji, i) => (
          <button
            key={`${emoji}-${i}`}
            type="button"
            onClick={() => onPick(emoji)}
            className="flex h-7 w-7 items-center justify-center rounded-md text-base hover:bg-neutral-100 dark:hover:bg-neutral-700"
          >
            {emoji}
          </button>
        ))}
        {searchResults !== null && searchResults.length === 0 && (
          <p className="col-span-8 py-2 text-center text-xs text-neutral-400">No matches.</p>
        )}
      </div>
    </div>
  );
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
  // Mirrors usernameCache -- avatar path per user id, filled in as
  // messages/conversations load and topped up on demand for a realtime
  // message from someone not seen yet this session.
  const avatarCache = useRef<Record<string, string | null>>({});

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [conversationsLoaded, setConversationsLoaded] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  // Conversation ids with something unread in them -- bolds the name and
  // shows a green dot for that row in the sidebar. Separate from (and a
  // finer-grained sibling to) has_unread_communications(), which only
  // ever answers "is anything, anywhere, unread" for the dashboard card.
  const [unreadIds, setUnreadIds] = useState<Set<string>>(new Set());
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
  const [channelError, setChannelError] = useState<string | null>(null);

  const [allUsernames, setAllUsernames] = useState<string[]>([]);
  const knownUsernames = useMemo(() => new Set(allUsernames), [allUsernames]);
  // The @-mention currently being typed (text after the "@", no space yet)
  // -- null means the composer isn't mid-mention right now.
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionIndex, setMentionIndex] = useState(0);
  const mentionSuggestions = useMemo(() => {
    if (mentionQuery === null) return [];
    return allUsernames.filter((u) => u.toLowerCase().startsWith(mentionQuery.toLowerCase())).slice(0, 6);
  }, [mentionQuery, allUsernames]);

  // Which message's emoji picker is open, if any -- rendered inline right
  // under that message rather than as a floating/portaled popover, so no
  // viewport-aware positioning logic is needed.
  const [reactingMessageId, setReactingMessageId] = useState<string | null>(null);
  const [emojiSearch, setEmojiSearch] = useState("");

  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");

  // Whose profile is currently open (view mode for anyone but yourself),
  // set by clicking an avatar or username on a message. Bot messages have
  // no sender_id, so there's never anything to view for those.
  const [viewingProfileId, setViewingProfileId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const composerRef = useRef<HTMLTextAreaElement | null>(null);

  async function resolveUsername(id: string | null): Promise<string> {
    if (id === null) return BOT_NAME;
    if (usernameCache.current[id]) return usernameCache.current[id];
    const { data } = await supabase.from("profiles").select("username, avatar_path").eq("id", id).maybeSingle();
    const name = data?.username ?? "unknown";
    usernameCache.current[id] = name;
    avatarCache.current[id] = data?.avatar_path ?? null;
    return name;
  }

  // Marks a conversation read as of right now -- called both when its
  // messages first load and whenever a new one arrives while it's the
  // open conversation, so the dashboard's unread badge clears for
  // whatever the user is actually looking at. Fire-and-forget: nothing
  // in the UI needs to wait on this.
  function markRead(conversationId: string) {
    setUnreadIds((prev) => {
      if (!prev.has(conversationId)) return prev;
      const next = new Set(prev);
      next.delete(conversationId);
      return next;
    });
    supabase
      .from("conversation_reads")
      .upsert({ user_id: userId, conversation_id: conversationId, last_read_at: new Date().toISOString() })
      .then(({ error: readError }) => {
        if (readError) console.error("Failed to mark conversation read:", readError);
      });
  }

  // ---- Load the conversation list once on mount ----
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: channels } = await supabase
        .from("conversations")
        .select("id, type, name, dm_user_id, admin_only_posting, created_at")
        .eq("type", "channel")
        .order("created_at", { ascending: true });

      let dms: Conversation[] = [];
      if (isAdmin) {
        const { data } = await supabase
          .from("conversations")
          .select(
            "id, type, name, dm_user_id, created_at, profiles!conversations_dm_user_id_fkey(username, avatar_path)"
          )
          .eq("type", "dm")
          .order("created_at", { ascending: true });
        dms = (data ?? []).map((d) => {
          const joined = d.profiles as unknown as { username?: string; avatar_path?: string | null } | null;
          if (joined?.username && d.dm_user_id) {
            usernameCache.current[d.dm_user_id] = joined.username;
            avatarCache.current[d.dm_user_id] = joined.avatar_path ?? null;
          }
          return {
            id: d.id,
            type: "dm" as const,
            name: d.name,
            dm_user_id: d.dm_user_id,
            admin_only_posting: false,
            dmUsername: joined?.username,
          };
        });
      } else {
        const { data } = await supabase
          .from("conversations")
          .select("id, type, name, dm_user_id, created_at")
          .eq("type", "dm")
          .eq("dm_user_id", userId)
          .maybeSingle();
        if (data) {
          dms = [
            { id: data.id, type: "dm", name: data.name, dm_user_id: data.dm_user_id, admin_only_posting: false },
          ];
        }
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

  // ---- Load every username once, for @mention autocomplete + highlighting ----
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase.from("profiles").select("username");
      if (cancelled || !data) return;
      setAllUsernames(data.map((d) => d.username as string));
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- Load which conversations already have something unread, once on mount ----
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase.rpc("unread_conversation_ids");
      if (cancelled || !data) return;
      setUnreadIds(new Set((data as { conversation_id: string }[]).map((r) => r.conversation_id)));
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- Live: any new message across every conversation the user can see,
  // purely to keep the sidebar's unread dots current. Separate from the
  // per-active-conversation subscription below (which only covers
  // whichever conversation is currently open) -- unfiltered here since
  // RLS already limits this to conversations the caller could see anyway,
  // the same way the has_unread_communications()/unread_conversation_ids()
  // functions rely on RLS rather than an explicit visibility check.
  useEffect(() => {
    const channel = supabase
      .channel("communications-unread")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, (payload) => {
        const row = payload.new as MessageRow;
        if (row.sender_id === userId) return;
        setUnreadIds((prev) => (prev.has(row.conversation_id) ? prev : new Set(prev).add(row.conversation_id)));
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
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
      .on(
        // Covers a channel being locked/unlocked -- everyone viewing sees
        // it change live, not just after a refresh.
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "conversations", filter: "type=eq.channel" },
        (payload) => {
          const row = payload.new as Conversation;
          setConversations((prev) => prev.map((c) => (c.id === row.id ? { ...c, ...row } : c)));
        }
      )
      .on(
        // Covers an admin deleting a channel -- no `filter` here (unlike
        // the two above) since a DELETE payload's `old` record only ever
        // carries the primary key with this table's default replica
        // identity, so a `type=eq.channel` filter would never match and
        // this event would silently never fire. Safe to leave unfiltered
        // anyway: the delete RLS policy (0019_delete_channels.sql) only
        // ever allows type = 'channel' rows to be deleted at all, so any
        // DELETE that reaches here is a channel by construction.
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "conversations" },
        (payload) => {
          const row = payload.old as { id: string };
          setConversations((prev) => prev.filter((c) => c.id !== row.id));
          setActiveId((prev) => (prev === row.id ? null : prev));
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
        .select(
          "id, conversation_id, sender_id, body, image_path, created_at, deleted_at, edited_at, profiles!messages_sender_id_fkey(username, avatar_path), message_reactions(user_id, emoji)"
        )
        .eq("conversation_id", activeId)
        .order("created_at", { ascending: true })
        .limit(200);
      if (cancelled) return;
      const rows: Message[] = (data ?? []).map((m) => {
        const joined = m.profiles as unknown as { username?: string; avatar_path?: string | null } | null;
        if (joined?.username && m.sender_id) {
          usernameCache.current[m.sender_id] = joined.username;
          avatarCache.current[m.sender_id] = joined.avatar_path ?? null;
        }
        const reactionRows = (m.message_reactions ?? []) as { user_id: string; emoji: string }[];
        return {
          id: m.id,
          conversation_id: m.conversation_id,
          sender_id: m.sender_id,
          body: m.body,
          image_path: m.image_path,
          created_at: m.created_at,
          deleted_at: m.deleted_at,
          edited_at: m.edited_at,
          senderUsername: m.sender_id === null ? BOT_NAME : (joined?.username ?? usernameCache.current[m.sender_id] ?? "unknown"),
          senderAvatarPath: m.sender_id === null ? null : (avatarCache.current[m.sender_id] ?? null),
          reactions: reactionRows.map((r) => ({ emoji: r.emoji, userId: r.user_id })),
        };
      });
      setMessages(rows);
      setMessagesConversationId(activeId);
      markRead(activeId);
    })();

    const channel = supabase
      .channel(`messages:${activeId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${activeId}` },
        async (payload) => {
          const row = payload.new as MessageRow;
          const senderUsername = await resolveUsername(row.sender_id);
          const senderAvatarPath = row.sender_id === null ? null : (avatarCache.current[row.sender_id] ?? null);
          setMessages((prev) =>
            prev.some((m) => m.id === row.id)
              ? prev
              : [...prev, { ...row, senderUsername, senderAvatarPath, reactions: [] }]
          );
          if (row.sender_id !== userId) markRead(activeId);
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "messages", filter: `conversation_id=eq.${activeId}` },
        (payload) => {
          const row = payload.new as MessageRow;
          setMessages((prev) => prev.map((m) => (m.id === row.id ? { ...m, ...row } : m)));
        }
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "message_reactions", filter: `conversation_id=eq.${activeId}` },
        (payload) => {
          const row = payload.new as { message_id: string; user_id: string; emoji: string };
          setMessages((prev) =>
            prev.map((m) =>
              m.id === row.message_id && !m.reactions.some((r) => r.userId === row.user_id && r.emoji === row.emoji)
                ? { ...m, reactions: [...m.reactions, { emoji: row.emoji, userId: row.user_id }] }
                : m
            )
          );
        }
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "message_reactions", filter: `conversation_id=eq.${activeId}` },
        (payload) => {
          const row = payload.old as { message_id: string; user_id: string; emoji: string };
          setMessages((prev) =>
            prev.map((m) =>
              m.id === row.message_id
                ? { ...m, reactions: m.reactions.filter((r) => !(r.userId === row.user_id && r.emoji === row.emoji)) }
                : m
            )
          );
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

  async function handleDeleteMessage(id: string) {
    // Optimistic: the realtime UPDATE will confirm this, but no need to
    // wait on it for something this simple.
    setMessages((prev) =>
      prev.map((m) => (m.id === id ? { ...m, deleted_at: new Date().toISOString() } : m))
    );
    // .select() after the update is what lets us tell "actually updated a
    // row" apart from "RLS silently matched zero rows" -- Supabase/Postgres
    // don't treat the latter as an error on its own, so without this the
    // optimistic change above would look like it worked in this browser
    // while never actually persisting.
    const { data, error: deleteError } = await supabase
      .from("messages")
      .update({ deleted_at: new Date().toISOString(), deleted_by: userId })
      .eq("id", id)
      .select("id");
    if (deleteError || !data || data.length === 0) {
      console.error("Failed to delete message:", deleteError ?? "no row was updated (RLS?)");
      setError("Couldn't delete that message — try again.");
      setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, deleted_at: null } : m)));
    }
  }

  // Toggle: adding a reaction you've already left removes it instead.
  // Same optimistic-then-verify shape as delete/lock -- a row-not-found on
  // the DELETE path (already-removed-elsewhere) is treated as success,
  // not an error, since the end state either way is "no longer reacted".
  async function handleToggleReaction(message: Message, emoji: string) {
    const already = message.reactions.some((r) => r.userId === userId && r.emoji === emoji);
    setReactingMessageId(null);
    setEmojiSearch("");

    if (already) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === message.id
            ? { ...m, reactions: m.reactions.filter((r) => !(r.userId === userId && r.emoji === emoji)) }
            : m
        )
      );
      const { error: removeError } = await supabase
        .from("message_reactions")
        .delete()
        .eq("message_id", message.id)
        .eq("user_id", userId)
        .eq("emoji", emoji);
      if (removeError) {
        console.error("Failed to remove reaction:", removeError);
        setMessages((prev) =>
          prev.map((m) => (m.id === message.id ? { ...m, reactions: [...m.reactions, { emoji, userId }] } : m))
        );
      }
      return;
    }

    setMessages((prev) =>
      prev.map((m) => (m.id === message.id ? { ...m, reactions: [...m.reactions, { emoji, userId }] } : m))
    );
    const { data, error: addError } = await supabase
      .from("message_reactions")
      .insert({ message_id: message.id, conversation_id: message.conversation_id, user_id: userId, emoji })
      .select("id");
    if (addError || !data || data.length === 0) {
      console.error("Failed to add reaction:", addError ?? "no row was inserted (RLS?)");
      setMessages((prev) =>
        prev.map((m) =>
          m.id === message.id
            ? { ...m, reactions: m.reactions.filter((r) => !(r.userId === userId && r.emoji === emoji)) }
            : m
        )
      );
    }
  }

  function handleStartEdit(message: Message) {
    setEditingMessageId(message.id);
    setEditingText(message.body ?? "");
  }

  function handleCancelEdit() {
    setEditingMessageId(null);
    setEditingText("");
  }

  async function handleSaveEdit(messageId: string) {
    const text = editingText.trim();
    if (!text) return;
    const previous = messages.find((m) => m.id === messageId);
    setMessages((prev) =>
      prev.map((m) => (m.id === messageId ? { ...m, body: text, edited_at: new Date().toISOString() } : m))
    );
    setEditingMessageId(null);
    setEditingText("");
    const { data, error: editError } = await supabase
      .from("messages")
      .update({ body: text })
      .eq("id", messageId)
      .select("id");
    if (editError || !data || data.length === 0) {
      console.error("Failed to edit message:", editError ?? "no row was updated (RLS?)");
      setError("Couldn't save that edit — try again.");
      if (previous) setMessages((prev) => prev.map((m) => (m.id === messageId ? previous : m)));
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
      .select("id, type, name, dm_user_id, admin_only_posting")
      .single();
    if (insertError || !data) {
      // Channel names are unique (including the auto-created "general") --
      // this is the one realistic way this insert fails.
      setChannelError(`A channel named "${name}" already exists.`);
      return;
    }
    setChannelError(null);
    setConversations((prev) => (prev.some((c) => c.id === data.id) ? prev : [...prev, data]));
    setActiveId(data.id);
    setNewChannelName("");
    setShowNewChannelForm(false);
  }

  async function handleToggleChannelLock(conversationId: string, currentlyRestricted: boolean) {
    const next = !currentlyRestricted;
    // Optimistic, same as message delete -- and for the same reason,
    // confirm a row actually came back rather than trusting a lack of
    // `error` alone.
    setConversations((prev) =>
      prev.map((c) => (c.id === conversationId ? { ...c, admin_only_posting: next } : c))
    );
    const { data, error: updateError } = await supabase
      .from("conversations")
      .update({ admin_only_posting: next })
      .eq("id", conversationId)
      .select("id");
    if (updateError || !data || data.length === 0) {
      console.error("Failed to toggle channel lock:", updateError ?? "no row was updated (RLS?)");
      setError("Couldn't change who can post here — try again.");
      setConversations((prev) =>
        prev.map((c) => (c.id === conversationId ? { ...c, admin_only_posting: currentlyRestricted } : c))
      );
    }
  }

  async function handleDeleteChannel(conversationId: string, name: string | null) {
    if (!window.confirm(`Delete #${name ?? "this channel"} and every message in it? This can't be undone.`)) return;
    const { data, error: deleteError } = await supabase
      .from("conversations")
      .delete()
      .eq("id", conversationId)
      .select("id");
    if (deleteError || !data || data.length === 0) {
      console.error("Failed to delete channel:", deleteError ?? "no row was deleted (RLS?)");
      setError("Couldn't delete that channel — try again.");
      return;
    }
    setConversations((prev) => prev.filter((c) => c.id !== conversationId));
    setActiveId((prev) => (prev === conversationId ? null : prev));
  }

  function handleComposerChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const text = e.target.value;
    setComposerText(text);
    const cursor = e.target.selectionStart;
    const match = text.slice(0, cursor).match(/(?:^|\s)@([a-zA-Z0-9_]*)$/);
    if (match) {
      setMentionQuery(match[1]);
      setMentionIndex(0);
    } else {
      setMentionQuery(null);
    }
  }

  function selectMention(pickedUsername: string) {
    const el = composerRef.current;
    if (!el || mentionQuery === null) return;
    const cursor = el.selectionStart;
    const atIndex = cursor - mentionQuery.length - 1;
    const before = composerText.slice(0, atIndex);
    const after = composerText.slice(cursor);
    const insert = `@${pickedUsername} `;
    const newText = `${before}${insert}${after}`;
    setComposerText(newText);
    setMentionQuery(null);
    requestAnimationFrame(() => {
      el.focus();
      const newCursor = before.length + insert.length;
      el.setSelectionRange(newCursor, newCursor);
    });
  }

  function handleComposerKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (mentionSuggestions.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setMentionIndex((i) => (i + 1) % mentionSuggestions.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setMentionIndex((i) => (i - 1 + mentionSuggestions.length) % mentionSuggestions.length);
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        selectMention(mentionSuggestions[mentionIndex]);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setMentionQuery(null);
        return;
      }
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend(e);
    }
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
  const canPost = !active || active.type === "dm" || !active.admin_only_posting || isAdmin;

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
            <div className="mb-2 px-2">
              <form onSubmit={handleCreateChannel} className="flex items-center gap-1">
                <input
                  autoFocus
                  value={newChannelName}
                  onChange={(e) => {
                    setNewChannelName(e.target.value);
                    setChannelError(null);
                  }}
                  placeholder="channel-name"
                  className="w-full rounded-md border border-neutral-300 px-2 py-1 text-xs outline-none focus:border-neutral-500 dark:border-neutral-700 dark:bg-neutral-800"
                />
                <button type="submit" className="shrink-0 rounded-md bg-neutral-900 px-2 py-1 text-xs font-medium text-white dark:bg-neutral-100 dark:text-neutral-900">
                  Add
                </button>
              </form>
              {channelError && <p className="mt-1 text-[11px] text-rose-600 dark:text-rose-400">{channelError}</p>}
            </div>
          )}
          <ul className="space-y-0.5">
            {channels.map((c) => {
              const unread = unreadIds.has(c.id);
              return (
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
                    <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${unread ? "bg-emerald-500" : "invisible"}`} />
                    <Hash size={13} className="shrink-0 opacity-60" />
                    <span className={`truncate ${unread ? "font-semibold" : ""}`}>{c.name}</span>
                  </button>
                </li>
              );
            })}
            {conversationsLoaded && channels.length === 0 && (
              <li className="px-2 py-1 text-xs text-neutral-400">No channels yet.</li>
            )}
          </ul>

          <div className="mb-1 mt-5 px-2 text-[11px] font-semibold uppercase tracking-wide text-neutral-400">
            {isAdmin ? "Direct Messages" : "Support"}
          </div>
          <ul className="space-y-0.5">
            {dms.map((c) => {
              const unread = unreadIds.has(c.id);
              return (
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
                    <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${unread ? "bg-emerald-500" : "invisible"}`} />
                    <MessageCircle size={13} className="shrink-0 opacity-60" />
                    <span className={`truncate ${unread ? "font-semibold" : ""}`}>
                      {isAdmin ? `@${c.dmUsername ?? "unknown"}` : "Message an admin"}
                    </span>
                  </button>
                </li>
              );
            })}
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
            <div className="flex items-center justify-between gap-2 border-b border-neutral-200 px-6 py-3 dark:border-neutral-800">
              <div className="flex items-center gap-2">
                {active.type === "channel" ? <Hash size={15} className="opacity-60" /> : <MessageCircle size={15} className="opacity-60" />}
                <h2 className="text-sm font-semibold">{activeLabel}</h2>
              </div>
              {active.type === "channel" &&
                (isAdmin ? (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleToggleChannelLock(active.id, active.admin_only_posting)}
                      className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium ${
                        active.admin_only_posting
                          ? "border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-400"
                          : "border-neutral-300 text-neutral-500 hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800"
                      }`}
                      title={active.admin_only_posting ? "Only admins can post — click to let everyone post" : "Anyone can post — click to restrict to admins"}
                    >
                      {active.admin_only_posting ? <Lock size={13} /> : <LockOpen size={13} />}
                      {active.admin_only_posting ? "Admins only" : "Anyone can post"}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteChannel(active.id, active.name)}
                      title="Delete channel"
                      className="inline-flex text-neutral-400 hover:text-rose-500"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                ) : (
                  active.admin_only_posting && (
                    <span className="flex items-center gap-1.5 rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-400">
                      <Lock size={13} />
                      View only
                    </span>
                  )
                ))}
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-4">
              {messagesLoading ? (
                <p className="text-sm text-neutral-400">Loading messages…</p>
              ) : messages.length === 0 ? (
                <p className="text-sm text-neutral-400">No messages yet — say hello.</p>
              ) : (
                <ul className="space-y-3">
                  {messages.map((m) => {
                    const canDelete = !m.deleted_at && (m.sender_id === userId || isAdmin);
                    // Editing is sender-only, never admin (see
                    // enforce_message_update_rules in 0014_...sql) --
                    // rewriting someone else's words is a different
                    // capability than removing them.
                    const canEdit = !m.deleted_at && m.sender_id === userId && m.body !== null;
                    const canReact = !m.deleted_at;
                    const isEditing = editingMessageId === m.id;
                    const isReacting = reactingMessageId === m.id;
                    const reactionGroups = m.reactions.reduce<Record<string, string[]>>((acc, r) => {
                      (acc[r.emoji] ??= []).push(r.userId);
                      return acc;
                    }, {});

                    return (
                      <li key={m.id} className="group flex gap-2.5">
                        <button
                          type="button"
                          onClick={() => m.sender_id && setViewingProfileId(m.sender_id)}
                          disabled={!m.sender_id}
                          title={m.sender_id ? `View @${m.senderUsername}'s profile` : undefined}
                          className="mt-0.5 shrink-0"
                        >
                          {m.sender_id === null ? (
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-100 text-sm dark:bg-indigo-500/15">
                              🤖
                            </div>
                          ) : m.senderAvatarPath ? (
                            <img
                              src={supabase.storage.from("avatars").getPublicUrl(m.senderAvatarPath).data.publicUrl}
                              alt=""
                              className="h-8 w-8 rounded-full object-cover"
                            />
                          ) : (
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-neutral-300 text-xs font-semibold text-neutral-600 dark:bg-neutral-700 dark:text-neutral-300">
                              {m.senderUsername[0]?.toUpperCase() ?? "?"}
                            </div>
                          )}
                        </button>
                        <div className="min-w-0 flex-1">
                        <div className="flex items-baseline gap-2">
                          <button
                            type="button"
                            onClick={() => m.sender_id && setViewingProfileId(m.sender_id)}
                            disabled={!m.sender_id}
                            className={`text-sm font-semibold ${m.sender_id ? "hover:underline" : ""} ${
                              m.sender_id === null
                                ? "text-indigo-600 dark:text-indigo-400"
                                : isAdminUsername(m.senderUsername)
                                  ? "text-amber-700 dark:text-amber-400"
                                  : "text-neutral-900 dark:text-neutral-100"
                            }`}
                          >
                            {m.sender_id === null ? `🤖 ${m.senderUsername}` : `@${m.senderUsername}`}
                          </button>
                          <span className="text-[11px] text-neutral-400">
                            {new Date(m.created_at).toLocaleString(undefined, {
                              month: "short",
                              day: "numeric",
                              hour: "numeric",
                              minute: "2-digit",
                            })}
                            {m.edited_at && !m.deleted_at ? " (edited)" : ""}
                          </span>
                          <div className="ml-auto flex items-center gap-2">
                            {canReact && (
                              <button
                                type="button"
                                onClick={() => {
                                  setReactingMessageId(isReacting ? null : m.id);
                                  setEmojiSearch("");
                                }}
                                className="inline-flex text-neutral-300 hover:text-amber-500 dark:text-neutral-600"
                                title="Add a reaction"
                              >
                                <SmilePlus size={14} />
                              </button>
                            )}
                            {canEdit && (
                              <button
                                type="button"
                                onClick={() => handleStartEdit(m)}
                                className="inline-flex text-neutral-300 hover:text-indigo-500 dark:text-neutral-600"
                                title="Edit message"
                              >
                                <Pencil size={13} />
                              </button>
                            )}
                            {canDelete && (
                              <button
                                type="button"
                                onClick={() => handleDeleteMessage(m.id)}
                                className="inline-flex text-neutral-300 hover:text-rose-500 dark:text-neutral-600"
                                title="Delete message"
                              >
                                <Trash2 size={13} />
                              </button>
                            )}
                          </div>
                        </div>
                        {m.deleted_at ? (
                          <p className="mt-0.5 text-sm italic text-neutral-400">This message was deleted.</p>
                        ) : isEditing ? (
                          <div className="mt-1">
                            <textarea
                              autoFocus
                              value={editingText}
                              onChange={(e) => setEditingText(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" && !e.shiftKey) {
                                  e.preventDefault();
                                  handleSaveEdit(m.id);
                                }
                                if (e.key === "Escape") handleCancelEdit();
                              }}
                              rows={2}
                              className="w-full resize-none rounded-lg border border-indigo-300 px-3 py-2 text-sm outline-none dark:border-indigo-500/50 dark:bg-neutral-800"
                            />
                            <div className="mt-1 flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => handleSaveEdit(m.id)}
                                className="rounded-md bg-neutral-900 px-2.5 py-1 text-xs font-medium text-white dark:bg-neutral-100 dark:text-neutral-900"
                              >
                                Save
                              </button>
                              <button
                                type="button"
                                onClick={handleCancelEdit}
                                className="text-xs text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <>
                            {m.body && (
                              <p className="mt-0.5 whitespace-pre-wrap break-words text-sm text-neutral-700 dark:text-neutral-300">
                                {renderBodyWithMentions(m.body, knownUsernames)}
                              </p>
                            )}
                            {m.image_path && (
                              <img
                                src={supabase.storage.from("chat-uploads").getPublicUrl(m.image_path).data.publicUrl}
                                alt=""
                                className="mt-1.5 max-h-72 max-w-sm rounded-lg border border-neutral-200 object-contain dark:border-neutral-800"
                              />
                            )}
                          </>
                        )}

                        {Object.keys(reactionGroups).length > 0 && (
                          <div className="mt-1.5 flex flex-wrap gap-1">
                            {Object.entries(reactionGroups).map(([emoji, userIds]) => (
                              <button
                                key={emoji}
                                type="button"
                                onClick={() => handleToggleReaction(m, emoji)}
                                className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs ${
                                  userIds.includes(userId)
                                    ? "border-indigo-300 bg-indigo-50 dark:border-indigo-500/40 dark:bg-indigo-500/10"
                                    : "border-neutral-200 bg-white hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900 dark:hover:bg-neutral-800"
                                }`}
                                title={`${userIds.length} reaction${userIds.length === 1 ? "" : "s"}${userIds.includes(userId) ? " (including yours)" : ""}`}
                              >
                                <span>{emoji}</span>
                                <span className="text-neutral-500 dark:text-neutral-400">{userIds.length}</span>
                              </button>
                            ))}
                          </div>
                        )}

                        {isReacting && (
                          <EmojiPicker
                            search={emojiSearch}
                            onSearchChange={setEmojiSearch}
                            onPick={(emoji) => handleToggleReaction(m, emoji)}
                            onClose={() => {
                              setReactingMessageId(null);
                              setEmojiSearch("");
                            }}
                          />
                        )}
                        </div>
                      </li>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </ul>
              )}
            </div>

            {!canPost ? (
              <div className="border-t border-neutral-200 p-4 text-center text-sm text-neutral-400 dark:border-neutral-800">
                Only admins can post in this channel right now.
              </div>
            ) : (
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
              {mentionSuggestions.length > 0 && (
                <ul className="mb-2 flex flex-wrap gap-1 rounded-lg border border-neutral-200 bg-white p-1.5 dark:border-neutral-700 dark:bg-neutral-800">
                  {mentionSuggestions.map((u, i) => (
                    <li key={u}>
                      <button
                        type="button"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          selectMention(u);
                        }}
                        className={`rounded-md px-2 py-1 text-xs font-medium ${
                          i === mentionIndex
                            ? "bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900"
                            : "text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-700"
                        }`}
                      >
                        @{u}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
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
                  ref={composerRef}
                  value={composerText}
                  onChange={handleComposerChange}
                  onKeyDown={handleComposerKeyDown}
                  placeholder={`Message ${active.type === "channel" ? "#" + active.name : activeLabel} (@ to mention someone)`}
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
            )}
          </>
        )}
      </div>

      {viewingProfileId && (
        <ProfileModal userId={viewingProfileId} viewerId={userId} onClose={() => setViewingProfileId(null)} />
      )}
    </div>
  );
}
