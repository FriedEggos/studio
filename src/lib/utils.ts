import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getInitials(name: string): string {
  if (!name) return "??";
  const names = name.trim().split(' ');
  if (names.length > 1) {
    const firstInitial = names[0][0] || '';
    const lastInitial = names[names.length - 1][0] || '';
    return `${firstInitial}${lastInitial}`.toUpperCase();
  }
  return name.substring(0, 2).toUpperCase();
}
