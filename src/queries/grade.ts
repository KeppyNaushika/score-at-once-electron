import { queryOptions } from "@tanstack/react-query"

import type { GradeReportSettings } from "@/types/gradeReport.types"

import { defineMutation } from "./defineMutation"
import { scopeKeys } from "./keys"
import { tagListQuery } from "./tag"

/**
 * 成績算出（Grade）本体の読み書き（一覧・詳細・算出結果・タグ・出力・取り込み）。
 *
 * 名簿は `gradeRoster.ts`、評価項目・データソース・境界・比較は `gradeStructure.ts`、
 * 上書き・確定・観点間の制約・除外は `gradeAdjustment.ts`。main 側のハンドラの分け方
 * （`grade*Handlers.ts`）と揃えている。
 *
 * `window.electronAPI` を書いてよいのは `src/queries/**` だけ。キーと呼び出しが
 * ここで1つに結びつくので、同じデータが別のキーで2度キャッシュされることが起きない。
 *
 * 対応する preload は `electron-src/preload-apis/gradeApi.ts`。
 */

/** 成績算出の一覧 */
export const gradeListQuery = () =>
  queryOptions({
    queryKey: ["grade", "list"] as const,
    queryFn: () => window.electronAPI.grade.getAll(),
  })

/**
 * 成績本体。評価項目・データソース・境界を子として同梱して1回で取る。
 * 03（データソース）・05（境界）・07（出力）が同じキーで共有する。
 */
export const gradeDetailQuery = (gradeId: string) =>
  queryOptions({
    queryKey: [...scopeKeys.grade(gradeId), "detail"] as const,
    queryFn: () => window.electronAPI.grade.getById(gradeId),
  })

/** 算出結果（評定・確定状態を含む） */
export const gradeResultsQuery = (gradeId: string) =>
  queryOptions({
    queryKey: [...scopeKeys.grade(gradeId), "results"] as const,
    queryFn: () => window.electronAPI.grade.calculateGrades(gradeId),
  })

/**
 * 個人成績通知書の設定（成績算出ごとに1行）。
 *
 * **行をそのまま載せる。** まだ無ければ `null` で、既定で描くのは表示側。
 */
export const gradeReportSettingsQuery = (gradeId: string) =>
  queryOptions({
    queryKey: [...scopeKeys.grade(gradeId), "reportSettings"] as const,
    queryFn: () => window.electronAPI.grade.getReportSettings(gradeId),
  })

/**
 * 出力（Excel・個人成績通知書）で使う比較の選択（成績算出 × 比較 の行）。
 *
 * **行をそのまま載せる。** 行が無い比較は既定（`DEFAULT_EXPORT_COMPARISON_ENABLED`）で
 * 決めるのは表示側。
 */
export const gradeExportComparisonsQuery = (gradeId: string) =>
  queryOptions({
    queryKey: [...scopeKeys.grade(gradeId), "exportComparisons"] as const,
    queryFn: () => window.electronAPI.grade.getExportComparisons(gradeId),
  })

/**
 * その成績に紐づくもの全部。
 *
 * 評価項目・データソース・境界・除外はどれも算出結果に効くので、1つ書けば
 * 本体も結果も古くなる。前方一致でまとめて取り直す。重い `sourceFits` は
 * この外にあるので巻き込まれない。
 */
export const gradeScope = (gradeId: string) => scopeKeys.grade(gradeId)

/** 成績算出を1件作る（id は renderer が振る。作った先の概要へ直行するため） */
export const createGradeMutation = () =>
  defineMutation({
    mutationFn: (input: { id: string; name: string; description?: string }) =>
      window.electronAPI.grade.create(input),
    meta: {
      invalidates: [gradeListQuery().queryKey],
      errorMessage: "成績算出を作成できませんでした",
    },
  })

/**
 * 成績算出1件の列を書く。
 *
 * **`scope` で直列化する。** 概要ページの名前・日付・説明は1打鍵ごとに書くので、
 * 並行に走らせると着地の順が入れ替わって古い文字が最後に残りうる。
 */
export const updateGradeMutation = (gradeId: string) =>
  defineMutation({
    mutationFn: (input: {
      name?: string
      description?: string | null
      referenceDate?: string | null
    }) => window.electronAPI.grade.update(gradeId, input),
    scope: { id: `grade:${gradeId}:detail` },
    meta: {
      invalidates: [gradeScope(gradeId), gradeListQuery().queryKey],
      errorMessage: "成績算出を保存できませんでした",
    },
  })

