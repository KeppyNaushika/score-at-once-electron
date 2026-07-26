/**
 * @fileoverview 監査ログのアクションカタログ
 * @description Discord風監査ログで記録する全アクションの一元定義。
 *   アクションキーは `domain.entity.verb` 形式の名前空間付き文字列。
 *   記録側（auditLog.ts）はこのカタログから category とサマリ用ラベルを解決し、
 *   表示側（UI）は category / verb でフィルタ・アイコン分けを行う。
 *
 *   ※閲覧（read/view）は記録対象外。状態を変える操作とエクスポートのみを定義する。
 */

/** 監査ログのカテゴリ（作業領域単位。UIフィルタの最上位軸） */
export type AuditCategory =
  | "exam" // 試験
  | "grade" // 成績
  | "answer_sheet" // 解答用紙作成
  | "student" // 生徒・学級・小計グループ
  | "user" // ユーザー・権限
  | "system" // システム・その他

/** アクションの種別（アイコン・色分け用） */
export type AuditVerb =
  "create" | "update" | "delete" | "export" | "import" | "other"

export interface AuditActionDef {
  category: AuditCategory
  verb: AuditVerb
  /**
   * サマリ用の日本語ラベル。`{target}` は対象ラベル（scopeLabel/target）に置換される。
   * 操作者名は含めない（UIが actor を前置して文を組み立てる）。
   */
  label: string
}

/**
 * 全アクションの定義表。網羅的に対応できるよう主要ドメインを定義する。
 * 新しい操作を計装する際はここにキーを追加する（これが記録の契約）。
 */
