/**
 * @fileoverview 監査ログのアクションカタログ
 * @description Discord風監査ログで記録する全アクションの一元定義。
 *   アクションキーは `domain.entity.verb` 形式の名前空間付き文字列。
 *   記録側（`electron-src/lib/prisma/auditLog.ts`）はこのカタログから category と
 *   サマリ用ラベルを解決し、表示側（renderer）は verb でアイコンを分け、操作種別の
 *   絞り込みを action の集合へ展開する。両側が同じ表を引くので `src/lib/shared/` に置く
 *   （renderer は `electron-src/` を値で import できない）。
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

/** アクションの種別（アイコン・色分け・操作種別の絞り込み用） */
export const AUDIT_VERBS = [
  "create",
  "update",
  "delete",
  "export",
  "import",
  "other",
] as const
export type AuditVerb = (typeof AUDIT_VERBS)[number]

/**
 * 監査ログの対象（`AuditLogTarget.targetType`）の種類。
 *
 * 記録側がこの名前で書き、絞り込みの欄（生徒・採点領域）がこの名前で引く。
 * 値はテーブル名にそろえる（`AuditLog.entityType` と同じ流儀）。
 */
export const AUDIT_TARGET_TYPES = ["Student", "CropRegion"] as const
export type AuditTargetType = (typeof AUDIT_TARGET_TYPES)[number]

