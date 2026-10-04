import { queryOptions } from "@tanstack/react-query"

import { auditLogListKey } from "./auditLog"
import { defineMutation } from "./defineMutation"
import { scopeKeys } from "./keys"

/**
 * 統合アーカイブ（.sao）の書き出し・取り込み。
 *
 * 対応する preload は `electron-src/preload-apis/unifiedArchiveApi.ts`。
 *
 * **開く・試し取り込みはそのまま関数として出す。** ウィザードは段ごとに結果を自分の状態へ
 * 持ち、失敗もその場（モーダルの中）に出す。書き出しの下見だけは、選択が変わるたびに引き直す
 * ので `queryOptions` にする（失敗は `useQuery` の `error` をダイアログの中に出す）。DB を書かないので、書き込みの
 * 宣言（`meta`）は持たない（`archive.ts` の下見と同じ扱い）。試し取り込みは書いてから
 * ロールバックするので、DB は変わらない。
 */

// =====================================================================
// 書き出し
// =====================================================================

/**
 * 書き出す範囲の下見（件数・実体の id・外せない理由・欠けたファイル）。書き出し画面が選択を
 * 変えるたびに引く。
 *
 * 画面は選択を debounce してキーに渡す（`useDebouncedValue`）。effect で取らずに
 * `useQuery` に載せるのは、選択が続けて変わったときに古い応答が新しい結果を上書きしない
 * ため（docs/coding-style.md「データ取得は useQuery」）。DB は書かない。
 */
export const unifiedArchiveExportPreviewQuery = (
  selection: Parameters<
    typeof window.electronAPI.unifiedArchive.previewExport
  >[0]
) =>
  queryOptions({
    queryKey: ["unifiedArchive", "exportPreview", selection] as const,
    queryFn: () => window.electronAPI.unifiedArchive.previewExport(selection),
  })

/** 書き出し先を尋ねるダイアログ。選ばずに閉じたら null */
export const selectUnifiedArchiveExportPath = (defaultFileName: string) =>
  window.electronAPI.unifiedArchive.selectExportPath(defaultFileName)

/** 書き出しの段が進んだら呼ばれる購読を張る。外すのは戻り値を呼ぶ */
export const subscribeUnifiedArchiveExportProgress = (
  onProgress: Parameters<
    typeof window.electronAPI.unifiedArchive.onExportProgress
  >[0]
) => window.electronAPI.unifiedArchive.onExportProgress(onProgress)

export const exportUnifiedArchiveMutation = () =>
  defineMutation({
    mutationFn: (
      input: Parameters<typeof window.electronAPI.unifiedArchive.export>[0]
    ) => window.electronAPI.unifiedArchive.export(input),
    meta: {
      // 書き出したことは監査ログに残る＝DB を1行書く
      invalidates: [auditLogListKey],
      errorMessage: "統合アーカイブを書き出せませんでした",
    },
  })

// =====================================================================
// 取り込みの下見（DB は変わらない）
// =====================================================================

/** 取り込むファイルを尋ねるダイアログ。選ばずに閉じたら null */
export const selectUnifiedArchiveImportFile = () =>
  window.electronAPI.unifiedArchive.selectImportFile()

/** アーカイブを開いて現行化し、照合の候補を受け取る。閉じるまで main が持つ */
export const openUnifiedArchive = (archivePath: string) =>
  window.electronAPI.unifiedArchive.open({ archivePath })

/** 書いてからロールバックする試し取り込み（確認画面用） */
export const analyzeUnifiedArchiveImport = (
  input: Parameters<typeof window.electronAPI.unifiedArchive.analyze>[0]
) => window.electronAPI.unifiedArchive.analyze(input)

/** 取り込まずにウィザードを閉じたとき、main が持つ作業を消す */
export const closeUnifiedArchive = (sessionId: string) =>
  window.electronAPI.unifiedArchive.close({ sessionId })

// =====================================================================
// 取り込みの実行（DB を書く）
// =====================================================================

/**
 * 取り込む。成功したら main は作業を閉じる。
 *
 * どの表にも書きうる（試験・資料・成績算出・解答用紙定義と、その全ての子・共通の実体・
 * 選べる項目の設定）ので、取り直す先も各まとまりの前方一致で広く取る。
 */
export const importUnifiedArchiveMutation = () =>
  defineMutation({
    mutationFn: (
      input: Parameters<typeof window.electronAPI.unifiedArchive.import>[0]
    ) => window.electronAPI.unifiedArchive.import(input),
    meta: {
      invalidates: [
        ["exam"],
        ["masterMarkers"],
        ["studentAnswerImage"],
        scopeKeys.annotation(),
        ["coursework"],
        ["courseworkScores"],
        ["grade"],
        ["gradeSourceFits"],
        ["answerSheetDefinition"],
        ["students"],
        ["classrooms"],
        ["studentGradeRoster"],
        ["studentExamResults"],
        ["classroomExamResults"],
        ["tags"],
        ["users"],
        ["subtotalGroup"],
        ["appPreference"],
        ["userPreference"],
        ["userScoringStatusColor"],
        ["userClickScoringAction"],
        ["userSidePanelSection"],
        ["settings"],
        auditLogListKey,
      ],
      errorMessage: "統合アーカイブを取り込めませんでした",
    },
  })
