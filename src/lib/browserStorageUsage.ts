/**
 * web 版のブラウザの保存領域の量の見せ方（起動時の知らせと、設定の「ブラウザの保存領域」）。
 */

/** 上限に対してこの割合を超えたら、残りが少ないと知らせる */
const NEARLY_FULL_RATIO = 0.8

export const isStorageNearlyFull = (usage: number, quota: number): boolean =>
  quota > 0 && usage / quota >= NEARLY_FULL_RATIO

/** バイト数を「1.2 GB」の形にする（1000 ではなく 1024 で繰り上げる） */
export function formatStorageBytes(bytes: number): string {
  const units = ["B", "KB", "MB", "GB", "TB"]
  const exponent = Math.min(
    units.length - 1,
    Math.max(0, Math.floor(Math.log(Math.max(bytes, 1)) / Math.log(1024)))
  )
  const scaled = bytes / 1024 ** exponent
  const digits = exponent === 0 || scaled >= 100 ? 0 : 1
  return `${scaled.toFixed(digits)} ${units[exponent]}`
}
