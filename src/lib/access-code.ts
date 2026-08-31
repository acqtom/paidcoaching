// Excludes visually-ambiguous characters (0/O, 1/I/L) since this gets typed
// in by hand by someone on their phone. Shared by every feature that offers
// no-login team access via a secret key (Weekly Content Hub, Sales Team
// Board) -- each feature's own table carries its own access_code column, so
// codes are unique per-feature, not globally.
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 5;

export function generateAccessCode(): string {
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return code;
}
