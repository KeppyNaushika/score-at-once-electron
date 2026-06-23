/**
 * 学級所属が在籍中かどうかを判定する。
 * 終了日が未設定、または終了日が今日以降であれば在籍中とみなす。
 */
export const isCurrentMembership = (m: { endDate?: Date | null }): boolean => {
  if (!m.endDate) return true
  return new Date(m.endDate) >= new Date()
}
