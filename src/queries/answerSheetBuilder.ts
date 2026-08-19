import { queryOptions } from "@tanstack/react-query"

import { auditLogListKey } from "./auditLog"
import { defineMutation } from "./defineMutation"
import { examListQuery } from "./exam"
import { scopeKeys } from "./keys"

/**
 * 解答用紙（AsbDefinition）の読み書き。
 *
 * 対応する preload は `electron-src/preload-apis/answerSheetBuilderApi.ts`。
 * 解答用紙に付けるタグは `tag.ts` が持つ（タグ側の一覧も古くなるため）。
 *
 * **定義1件は今も1本の大きな塊として往復する。** 実体ごとに割るのは段階15〜17。
 * ここはその前段として、往復の口を1箇所に集めるところまでを持つ。
 */

// =====================================================================
// 取得
// =====================================================================

/** 一覧（誰の解答用紙も出る。自分の分だけを見る絞り込みは表示側） */
export const answerSheetDefinitionListQuery = () =>
  queryOptions({
    queryKey: ["answerSheetDefinition", "list"] as const,
    queryFn: () => window.electronAPI.answerSheetBuilder.listDefinitions(),
  })

/** 解答用紙定義そのもの（概要・編集・書き出し・パンくずが共有する） */
export const answerSheetDefinitionQuery = (definitionId: string) =>
  queryOptions({
    queryKey: [
      ...scopeKeys.answerSheetDefinition(definitionId),
      "detail",
    ] as const,
    queryFn: () =>
      window.electronAPI.answerSheetBuilder.loadDefinition(definitionId),
  })

/**
 * その解答用紙の担当者。
 *
 * 編集・削除ができるのは担当者ひとりだけで、他の利用者は閲覧と書き出しだけができる。
 */
export const answerSheetDefinitionOwnerQuery = (definitionId: string) =>
  queryOptions({
    queryKey: [
      ...scopeKeys.answerSheetDefinition(definitionId),
      "owner",
    ] as const,
    queryFn: () => window.electronAPI.answerSheetBuilder.getOwner(definitionId),
  })

// =====================================================================
// 書き込み
// =====================================================================

const listKey = answerSheetDefinitionListQuery().queryKey

/**
 * 新しい定義を1件作る。
 *
 * 保存と同じ口（`saveDefinition`）だが、取り直す先は一覧だけ。作ったばかりの
 * 解答用紙にはまだ何もキャッシュが無いので、そのまとまりを指す意味が無い。
 */
export const createAnswerSheetDefinitionMutation = () =>
  defineMutation({
    mutationFn: (input: {
      definition: Parameters<
        typeof window.electronAPI.answerSheetBuilder.saveDefinition
      >[0]
      userId: string
    }) =>
      window.electronAPI.answerSheetBuilder.saveDefinition(
        input.definition,
        input.userId
      ),
    meta: {
      invalidates: [listKey],
      errorMessage: "解答用紙を作成できませんでした",
    },
  })

/**
 * 定義1件を丸ごと保存する。
 *
 * 保存すると、その解答用紙に紐づくもの（本体・担当）も一覧の要約（名前・設問数・
 * 更新日時）も古くなるので、どちらも取り直す。編集画面は読み込んだ内容を自分の
 * 状態として持っている（種を蒔くのは1度だけ）ので、取り直しで編集は巻き戻らない。
 */
export const saveAnswerSheetDefinitionMutation = (definitionId: string) =>
  defineMutation({
    mutationFn: (input: {
      definition: Parameters<
        typeof window.electronAPI.answerSheetBuilder.saveDefinition
      >[0]
      userId: string
    }) =>
      window.electronAPI.answerSheetBuilder.saveDefinition(
        input.definition,
        input.userId
      ),
    scope: { id: `answerSheetDefinition:${definitionId}` },
    meta: {
      invalidates: [scopeKeys.answerSheetDefinition(definitionId), listKey],
      errorMessage: "解答用紙を保存できませんでした",
    },
  })

export const deleteAnswerSheetDefinitionMutation = () =>
  defineMutation({
    mutationFn: (input: { definitionId: string; userId: string }) =>
      window.electronAPI.answerSheetBuilder.deleteDefinition(
        input.definitionId,
        input.userId
      ),
    meta: {
      invalidates: [listKey],
      errorMessage: "解答用紙を削除できませんでした",
    },
  })

export const duplicateAnswerSheetDefinitionMutation = () =>
  defineMutation({
    mutationFn: (input: { definitionId: string; userId: string }) =>
      window.electronAPI.answerSheetBuilder.duplicateDefinition(
        input.definitionId,
        input.userId
      ),
    meta: {
      invalidates: [listKey],
      errorMessage: "解答用紙を複製できませんでした",
    },
  })