interface AuditActionDef {
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
const AUDIT_ACTIONS = {
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
  "exam.page.replace": {
    category: "exam",
    verb: "update",
    label: "模範解答ページの画像を差し替えました",
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
  "exam.score.comment": {
    category: "exam",
    verb: "update",
    label: "採点に覚え書きを残しました",
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
  "exam.student.assign": {
    category: "exam",
    verb: "create",
    label: "生徒の採点担当を割り当てました",
  },
  "exam.student.unassign": {
    category: "exam",
    verb: "delete",
    label: "生徒の採点担当を解除しました",
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

  // ── AI 採点（docs/vlm-grading-design.md）。送り先の事業者・モデルは metadata に入る。
  //    キーや送った本文は残さない
  "exam.ai_prompt.create": {
    category: "exam",
    verb: "create",
    label: "AI 採点のプロンプトを作成しました",
  },
  "exam.ai_prompt.revise": {
    category: "exam",
    verb: "other",
    label: "AI にプロンプトの改訂を依頼しました",
  },
  "exam.ai_grading.run": {
    category: "exam",
    verb: "other",
    label: "答案を AI 採点に送りました",
  },
  "exam.ai_grading.adopt": {
    category: "exam",
    verb: "update",
    label: "AI の判定を採点に採用しました",
  },
  "exam.ai_grading.adopt_blank": {
    category: "exam",
    verb: "update",
    label: "白紙の答案を無答にしました",
  },
  "exam.ai_grading.delete_attempts": {
    category: "exam",
    verb: "delete",
    label: "AI の古い判定を消しました",
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
  /** 個人成績表の小計点テーブル／箱ひげ図に載せる小計グループの選択 */
  "subtotal_group.selection_update": {
    category: "exam",
    verb: "update",
    label: "個人成績表に載せる小計グループを更新しました",
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
  "grade.boundary.create": {
    category: "grade",
    verb: "create",
    label: "評価の境界を追加しました",
  },
  "grade.boundary.update": {
    category: "grade",
    verb: "update",
    label: "境界設定を更新しました",
  },
  "grade.boundary.replace": {
    category: "grade",
    verb: "update",
    label: "評価の境界をまとめて置き換えました",
  },
  "grade.boundary.deleteAll": {
    category: "grade",
    verb: "delete",
    label: "評価の境界をすべて削除しました",
  },
  "grade.boundary.delete": {
    category: "grade",
    verb: "delete",
    label: "境界セットを削除しました",
  },
  "grade.comparison.create": {
    category: "grade",
    verb: "create",
    label: "成績項目「{target}」に比較を追加しました",
  },
  "grade.comparison.delete": {
    category: "grade",
    verb: "delete",
    label: "成績項目「{target}」の比較を削除しました",
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
  "coursework.letterScale.create": {
    category: "grade",
    verb: "create",
    label: "文字評価の刻み「{target}」を追加しました",
  },
  "coursework.letterScale.update": {
    category: "grade",
    verb: "update",
    label: "文字評価の刻み「{target}」を編集しました",
  },
  "coursework.letterScale.delete": {
    category: "grade",
    verb: "delete",
    label: "文字評価の刻み「{target}」を削除しました",
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

  // ── システム（system） ───────────────────────────────────────
  /**
   * データベース移行時に、試験の受験者として登録されていない生徒の採点データ
   * （孤児）を破棄したことの記録。migration SQL から直接 INSERT される。
   */
  "system.migration.cleanup_orphaned_scores": {
    category: "system",
    verb: "delete",
    label: "{target}",
  },
  /**
   * 統合アーカイブ（.sao）の書き出し。試験・資料・成績算出・解答用紙定義をまたぐので
   * どの作業領域にも属さない。`entityId` は出力ファイル名、metadata に選んだ根の件数・
   * 外した行の件数・欠けたファイルの数が入る。
   */
  "archive.unified.export": {
    category: "system",
    verb: "export",
    label: "統合アーカイブ「{target}」を書き出しました",
  },
  /**
   * 統合アーカイブ（.sao）の取り込み。`entityId` はアーカイブの書き出し日時
   * （manifest.exportedAt）、metadata に方針と、表をまたいだ件数の合計が入る。
   */
  "archive.unified.import": {
    category: "system",
    verb: "import",
    label: "統合アーカイブ「{target}」を取り込みました",
  },
  /**
   * 操作履歴を残す期間の変更。全員で1つの設定（`AppPreference`）なので作業領域に
   * 属さない。記録しないと「なぜ去年の記録が無いのか」を後から追えない。
   * `entityId` は設定のキー、changes に変更前後の期間が入る。
   */
  "system.audit_log_retention.update": {
    category: "system",
    verb: "update",
    label: "操作履歴を残す期間を変更しました",
  },
  /**
   * AI 採点（実験的機能）の事業者への同意（設計 §9-1）。同意は端末ごとの設定ファイルに
   * 記録し、ここにも残す。`entityId` は事業者 id、metadata に同意文の版が入る。
   * **キーや同意文の本文は残さない。**
   */
  "ai_grading.consent": {
    category: "system",
    verb: "other",
    label: "AI採点（実験的機能）の送信先「{target}」への同意を記録しました",
  },
  /** AI 採点の同意の取り消し。その端末に保存した API キーも消える */
  "ai_grading.consent_revoked": {
    category: "system",
    verb: "other",
    label: "AI採点（実験的機能）の送信先「{target}」への同意を取り消しました",
  },
  /**
   * NAS同期が、別id・同一ユニークキーの行を1つへ「畳んだ」ことの記録（**過去の記録専用**）。
   *
   * sqlite-nas-sync v0.19.0 までは、かぶった行の片方を物理的に消し、子を残った側へ
   * 付け替えていた。v0.20.0 で畳みそのものが無くなったので、**新しくは書かない**。
   * 監査ログは同期で全端末へ渡り2年残るため、それまでに書かれた行を読めるように
   * 定義だけ残す（意味が違う新しい出来事は `sync.duplicate.hide` へ分けた）。
   */
  "sync.merge": {
    category: "system",
    verb: "delete",
    label: "同期で重複していた{target}を1つにまとめました",
  },
  /**
   * NAS同期で、別id・同一ユニークキーの行がかぶり、片方を**隠した**ことの記録。
   *
   * ユニーク制約がある以上、両方を同時には表示できないので、利用者は止められない。
   * **何も消していない** — 隠した行の事実はライブラリの帳簿に残っていて、表示している
   * 方が無くなれば次の同期で表示に戻る（`sync.duplicate.restore`）。だから verb は
   * `delete` ではない。何と何がかぶったかは metadata の `losingId`（隠した側。
   * `entityId` と同じ）/ `winningId`（表示している側）に入る。
   */
  "sync.duplicate.hide": {
    category: "system",
    verb: "other",
    label: "同期で重複していた{target}の片方を隠しました",
  },
  /**
   * NAS同期で隠していた行が、**表示に戻った**ことの記録。
   *
   * 表示していた方が削除された・隠れていた方が他端末で新しく書かれて版の順序が
   * 入れ替わったなどで、隠れる理由が無くなったとき。
   * metadata の `losingId` は戻った側（`entityId` と同じ）、`winningId` は隠れていた間に
   * 表示されていた側。
   */
  "sync.duplicate.restore": {
    category: "system",
    verb: "other",
    label: "同期で隠していた{target}を表示に戻しました",
  },
  /**
   * NAS同期で、親が他のPCで削除されていたため、そこへぶら下がる行を**表から外した**
   * ことの記録。
   *
   * 親の削除と並行して、こちらで子を書き足していた場合に起きる。**何も消していない** —
   * 子の版はライブラリの帳簿に残っていて、親が同じ id で作り直されれば表へ戻る
   * （`sync.parent_deleted.restore`）。だから verb は `delete` ではない。
   *
   * 1回の同期で数百行出うるので、**削除された親1つにつき1行**にまとめる。対象
   * （`entityType` / `entityId`）は削除された親（孫なら大元）で、metadata の
   * `causeTable` / `causeId` も同じ。外れた行は `records`（テーブル名と id）、
   * 件数は `count` と `countByTable` に入る。
   */
  "sync.parent_deleted.hide": {
    category: "system",
    verb: "other",
    label:
      "他のPCで{target}が削除されていたため、ぶら下がる行を表示から外しました",
  },
  /**
   * NAS同期で、削除されていた親が作り直され、外していた行が**表示に戻った**ことの記録。
   * metadata の形は `sync.parent_deleted.hide` と同じ。
   */
  "sync.parent_deleted.restore": {
    category: "system",
    verb: "other",
    label: "他のPCで{target}が作り直されたため、外していた行を表示に戻しました",
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

/**
 * その種別に当たる定義済みのアクションキー。
 *
 * DB に verb の列は無いので、操作種別での絞り込みは renderer がここで action の集合へ
 * 展開して main へ渡す（main に導出を持ち込まない。docs/audit-log-redesign.md）。
 */
export const auditActionKeysOfVerb = (verb: AuditVerb): string[] =>
  Object.entries(AUDIT_ACTIONS)
    .filter(([, def]) => def.verb === verb)
    .map(([action]) => action)

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
