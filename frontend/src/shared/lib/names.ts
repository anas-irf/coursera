/** "Ada Lovelace" -> "AL", "ada" -> "A", "" -> "?" (at most two letters). */
export function initials(name: string | null | undefined): string {
  const words = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  const letters = words.length === 1 ? words[0][0] : words[0][0] + words[words.length - 1][0];
  return letters.toUpperCase();
}

/** The parts of a user record a display name is made of. */
export interface Nameable {
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
}

/** A person's name from the parts a user record has, falling back to the e-mail address. */
export function fullName(person: Nameable | null | undefined, fallback = ''): string {
  if (!person) return fallback;
  const name = `${person.first_name || ''} ${person.last_name || ''}`.trim();
  return name || person.email || fallback;
}
