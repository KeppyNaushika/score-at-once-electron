/**
 * 学級所属の時期。
 *
 * - `past`: 終了日を過ぎた（過去の所属）
 * - `current`: 開始日を迎え、終了日を過ぎていない（在籍中）
 * - `upcoming`: 開始日がまだ来ていない（これから在籍する。在籍予定）
 */
export type MembershipPhase = "past" | "current" | "upcoming"

/** 時期の全部。画面に並べる順（在籍中 → 在籍予定 → 過去在籍） */
export const MEMBERSHIP_PHASES: readonly MembershipPhase[] = [
  "current",
  "upcoming",
  "past",
]

/** 時期の名前（生徒管理の一覧の絞り込み・書き出しの学級の生徒で同じ語を使う） */
export const MEMBERSHIP_PHASE_LABELS: Record<MembershipPhase, string> = {
  current: "在籍中",
  upcoming: "在籍予定",
  past: "過去在籍",
}

/** 時期の判定に要る所属の期間 */
interface MembershipPeriod {
  startDate: Date
  endDate?: Date | null
}

/**
 * 端末の暦での日付を、大小比較できる数（YYYYMMDD）にする。
 *
 * 所属の開始日・終了日は日付として入力され（`<input type="date">` の値を `new Date("YYYY-MM-DD")`
 * したもの = UTC の 0 時、日本では 9 時）、画面には `toLocaleDateString` で端末の暦の日付として
 * 出している。時刻まで比べると、終了日が「3/31」の所属は 3/31 の 9 時に終了し、開始日が「4/1」の
 * 所属は 4/1 の 9 時まで在籍予定になる — 画面に出ている日付と判定が1日のうちで食い違う。
 * そこで、画面と同じ端末の暦の日付どうしで比べる
 */
const localDayNumber = (date: Date): number =>
  date.getFullYear() * 10000 + (date.getMonth() + 1) * 100 + date.getDate()

/**
 * 学級所属の時期を判定する。日付の単位で、開始日も終了日もその日を含む
 * （開始日の当日から在籍し、終了日の当日まで在籍する）。
 *
 * @param today - 基準日。省略すると今日
 */
export const membershipPhase = (
  membership: MembershipPeriod,
  today: Date = new Date()
): MembershipPhase => {
  const todayNumber = localDayNumber(today)
  if (localDayNumber(new Date(membership.startDate)) > todayNumber) {
    return "upcoming"
  }
  if (
    membership.endDate &&
    localDayNumber(new Date(membership.endDate)) < todayNumber
  ) {
    return "past"
  }
  return "current"
}

/**
 * 学級所属が在籍中かどうか。開始日が今日以前、かつ終了日が無いか今日以降。
 * 開始日がまだ来ていない所属（在籍予定）は在籍中に数えない — 在籍予定も見せたい画面
 * （生徒管理の一覧など）は `membershipPhase` で明示的に扱う。
 */
export const isCurrentMembership = (
  membership: MembershipPeriod,
  today: Date = new Date()
): boolean => membershipPhase(membership, today) === "current"

/** 時期の並び順（在籍中 → 在籍予定 → 過去） */
const MEMBERSHIP_PHASE_ORDER: Record<MembershipPhase, number> = {
  current: 0,
  upcoming: 1,
  past: 2,
}

/** 時期で並べるための比較（在籍中 → 在籍予定 → 過去。同じ時期は元の順を保つ） */
export const compareMembershipPhase = (
  phaseA: MembershipPhase,
  phaseB: MembershipPhase
): number => MEMBERSHIP_PHASE_ORDER[phaseA] - MEMBERSHIP_PHASE_ORDER[phaseB]

/** 学級の所属・成績分析の絞り込み */
export const MEMBERSHIP_STATUS_FILTERS = ["all", "current", "ended"] as const

export type MembershipStatusFilter = (typeof MEMBERSHIP_STATUS_FILTERS)[number]

export const MEMBERSHIP_STATUS_FILTER_OPTIONS: {
  statusFilter: MembershipStatusFilter
  label: string
}[] = [
  { statusFilter: "all", label: "すべて" },
  { statusFilter: "current", label: "在籍中" },
  { statusFilter: "ended", label: "終了済み" },
]

/**
 * 時期が絞り込みに合うか。在籍予定は「すべて」でだけ出る（在籍中でも終了済みでもない）
 */
export const matchesMembershipStatusFilter = (
  phase: MembershipPhase,
  statusFilter: MembershipStatusFilter
): boolean => {
  if (statusFilter === "current") return phase === "current"
  if (statusFilter === "ended") return phase === "past"
  return true
}
