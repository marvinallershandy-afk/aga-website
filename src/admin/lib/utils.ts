import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

// shadcn-Standard-Helper: bedingte Klassen mergen (Tailwind-Konflikte auflösen).
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
