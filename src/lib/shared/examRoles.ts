/**
 * 試験の参加者のロールと、ロールごとに入れる段（docs/scoring-scope-and-permissions-design.md §3-3）。
 *
 * 全実体共通の3ロール（docs/ownership-and-sharing-design.md §3.1）を試験にも使う。試験の
 * EDITOR が変えられる「内容」は採点データで、試験の構成（01-06）は OWNER だけが変える。
 *
 * | ロール | 01-06 | 07 採点 | 08 採点確定 | 09 結果出力                    |
 * | ------ | ----- | ------- | ----------- | ------------------------------ |
 * | OWNER  | ✅    | ✅      | ✅          | ✅                             |
 * | EDITOR | ✗     | ✅      | ✗           | `canExportResults`（既定は可） |
 * | VIEWER | ✗     | ✗       | ✗           | ✅                             |
 *
 * **これは権限境界ではない。** 採点者の手元に DB があるので止められない。作業導線から
 * 採点以外を外し、誤って準備段階を壊さないようにするだけである（同 §2-4）。
 * main（ロールの変更）と renderer（段の出し分け）の両方が引くので `src/lib/shared/` に置く。
 */

export const EXAM_ROLES = ["OWNER", "EDITOR", "VIEWER"] as const
export type ExamRole = (typeof EXAM_ROLES)[number]

/** 画面と監査ログの文言で使う名前。試験では EDITOR は採点する人なので「採点者」と呼ぶ */
export const EXAM_ROLE_LABELS: Record<ExamRole, string> = {
  OWNER: "オーナー",
  EDITOR: "採点者",
  VIEWER: "閲覧者",
}

/** ロールでできること（メンバー管理の説明に出す） */
export const EXAM_ROLE_DESCRIPTIONS: Record<ExamRole, string> = {
  OWNER:
    "すべての段を使える。試験の設定、参加者の招待・役割の変更、採点担当の割り当て、採点の確定ができる。複数人にできる",
  EDITOR:
    "「7. 採点」と、許可されていれば「9. 結果出力」を使える。試験の設定は変えられない",
  VIEWER: "「9. 結果出力」だけを使える。採点はしない",
}

/** DB の文字列がロールか（旧値や壊れた値は null として扱う） */
export const parseExamRole = (role: string): ExamRole | null =>
  EXAM_ROLES.find((examRole) => examRole === role) ?? null

/** 試験の段の id（`examWorkflowSteps` の id）。概要は `detail` */
type ExamStepId = string

/** 参加者が誰でも入れる段（概要は試験の入口なので、誰でも開ける） */
const DETAIL_STEP_ID = "detail"
const SCORING_STEP_ID = "07-score-at-once"
const EXPORT_STEP_ID = "09-export"

/**
 * その参加者が入れる段か。
 *
 * - OWNER はすべて
 * - EDITOR は概要・07・（`canExportResults` なら）09
 * - VIEWER は概要・09
 */
export const canEnterExamStep = (
  member: { role: ExamRole; canExportResults: boolean },
  stepId: ExamStepId
): boolean => {
  if (member.role === "OWNER") return true
  if (stepId === DETAIL_STEP_ID) return true
  if (stepId === EXPORT_STEP_ID) {
    return member.role === "VIEWER" || member.canExportResults
  }
  return member.role === "EDITOR" && stepId === SCORING_STEP_ID
}
