import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getInitials(name: string): string {
  if (!name) return "??";
  const names = name.trim().split(/\s+/).filter(Boolean);
  if (names.length >= 2) {
    return `${names[0][0]}${names[1][0]}`.toUpperCase();
  }
  if (names.length === 1) {
    return names[0][0].toUpperCase();
  }
  return "??";
}

/**
 * Checks if the essential profile fields (matricId, phoneNumber, course) are filled.
 * @param userProfile The user's profile data object.
 * @returns True if the profile is complete, false otherwise.
 */
export function isProfileComplete(userProfile?: { matricId?: string | null; phoneNumber?: string | null; course?: string | null } | null): boolean {
    if (!userProfile) {
        return false;
    }
    const { matricId, phoneNumber, course } = userProfile;
    return !!(matricId && phoneNumber && course);
}
