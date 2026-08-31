// Same fixed accounts/passwords the original app has always used, ported
// as-is from its api/_lib/auth.js -- no user-management system, sign-up
// flow, or per-user secrets beyond this. Checked server-side here so
// credentials never reach the database directly.
const USERS = [
  { offer: "Alex", password: "Alex123" },
  { offer: "Adriel", password: "Adriel123" },
  { offer: "Des", password: "Des123" },
];

export function findSalesBoardUser(offer: unknown, password: unknown) {
  if (typeof offer !== "string" || typeof password !== "string") return null;
  return (
    USERS.find(
      (u) => u.offer.toLowerCase() === offer.trim().toLowerCase() && u.password === password
    ) || null
  );
}
