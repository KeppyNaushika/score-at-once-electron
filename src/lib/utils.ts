import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

/** クラス名を結合する（clsx + tailwind-merge） */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