/**
 * 担当を別の利用者へ渡す（渡せるのは今の担当者だけ）。
 *
 * 担当が変わると一覧だけでなく `owner`（誰が担当か）も `detail`（編集画面が読む
 * 本体）も古くなる。一覧しか取り直さないと、譲った直後に開き直した画面が自分を
 * 担当だと信じたまま編集を受け付け、保存で弾かれて編集が消える。
 */
export const transferAnswerSheetDefinitionOwnerMutation = (
  definitionId: string
) =>
  defineMutation({
    mutationFn: (input: { currentUserId: string; nextUserId: string }) =>
      window.electronAPI.answerSheetBuilder.transferOwner(
        definitionId,
        input.currentUserId,
        input.nextUserId
      ),
    meta: {
      invalidates: [scopeKeys.answerSheetDefinition(definitionId), listKey],
      errorMessage: "担当を渡せませんでした",
    },
  })

/** 書き出したファイルから定義を作る */
export const importAnswerSheetDefinitionMutation = () =>
  defineMutation({
    mutationFn: (input: { filePath: string; userId: string }) =>
      window.electronAPI.answerSheetBuilder.importDefinition(
        input.filePath,
        input.userId
      ),
    meta: {
      invalidates: [listKey],
      errorMessage: "解答用紙を読み込めませんでした",
    },
  })

/** 解答用紙から試験を作る（模範解答ページまで作られる） */
export const convertAnswerSheetToExamMutation = (userId: string | undefined) =>
  defineMutation({
    mutationFn: (
      args: Parameters<
        typeof window.electronAPI.answerSheetBuilder.convertToExam
      >[0]
    ) => window.electronAPI.answerSheetBuilder.convertToExam(args),
    meta: {
      invalidates: [examListQuery(userId).queryKey],
      errorMessage: "試験に変換できませんでした",
    },
  })

// =====================================================================
// DB を書かない操作
// =====================================================================

/** 保存先を尋ねるダイアログ */
export const selectAnswerSheetSavePathMutation = () =>
  defineMutation({
    mutationFn: (
      options: Parameters<
        typeof window.electronAPI.answerSheetBuilder.selectSavePath
      >[0]
    ) => window.electronAPI.answerSheetBuilder.selectSavePath(options),
    meta: {
      writesDatabase: false,
      errorMessage: "保存先を選べませんでした",
    },
  })

/** 読み込むファイルを尋ねるダイアログ */
export const selectAnswerSheetImportFileMutation = () =>
  defineMutation({
    mutationFn: () => window.electronAPI.answerSheetBuilder.selectImportFile(),
    meta: {
      writesDatabase: false,
      errorMessage: "ファイルを選べませんでした",
    },
  })

/** HTML を PNG にして書き出す */
export const exportAnswerSheetPngMutation = () =>
  defineMutation({
    mutationFn: (
      args: Parameters<
        typeof window.electronAPI.answerSheetBuilder.exportPng
      >[0]
    ) => window.electronAPI.answerSheetBuilder.exportPng(args),
    meta: {
      writesDatabase: false,
      errorMessage: "PNGを出力できませんでした",
    },
  })

/** 定義をファイルへ書き出す */
export const exportAnswerSheetDefinitionMutation = () =>
  defineMutation({
    mutationFn: (definitionId: string) =>
      window.electronAPI.answerSheetBuilder.exportDefinition(definitionId),
    meta: {
      // 書き出したことは監査ログに残る＝DB を1行書く
      invalidates: [auditLogListKey],
      errorMessage: "解答用紙を書き出せませんでした",
    },
  })

/**
 * セルに置く画像を取り込む。
 *
 * 入るのは data ディレクトリのファイルで、DB には触れない。相対パスが返り、
 * それを定義へ書き込むのは定義の保存（`saveAnswerSheetDefinitionMutation`）。
 */
export const uploadAnswerSheetImageMutation = () =>
  defineMutation({
    mutationFn: (
      args: Parameters<
        typeof window.electronAPI.answerSheetBuilder.uploadImage
      >[0]
    ) => window.electronAPI.answerSheetBuilder.uploadImage(args),
    meta: {
      writesDatabase: false,
      errorMessage: "画像を取り込めませんでした",
    },
  })

/** 取り込んだ画像の実体を消す（定義からの参照を外すのは定義の保存） */
export const deleteAnswerSheetImageMutation = () =>
  defineMutation({
    mutationFn: (
      args: Parameters<
        typeof window.electronAPI.answerSheetBuilder.deleteImage
      >[0]
    ) => window.electronAPI.answerSheetBuilder.deleteImage(args),
    meta: {
      writesDatabase: false,
      errorMessage: "画像を削除できませんでした",
    },
  })
