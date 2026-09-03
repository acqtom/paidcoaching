"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { X, AtSign, Video, Camera } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { isAdminUsername } from "@/lib/is-admin-username";

type Profile = {
  username: string;
  avatar_path: string | null;
  bio: string | null;
  instagram_url: string | null;
  youtube_url: string | null;
};

const MAX_AVATAR_BYTES = 5 * 1024 * 1024;

// Both the editor (viewing your own profile) and the read-only viewer
// (clicking someone else's name/avatar in Communications) live in one
// component -- `isOwn` just switches which half of the JSX renders,
// rather than duplicating the avatar/loading/layout scaffolding across
// two separate components.
export function ProfileModal({
  userId,
  viewerId,
  onClose,
  onProfileChange,
}: {
  userId: string;
  viewerId: string;
  onClose: () => void;
  onProfileChange?: (p: { username: string; avatar_path: string | null }) => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const isOwn = userId === viewerId;

  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const [editUsername, setEditUsername] = useState("");
  const [editBio, setEditBio] = useState("");
  const [editInstagram, setEditInstagram] = useState("");
  const [editYoutube, setEditYoutube] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [avatarUploading, setAvatarUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("username, avatar_path, bio, instagram_url, youtube_url")
        .eq("id", userId)
        .maybeSingle();
      if (cancelled || !data) return;
      setProfile(data);
      setEditUsername(data.username);
      setEditBio(data.bio ?? "");
      setEditInstagram(data.instagram_url ?? "");
      setEditYoutube(data.youtube_url ?? "");
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  async function handleAvatarPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Only images are supported.");
      e.target.value = "";
      return;
    }
    if (file.size > MAX_AVATAR_BYTES) {
      setError("That image is too large — 5MB max.");
      e.target.value = "";
      return;
    }
    setError(null);
    setAvatarUploading(true);
    const previousPath = profile?.avatar_path ?? null;
    try {
      const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, "_");
      const path = `${userId}/${crypto.randomUUID()}-${safeName}`;
      const { error: uploadError } = await supabase.storage.from("avatars").upload(path, file);
      if (uploadError) throw uploadError;
      const { data, error: updateError } = await supabase
        .from("profiles")
        .update({ avatar_path: path })
        .eq("id", userId)
        .select("avatar_path")
        .single();
      if (updateError || !data) throw updateError ?? new Error("No row updated");
      setProfile((p) => {
        const next = p ? { ...p, avatar_path: path } : p;
        if (next) onProfileChange?.({ username: next.username, avatar_path: next.avatar_path });
        return next;
      });
      if (previousPath) {
        // Best-effort cleanup -- not worth failing the upload over if it doesn't work.
        supabase.storage.from("avatars").remove([previousPath]).catch(() => {});
      }
    } catch (err) {
      console.error("Failed to upload avatar:", err);
      setError("Couldn't upload that image — try again.");
    } finally {
      setAvatarUploading(false);
      e.target.value = "";
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    const trimmedUsername = editUsername.trim();
    // Only enforced on an actual change -- matches the database trigger,
    // so an admin resubmitting their own unchanged one-letter username
    // (while just editing their bio, say) is never blocked by this.
    if (trimmedUsername !== profile?.username && trimmedUsername.length < 3) {
      setError("Username must be at least 3 characters.");
      return;
    }
    setSaving(true);
    setError(null);
    setSaved(false);
    const { data, error: updateError } = await supabase
      .from("profiles")
      .update({
        username: trimmedUsername,
        bio: editBio.trim() || null,
        instagram_url: editInstagram.trim() || null,
        youtube_url: editYoutube.trim() || null,
      })
      .eq("id", userId)
      .select("username, bio, instagram_url, youtube_url")
      .single();
    setSaving(false);
    if (updateError || !data) {
      if (updateError?.code === "23505") {
        setError("That username is taken.");
      } else {
        setError(updateError?.message ?? "Couldn't save — try again.");
      }
      return;
    }
    setProfile((p) => {
      const next = p ? { ...p, ...data } : p;
      if (next) onProfileChange?.({ username: next.username, avatar_path: next.avatar_path });
      return next;
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  const avatarUrl = profile?.avatar_path
    ? supabase.storage.from("avatars").getPublicUrl(profile.avatar_path).data.publicUrl
    : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={onClose}>
      <div
        className="w-full max-w-sm rounded-2xl border border-neutral-200/60 dark:border-neutral-800 bg-gradient-to-br from-neutral-100 to-neutral-200 dark:from-neutral-800 dark:to-neutral-900 p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <h2 className="text-lg font-semibold">{isOwn ? "Your Profile" : "Profile"}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100"
          >
            <X size={18} />
          </button>
        </div>

        {loading || !profile ? (
          <p className="mt-6 text-sm text-neutral-400">Loading…</p>
        ) : (
          <div className="mt-4">
            <div className="flex flex-col items-center">
              <div className="relative">
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt=""
                    className="h-20 w-20 rounded-full border border-neutral-300 object-cover dark:border-neutral-700"
                  />
                ) : (
                  <div className="flex h-20 w-20 items-center justify-center rounded-full bg-neutral-300 text-2xl font-semibold text-neutral-600 dark:bg-neutral-700 dark:text-neutral-300">
                    {profile.username[0]?.toUpperCase() ?? "?"}
                  </div>
                )}
                {isOwn && (
                  <>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={avatarUploading}
                      className="absolute -right-1 -bottom-1 flex h-7 w-7 items-center justify-center rounded-full bg-neutral-900 text-white shadow disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900"
                      title="Change photo"
                    >
                      <Camera size={13} />
                    </button>
                    <input ref={fileInputRef} type="file" accept="image/*" hidden onChange={handleAvatarPick} />
                  </>
                )}
              </div>

              {!isOwn && (
                <p
                  className={`mt-3 text-base font-semibold ${
                    isAdminUsername(profile.username)
                      ? "text-amber-700 dark:text-amber-400"
                      : "text-neutral-900 dark:text-neutral-100"
                  }`}
                >
                  @{profile.username}
                </p>
              )}
            </div>

            {isOwn ? (
              <form onSubmit={handleSave} className="mt-5 space-y-3">
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-neutral-500">Username</span>
                  <input
                    value={editUsername}
                    onChange={(e) => setEditUsername(e.target.value)}
                    className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-neutral-900 dark:border-neutral-700 dark:bg-neutral-950 dark:focus:ring-neutral-100"
                  />
                  {isAdminUsername(profile.username) && editUsername.trim() !== profile.username && (
                    <span className="mt-1 block text-xs text-amber-600 dark:text-amber-400">
                      Your one-letter username is what makes you an admin — changing it removes admin access.
                    </span>
                  )}
                </label>

                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-neutral-500">Bio</span>
                  <textarea
                    value={editBio}
                    onChange={(e) => setEditBio(e.target.value)}
                    rows={3}
                    maxLength={280}
                    placeholder="A little about you…"
                    className="w-full resize-none rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-neutral-900 dark:border-neutral-700 dark:bg-neutral-950 dark:focus:ring-neutral-100"
                  />
                </label>

                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-neutral-500">Instagram link</span>
                  <input
                    type="url"
                    value={editInstagram}
                    onChange={(e) => setEditInstagram(e.target.value)}
                    placeholder="https://instagram.com/…"
                    className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-neutral-900 dark:border-neutral-700 dark:bg-neutral-950 dark:focus:ring-neutral-100"
                  />
                </label>

                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-neutral-500">YouTube link</span>
                  <input
                    type="url"
                    value={editYoutube}
                    onChange={(e) => setEditYoutube(e.target.value)}
                    placeholder="https://youtube.com/@…"
                    className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-neutral-900 dark:border-neutral-700 dark:bg-neutral-950 dark:focus:ring-neutral-100"
                  />
                </label>

                {error && <p className="text-xs text-rose-600 dark:text-rose-400">{error}</p>}

                <button
                  type="submit"
                  disabled={saving}
                  className="w-full rounded-lg bg-neutral-900 px-3 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900"
                >
                  {saving ? "Saving…" : saved ? "Saved!" : "Save"}
                </button>
              </form>
            ) : (
              <div className="mt-4 space-y-3 text-center">
                {profile.bio && (
                  <p className="whitespace-pre-wrap text-sm text-neutral-600 dark:text-neutral-300">{profile.bio}</p>
                )}
                {(profile.instagram_url || profile.youtube_url) && (
                  <div className="flex items-center justify-center gap-4">
                    {profile.instagram_url && (
                      <a
                        href={profile.instagram_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-xs text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100"
                      >
                        <AtSign size={14} /> Instagram
                      </a>
                    )}
                    {profile.youtube_url && (
                      <a
                        href={profile.youtube_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-xs text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100"
                      >
                        <Video size={14} /> YouTube
                      </a>
                    )}
                  </div>
                )}
                {!profile.bio && !profile.instagram_url && !profile.youtube_url && (
                  <p className="text-xs text-neutral-400">Nothing here yet.</p>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// The header button (next to Submit a Bug) — a self-contained
// button+modal pair for viewing/editing your own profile, mirroring
// BugReportButton's own button+modal shape. Shows the signed-in user's
// own pfp (or a letter-placeholder, matching the fallback used
// everywhere else in the app) and @username in place of a generic
// "Profile" label, and stays in sync with edits made in the modal via
// onProfileChange rather than needing a page reload to reflect them.
export function ProfileButton({
  userId,
  initialUsername,
  initialAvatarPath,
}: {
  userId: string;
  initialUsername: string;
  initialAvatarPath: string | null;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [open, setOpen] = useState(false);
  const [username, setUsername] = useState(initialUsername);
  const [avatarPath, setAvatarPath] = useState(initialAvatarPath);

  const avatarUrl = avatarPath ? supabase.storage.from("avatars").getPublicUrl(avatarPath).data.publicUrl : null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 rounded-lg border border-neutral-300 px-2.5 py-1.5 text-sm font-medium hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800"
      >
        {avatarUrl ? (
          <img src={avatarUrl} alt="" className="h-5 w-5 rounded-full object-cover" />
        ) : (
          <div className="flex h-5 w-5 items-center justify-center rounded-full bg-neutral-300 text-[10px] font-semibold text-neutral-600 dark:bg-neutral-700 dark:text-neutral-300">
            {username[0]?.toUpperCase() ?? "?"}
          </div>
        )}
        @{username}
      </button>
      {open && (
        <ProfileModal
          userId={userId}
          viewerId={userId}
          onClose={() => setOpen(false)}
          onProfileChange={(p) => {
            setUsername(p.username);
            setAvatarPath(p.avatar_path);
          }}
        />
      )}
    </>
  );
}
