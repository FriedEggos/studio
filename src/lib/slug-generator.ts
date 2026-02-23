
import { customAlphabet } from 'nanoid';

// Generates a short, URL-friendly, unique-enough slug.
// e.g., "4ushlr"
const nanoid = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 6);

export function generateSlug(): string {
  return nanoid();
}
