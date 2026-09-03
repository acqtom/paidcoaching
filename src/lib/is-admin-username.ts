// Matches is_admin() in supabase/migrations/0009_communications.sql:
// admin status is purely "the username is one character", nothing else.
// Shared by anything that needs to render admin-vs-regular styling
// client-side (Communications, the profile viewer/editor) -- the real
// security boundary is always the database's own is_admin(), RLS
// policies, and the username-length trigger in 0015_profiles.sql; this
// is only ever used for display.
export function isAdminUsername(name: string): boolean {
  return name.length === 1;
}