export const deleteGradeMutation = () =>
  defineMutation({
    mutationFn: (gradeId: string) => window.electronAPI.grade.delete(gradeId),
    meta: {
      invalidates: [gradeListQuery().queryKey],
      errorMessage: "成績算出を削除できませんでした",
    },
  })

export const duplicateGradeMutation = () =>
  defineMutation({
    mutationFn: (gradeId: string) =>
      window.electronAPI.grade.duplicate(gradeId),
    meta: {
      invalidates: [gradeListQuery().queryKey],
      errorMessage: "成績算出を複製できませんでした",
    },
  })

export const setGradeTagsMutation = (gradeId: string) =>
  defineMutation({
    mutationFn: (tagIds: string[]) =>
      window.electronAPI.grade.setTags(gradeId, tagIds),
    meta: {
      // タグ一覧は紐付けを利用先として同梱するので、そちらも古くなる
      invalidates: [gradeScope(gradeId), tagListQuery().queryKey],
      errorMessage: "タグを保存できませんでした",
    },
  })

/**
 * 選んだ成績算出へ同じタグをまとめて足す。
 *
 * 既存のタグを保ったまま1件ずつ足す（全置換すると、他端末が付けたタグを
 * 巻き添えにする）。知らせを1回にするため1つの書き込みにまとめている。
 */
export const addTagToGradesMutation = () =>
  defineMutation({
    mutationFn: async (input: { gradeIds: string[]; tagId: string }) => {
      for (const gradeId of input.gradeIds) {
        await window.electronAPI.grade.addTag(gradeId, input.tagId)
      }
    },
    meta: {
      invalidates: [gradeListQuery().queryKey],
      errorMessage: "タグを追加できませんでした",
    },
  })

/**
 * 通知書の設定を書く。**触った列だけ**を渡す。
 *
 * まるごと渡すと、続けて2つチェックを入れたときに先の1つが消える（取り直しが着地する
 * 前に、古い写しへ2度目を重ねて書くため）。この行にはヌル許容の列が無いので、
 * 載せない＝触らない、で曖昧さが無い。
 */
export const updateGradeReportSettingsMutation = (gradeId: string) =>
  defineMutation({
    mutationFn: (values: Partial<GradeReportSettings>) =>
      window.electronAPI.grade.updateReportSettings(gradeId, values),
    scope: { id: `grade:${gradeId}:reportSettings` },
    meta: {
      invalidates: [gradeReportSettingsQuery(gradeId).queryKey],
      errorMessage: "出力設定を保存できませんでした",
    },
  })

/** 比較を出力に載せるかを書く（比較1件ずつ） */
export const setGradeExportComparisonMutation = (gradeId: string) =>
  defineMutation({
    mutationFn: (selection: { gradeComparisonId: string; enabled: boolean }) =>
      window.electronAPI.grade.setExportComparison({ gradeId, ...selection }),
    scope: { id: `grade:${gradeId}:exportComparisons` },
    meta: {
      invalidates: [gradeExportComparisonsQuery(gradeId).queryKey],
      errorMessage: "出力に載せる比較を保存できませんでした",
    },
  })

export const exportGradeExcelMutation = (gradeId: string) =>
  defineMutation({
    mutationFn: (
      options: Parameters<typeof window.electronAPI.grade.exportExcel>[1]
    ) => window.electronAPI.grade.exportExcel(gradeId, options),
    meta: {
      writesDatabase: false,
      errorMessage: "Excelを出力できませんでした",
    },
  })

/**
 * .grade の中身を読んで照合の結果を返す（取り込みの下見。DB は変わらない）。取り込みの
 * 実行は `executeGradeImportMutation`。一覧の「読み込み」が失敗をその場で知らせるので、
 * 関数のまま出す
 */
export const analyzeGradeArchive = (archivePath: string) =>
  window.electronAPI.grade.analyzeArchive(archivePath)

export const executeGradeImportMutation = () =>
  defineMutation({
    mutationFn: (input: {
      archivePath: string
      options: Parameters<typeof window.electronAPI.grade.executeImport>[1]
    }) =>
      window.electronAPI.grade.executeImport(input.archivePath, input.options),
    meta: {
      invalidates: [gradeListQuery().queryKey],
      errorMessage: "成績アーカイブを取り込めませんでした",
    },
  })