export const AUDIT_ACTIONS = {
  // ── 試験（exam） ─────────────────────────────────────────────
  "exam.create": {
    category: "exam",
    verb: "create",
    label: "試験「{target}」を作成しました",
  },
  "exam.update": {
    category: "exam",
    verb: "update",
    label: "試験「{target}」を編集しました",
  },
  "exam.delete": {
    category: "exam",
    verb: "delete",
    label: "試験「{target}」を削除しました",
  },
  "exam.export": {
    category: "exam",
    verb: "export",
    label: "試験「{target}」をエクスポートしました",
  },
  "exam.import": {
    category: "exam",
    verb: "import",
    label: "試験「{target}」をインポートしました",
  },

  "exam.page.upload": {
    category: "exam",
    verb: "create",
    label: "模範解答ページをアップロードしました",
  },
  "exam.page.delete": {
    category: "exam",
    verb: "delete",
    label: "模範解答ページを削除しました",
  },
  "exam.page.reorder": {
    category: "exam",
    verb: "update",
    label: "模範解答ページを並び替えました",
  },

  "exam.region.create": {
    category: "exam",
    verb: "create",
    label: "採点領域を作成しました",
  },
  "exam.region.update": {
    category: "exam",
    verb: "update",
    label: "採点領域を編集しました",
  },
  "exam.region.delete": {
    category: "exam",
    verb: "delete",
    label: "採点領域を削除しました",
  },
  "exam.region_info.update": {
    category: "exam",
    verb: "update",
    label: "領域情報を更新しました",
  },

  "exam.question_group.create": {
    category: "exam",
    verb: "create",
    label: "設問グループ「{target}」を作成しました",
  },
  "exam.question_group.update": {
    category: "exam",
    verb: "update",
    label: "設問グループ「{target}」を編集しました",
  },
  "exam.question_group.delete": {
    category: "exam",
    verb: "delete",
    label: "設問グループ「{target}」を削除しました",
  },

  "exam.student.add": {
    category: "exam",
    verb: "create",
    label: "受験生徒「{target}」を追加しました",
  },
  "exam.student.remove": {
    category: "exam",
    verb: "delete",
    label: "受験生徒「{target}」を削除しました",
  },
  "exam.student.attendance_update": {
    category: "exam",
    verb: "update",
    label: "「{target}」の受験状態を変更しました",
  },
  "exam.student.reorder": {
    category: "exam",
    verb: "update",
    label: "受験生徒の並び順を変更しました",
  },

  "exam.answer.upload": {
    category: "exam",
    verb: "create",
    label: "生徒答案をアップロードしました",
  },
  "exam.answer.assign": {
    category: "exam",
    verb: "update",
    label: "生徒答案を割り当てました",
  },
  "exam.answer.delete": {
    category: "exam",
    verb: "delete",
    label: "生徒答案を削除しました",
  },

  "exam.score.propose": {
    category: "exam",
    verb: "create",
    label: "採点を提案しました",
  },
  "exam.score.update": {
    category: "exam",
    verb: "update",
    label: "採点提案を変更しました",
  },
  "exam.score.decide": {
    category: "exam",
    verb: "update",
    label: "採点を確定しました",
  },
  "exam.score.delete": {
    category: "exam",
    verb: "delete",
    label: "採点提案を削除しました",
  },
  "exam.score.batch": {
    category: "exam",
    verb: "update",
    label: "採点を一括反映しました",
  },
  "exam.score.export_unresolved": {
    category: "exam",
    verb: "export",
    label: "未解決の食い違いを含む採点結果を出力しました",
  },
  "exam.score.assign": {
    category: "exam",
    verb: "create",
    label: "設問の採点担当を割り当てました",
  },
  "exam.score.unassign": {
    category: "exam",
    verb: "delete",
    label: "設問の採点担当を解除しました",
  },

  "exam.annotation.create": {
    category: "exam",
    verb: "create",
    label: "採点マークを追加しました",
  },
  "exam.annotation.update": {
    category: "exam",
    verb: "update",
    label: "採点マークを編集しました",
  },
  "exam.annotation.delete": {
    category: "exam",
    verb: "delete",
    label: "採点マークを削除しました",
  },

  "exam.return.capture": {
    category: "exam",
    verb: "export",
    label: "返却版として記録しました",
  },

  "exam.marking_format.update": {
    category: "exam",
    verb: "update",
    label: "採点マーク設定を更新しました",
  },
  "exam.export_settings.update": {
    category: "exam",
    verb: "update",
    label: "出力設定を更新しました",
  },
  "exam.class.assign": {
    category: "exam",
    verb: "create",
    label: "学級「{target}」を試験に割り当てました",
  },
  "exam.class.unassign": {
    category: "exam",
    verb: "delete",
    label: "学級の試験割り当てを解除しました",
  },
  "exam.subtotal_assignment.update": {
    category: "exam",
    verb: "update",
    label: "設問と小計の対応を更新しました",
  },
  "exam.omr_config.update": {
    category: "exam",
    verb: "update",
    label: "OMR設定を更新しました",
  },
  "exam.compound_answer.update": {
    category: "exam",
    verb: "update",
    label: "複合解答スコアを更新しました",
  },
  "exam.region.reorder": {
    category: "exam",
    verb: "update",
    label: "採点領域を並び替えました",
  },

  "exam.user.invite": {
    category: "exam",
    verb: "create",
    label: "「{target}」を試験に招待しました",
  },
  "exam.user.role_update": {
    category: "exam",
    verb: "update",
    label: "「{target}」の試験ロールを変更しました",
  },
  "exam.user.remove": {
    category: "exam",
    verb: "delete",
    label: "「{target}」を試験から外しました",
  },

  // ── 成績（grade） ────────────────────────────────────────────
  "grade.create": {
    category: "grade",
    verb: "create",
    label: "成績「{target}」を作成しました",
  },
  "grade.update": {
    category: "grade",
    verb: "update",
    label: "成績「{target}」を編集しました",
  },
  "grade.delete": {
    category: "grade",
    verb: "delete",
    label: "成績「{target}」を削除しました",
  },
  "grade.duplicate": {
    category: "grade",
    verb: "create",
    label: "成績「{target}」を複製しました",
  },
  "grade.export": {
    category: "grade",
    verb: "export",
    label: "成績「{target}」をエクスポートしました",
  },
  "grade.import": {
    category: "grade",
    verb: "import",
    label: "成績「{target}」をインポートしました",
  },

  "grade.student.add": {
    category: "grade",
    verb: "create",
    label: "成績対象生徒「{target}」を追加しました",
  },
  "grade.student.remove": {
    category: "grade",
    verb: "delete",
    label: "成績対象生徒「{target}」を削除しました",
  },
  "grade.data_source.add": {
    category: "grade",
    verb: "create",
    label: "データソースを追加しました",
  },
  "grade.data_source.update": {
    category: "grade",
    verb: "update",
    label: "データソースを更新しました",
  },
  "grade.data_source.remove": {
    category: "grade",
    verb: "delete",
    label: "データソースを削除しました",
  },
  "grade.manual_score.update": {
    category: "grade",
    verb: "update",
    label: "手動スコアを更新しました",
  },
  "grade.boundary.update": {
    category: "grade",
    verb: "update",
    label: "境界設定を更新しました",
  },
  "grade.boundary.delete": {
    category: "grade",
    verb: "delete",
    label: "境界セットを削除しました",
  },
  "grade.item.create": {
    category: "grade",
    verb: "create",
    label: "成績項目「{target}」を作成しました",
  },
  "grade.item.update": {
    category: "grade",
    verb: "update",
    label: "成績項目「{target}」を編集しました",
  },
  "grade.item.delete": {
    category: "grade",
    verb: "delete",
    label: "成績項目「{target}」を削除しました",
  },
  "grade.override.delete": {
    category: "grade",
    verb: "delete",
    label: "成績の上書きを削除しました",
  },
  "grade.item.reorder": {
    category: "grade",
    verb: "update",
    label: "成績項目の並び順を変更しました",
  },
  "grade.student.reorder": {
    category: "grade",
    verb: "update",
    label: "成績対象生徒の並び順を変更しました",
  },
  "grade.override.update": {
    category: "grade",
    verb: "update",
    label: "成績の上書きを更新しました",
  },
  "grade.frozenScore.freeze": {
    category: "grade",
    verb: "update",
    label: "成績値を確定しました",
  },
  "grade.frozenScore.unfreeze": {
    category: "grade",
    verb: "delete",
    label: "成績値の確定を解除しました",
  },
  "grade.constraint.create": {
    category: "grade",
    verb: "create",
    label: "観点間の制約ルールを作成しました",
  },
  "grade.constraint.update": {
    category: "grade",
    verb: "update",
    label: "観点間の制約ルールを更新しました",
  },
  "grade.constraint.delete": {
    category: "grade",
    verb: "delete",
    label: "観点間の制約ルールを削除しました",
  },

  // ── 試験外成績資料（coursework） ─────────────────────────────
  "coursework.create": {
    category: "grade",
    verb: "create",
    label: "試験外成績資料「{target}」を作成しました",
  },
  "coursework.update": {
    category: "grade",
    verb: "update",
    label: "試験外成績資料「{target}」を編集しました",
  },
  "coursework.delete": {
    category: "grade",
    verb: "delete",
    label: "試験外成績資料「{target}」を削除しました",
  },
  "coursework.student.add": {
    category: "grade",
    verb: "create",
    label: "資料対象生徒を追加しました",
  },
  "coursework.student.remove": {
    category: "grade",
    verb: "delete",
    label: "資料対象生徒を削除しました",
  },
  "coursework.student.reorder": {
    category: "grade",
    verb: "update",
    label: "資料対象生徒の並び順を変更しました",
  },
  "coursework.item.create": {
    category: "grade",
    verb: "create",
    label: "評価項目「{target}」を作成しました",
  },
  "coursework.item.update": {
    category: "grade",
    verb: "update",
    label: "評価項目「{target}」を編集しました",
  },
  "coursework.item.delete": {
    category: "grade",
    verb: "delete",
    label: "評価項目「{target}」を削除しました",
  },
  "coursework.score.update": {
    category: "grade",
    verb: "update",
    label: "資料の点数を更新しました",
  },
  "coursework.export": {
    category: "grade",
    verb: "export",
    label: "試験外成績資料「{target}」をエクスポートしました",
  },
  "coursework.import": {
    category: "grade",
    verb: "import",
    label: "試験外成績資料「{target}」をインポートしました",
  },

  // ── 解答用紙作成（answer_sheet） ─────────────────────────────
  "answer_sheet.create": {
    category: "answer_sheet",
    verb: "create",
    label: "解答用紙「{target}」を作成しました",
  },
  "answer_sheet.update": {
    category: "answer_sheet",
    verb: "update",
    label: "解答用紙「{target}」を編集しました",
  },
  "answer_sheet.delete": {
    category: "answer_sheet",
    verb: "delete",
    label: "解答用紙「{target}」を削除しました",
  },
  "answer_sheet.export": {
    category: "answer_sheet",
    verb: "export",
    label: "解答用紙「{target}」をエクスポートしました",
  },
  "answer_sheet.import": {
    category: "answer_sheet",
    verb: "import",
    label: "解答用紙「{target}」をインポートしました",
  },

  // ── 生徒・学級・小計グループ（student） ──────────────────────
  "student.create": {
    category: "student",
    verb: "create",
    label: "生徒「{target}」を登録しました",
  },
  "student.update": {
    category: "student",
    verb: "update",
    label: "生徒「{target}」を編集しました",
  },
  "student.delete": {
    category: "student",
    verb: "delete",
    label: "生徒「{target}」を削除しました",
  },
  "student.import": {
    category: "student",
    verb: "import",
    label: "生徒をインポートしました",
  },
  "student.export": {
    category: "student",
    verb: "export",
    label: "生徒をエクスポートしました",
  },

  "class.create": {
    category: "student",
    verb: "create",
    label: "学級「{target}」を作成しました",
  },
  "class.update": {
    category: "student",
    verb: "update",
    label: "学級「{target}」を編集しました",
  },
  "class.delete": {
    category: "student",
    verb: "delete",
    label: "学級「{target}」を削除しました",
  },
  "class.membership.add": {
    category: "student",
    verb: "create",
    label: "「{target}」を学級に追加しました",
  },
  "class.membership.remove": {
    category: "student",
    verb: "delete",
    label: "「{target}」を学級から削除しました",
  },

  "subtotal_group.create": {
    category: "student",
    verb: "create",
    label: "小計グループ「{target}」を作成しました",
  },
  "subtotal_group.update": {
    category: "student",
    verb: "update",
    label: "小計グループ「{target}」を編集しました",
  },
  "subtotal_group.delete": {
    category: "student",
    verb: "delete",
    label: "小計グループ「{target}」を削除しました",
  },

  "tag.create": {
    category: "student",
    verb: "create",
    label: "タグ「{target}」を作成しました",
  },
  "tag.update": {
    category: "student",
    verb: "update",
    label: "タグ「{target}」を編集しました",
  },
  "tag.delete": {
    category: "student",
    verb: "delete",
    label: "タグ「{target}」を削除しました",
  },
  "tag.reorder": {
    category: "student",
    verb: "update",
    label: "タグの並び順を変更しました",
  },

  // ── ユーザー・権限（user） ───────────────────────────────────
  "user.create": {
    category: "user",
    verb: "create",
    label: "ユーザー「{target}」を作成しました",
  },
  "user.update": {
    category: "user",
    verb: "update",
    label: "ユーザー「{target}」を編集しました",
  },
  "user.delete": {
    category: "user",
    verb: "delete",
    label: "ユーザー「{target}」を削除しました",
  },
} as const satisfies Record<string, AuditActionDef>

/** 定義済みアクションキーの型 */
export type AuditActionKey = keyof typeof AUDIT_ACTIONS

/** 未知アクション用のフォールバック定義 */
const FALLBACK_ACTION: AuditActionDef = {
  category: "system",
  verb: "other",
  label: "{target}",
}

/** アクションキーから定義を取得（未知のキーはフォールバック） */
export const getAuditActionDef = (action: string): AuditActionDef => {
  return (
    (AUDIT_ACTIONS as Record<string, AuditActionDef>)[action] ?? FALLBACK_ACTION
  )
}

/** サマリ文字列を生成（{target} を対象ラベルに置換） */
export const buildAuditSummary = (
  action: string,
  target?: string | null
): string => {
  const def = getAuditActionDef(action)
  const label = def.label
  if (label.includes("{target}")) {
    return label.replace("{target}", target ?? "（不明）")
  }
  return target ? `${label}（${target}）` : label
}
