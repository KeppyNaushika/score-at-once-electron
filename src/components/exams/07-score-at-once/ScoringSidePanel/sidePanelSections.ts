/**
 * サイドパネルの折りたたみ状態。
 *
 * 保存文字列を閉じているセクションIDの集合へ倒す純粋関数。壊れていれば全展開に戻す。
 */
export function toCollapsedSections(
  stored: string | null
): ReadonlySet<string> {
  if (!stored) return new Set()

  try {
    const parsed: unknown = JSON.parse(stored)
    if (!Array.isArray(parsed)) return new Set()
    return new Set(parsed.filter((item) => typeof item === "string"))
  } catch {
    return new Set()
  }
}
