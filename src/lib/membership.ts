/**
 * 学級所属が在籍中かどうかを判定する。
 * 終了日が未設定、または終了日が今日以降であれば在籍中とみなす。
 */
export const isCurrentMembership = (m: { endDate?: Date | null }): boolean => {
  if (!m.endDate) return true
  return new Date(m.endDate) >= new Date()
}

/** 学級の所属・成績分析の絞り込み */
export type MembershipStatusFilter = "all" | "current" | "ended"

export const MEMBERSHIP_STATUS_FILTER_OPTIONS: {
  statusFilter: MembershipStatusFilter
  label: string
}[] = [
  { statusFilter: "all", label: "すべて" },
  { statusFilter: "current", label: "在籍中" },
  { statusFilter: "ended", label: "終了済み" },
]

export const matchesMembershipStatusFilter = (
  isCurrent: boolean,
  statusFilter: MembershipStatusFilter
): boolean => {
  if (statusFilter === "current") return isCurrent
  if (statusFilter === "ended") return !isCurrent
  return true
}
