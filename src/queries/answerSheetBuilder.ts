import { queryOptions } from "@tanstack/react-query"

import { assertNever } from "@/lib/assertNever"
import type {
  AnswerSheetDefinition,
  AnswerSheetEditAction,
  AsbCellParent,
} from "@/types/answerSheetDefinition.types"

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
 * **書き込みは実体ごとに割ってある。** 画面の編集1つが1レコードの書き込み1本になり、
 * 触っていないレコードの値は IPC に載らない。木をまるごと運ぶ `replace` は、全体を
 * 指定することに意味がある4経路（新規作成・undo/redo・複製・取り込み）だけが使う。
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
 * main が実際に書いた原稿用紙の行。
 *
 * 原稿用紙はセルと1対1なので、main は既にそのセルに行があればその id を使い続ける
 * （`setAsbManuscriptPaperEnabled`）。画面が振った id と食い違うことがあるので、書いた
 * 行の id を返して画面が自分の木を直せるようにする。
 */
interface WrittenManuscriptPaper {
  parent: AsbCellParent
  manuscriptPaperId: string
}

/**
 * 編集の意図を、対応する1レコードの書き込みへ写す。**書き込みの関所**。
 *
 * `switch` は `AnswerSheetEditAction` を網羅する。action を1つ足して書き込みを書かなければ
 * `assertNever` が型検査で落ちるので、**片方だけ足した状態を作れない**（action と書き込みを
 * 二重に持つ設計の唯一の危険がこれで、同期の除外一覧では実際に2度破れている）。
 *
 * **値を返すのは原稿用紙のオンオフだけ**（原稿用紙の行を作るのはこの1経路で、他は書いた
 * 行の id が画面の指定と必ず一致する）。
 */
async function writeAnswerSheetEdit(
  definitionId: string,
  action: AnswerSheetEditAction
): Promise<WrittenManuscriptPaper | void> {
  const asb = window.electronAPI.answerSheetBuilder
  switch (action.type) {
    case "UPDATE_DEFINITION":
      return asb.updateDefinition(definitionId, action.payload.attributes)
    case "APPLY_LABEL_PRESET":
      return asb.applyLabelPreset(
        definitionId,
        action.payload.category,
        action.payload.preset,
        action.payload.relabeled
      )

    case "ADD_HEADER_FIELD":
      return asb.createHeaderField(definitionId, action.payload.headerField)
    case "UPDATE_HEADER_FIELD":
      return asb.updateHeaderField(
        definitionId,
        action.payload.headerFieldId,
        action.payload.attributes
      )
    case "DELETE_HEADER_FIELD":
      return asb.deleteHeaderField(definitionId, action.payload.headerFieldId)
    case "REORDER_HEADER_FIELDS":
      return asb.reorderHeaderFields(definitionId, action.payload.orderedIds)

    case "ADD_MAJOR_QUESTION":
      return asb.createMajorQuestion(definitionId, action.payload.majorQuestion)
    case "UPDATE_MAJOR_QUESTION":
      return asb.updateMajorQuestion(
        definitionId,
        action.payload.majorQuestionId,
        action.payload.attributes
      )
    case "DELETE_MAJOR_QUESTION":
      return asb.deleteMajorQuestion(
        definitionId,
        action.payload.majorQuestionId
      )
    case "REORDER_MAJOR_QUESTIONS":
      return asb.reorderMajorQuestions(definitionId, action.payload.orderedIds)

    case "ADD_SUB_QUESTION":
      return asb.createSubQuestion(
        definitionId,
        action.payload.majorQuestionId,
        action.payload.subQuestion
      )
    case "UPDATE_SUB_QUESTION":
      return asb.updateSubQuestion(
        definitionId,
        action.payload.subQuestionId,
        action.payload.attributes
      )
    case "DELETE_SUB_QUESTION":
      return asb.deleteSubQuestion(definitionId, action.payload.subQuestionId)
    case "REORDER_SUB_QUESTIONS":
      return asb.reorderSubQuestions(
        definitionId,
        action.payload.majorQuestionId,
        action.payload.orderedIds
      )

    case "ADD_BRANCH_QUESTION":
      return asb.createBranchQuestion(
        definitionId,
        action.payload.subQuestionId,
        action.payload.branchQuestion
      )
    case "UPDATE_BRANCH_QUESTION":
      return asb.updateBranchQuestion(
        definitionId,
        action.payload.branchQuestionId,
        action.payload.attributes
      )
    case "DELETE_BRANCH_QUESTION":
      return asb.deleteBranchQuestion(
        definitionId,
        action.payload.branchQuestionId
      )
    case "REORDER_BRANCH_QUESTIONS":
      return asb.reorderBranchQuestions(
        definitionId,
        action.payload.subQuestionId,
        action.payload.orderedIds
      )

    case "ADD_TEXT_ELEMENT":
      return asb.createTextElement(
        definitionId,
        action.payload.parent,
        action.payload.textElement
      )
    case "UPDATE_TEXT_ELEMENT":
      return asb.updateTextElement(
        definitionId,
        action.payload.textElementId,
        action.payload.attributes
      )
    case "DELETE_TEXT_ELEMENT":
      return asb.deleteTextElement(definitionId, action.payload.textElementId)

    case "ADD_IMAGE_ELEMENT":
      return asb.createImageElement(
        definitionId,
        action.payload.parent,
        action.payload.imageElement
      )
    case "UPDATE_IMAGE_ELEMENT":
      return asb.updateImageElement(
        definitionId,
        action.payload.imageElementId,
        action.payload.attributes
      )
    case "DELETE_IMAGE_ELEMENT":
      return asb.deleteImageElement(definitionId, action.payload.imageElementId)

    case "SET_MANUSCRIPT_PAPER_ENABLED": {
      const manuscriptPaperId = await asb.setManuscriptPaperEnabled(
        definitionId,
        action.payload.parent,
        action.payload.manuscriptPaperId,
        action.payload.enabled
      )
      return { parent: action.payload.parent, manuscriptPaperId }
    }
    case "UPDATE_MANUSCRIPT_PAPER":
      return asb.updateManuscriptPaper(
        definitionId,
        action.payload.manuscriptPaperId,
        action.payload.attributes
      )

    case "ADD_CHAR_GUIDE":
      return asb.createCharGuide(
        definitionId,
        action.payload.manuscriptPaperId,
        action.payload.charGuide
      )
    case "UPDATE_CHAR_GUIDE":
      return asb.updateCharGuide(
        definitionId,
        action.payload.charGuideId,
        action.payload.attributes
      )
    case "DELETE_CHAR_GUIDE":
      return asb.deleteCharGuide(definitionId, action.payload.charGuideId)

    case "UPSERT_OMR_CONFIG":
      return asb.upsertOmrConfig(
        definitionId,
        action.payload.parent,
        action.payload.config
      )
    case "DELETE_OMR_CONFIG":
      return asb.deleteOmrConfig(definitionId, action.payload.parent)

    default:
      return assertNever(action)
  }
}

/**
 * 編集を1つ書く。
 *
 * 書く先のテーブルは action ごとに違うが、**取り直す先は同じ**（その解答用紙のまとまりと
 * 一覧の要約）なので、宣言は1つで足りる。行き先が同じ＝`mutationKey` も同じなので、
 * 連続した編集の取り直しは最後の1つにまとまる。
 *
 * `scope` を付けてあるのは順番のため。TanStack は同じ `scope` の書き込みを直列に実行する
 * ので、「足す → その属性を書く」が入れ替わらない。
 *
 * 原稿用紙のオンオフだけは**書いた行**を返す。呼び出し側はその id を木へ取り込む。
 */
export const applyAnswerSheetEditMutation = (definitionId: string) =>
  defineMutation({
    mutationFn: (action: AnswerSheetEditAction) =>
      writeAnswerSheetEdit(definitionId, action),
    scope: { id: `answerSheetDefinition:${definitionId}` },
    meta: {
      invalidates: [scopeKeys.answerSheetDefinition(definitionId), listKey],
      errorMessage: "解答用紙を保存できませんでした",
    },
  })

/**
 * 解答用紙を丸ごと置き換える。
 *
 * 使ってよいのは**全体を指定することに意味がある**経路だけ — undo / redo（過去の姿）と、
 * 新規作成・複製・取り込み（まだ無いものを丸ごと置く）。日常の編集をここへ流すと、触って
 * いないレコードの値まで載り、同期で先へ進んだ相手の編集を巻き戻す。
 */
export const replaceAnswerSheetDefinitionMutation = (definitionId: string) =>
  defineMutation({
    mutationFn: (input: {
      definition: AnswerSheetDefinition
      userId: string
    }) =>
      window.electronAPI.answerSheetBuilder.replaceDefinition(
        input.definition,
        input.userId
      ),
    scope: { id: `answerSheetDefinition:${definitionId}` },
    meta: {
      invalidates: [scopeKeys.answerSheetDefinition(definitionId), listKey],
      errorMessage: "解答用紙を保存できませんでした",
    },
  })

/**
 * 新しい定義を1件作る。
 *
 * 木をまるごと置く経路（`replace`）だが、取り直す先は一覧だけ。作ったばかりの
 * 解答用紙にはまだ何もキャッシュが無いので、そのまとまりを指す意味が無い。
 */
export const createAnswerSheetDefinitionMutation = () =>
  defineMutation({
    mutationFn: (input: {
      definition: AnswerSheetDefinition
      userId: string
    }) =>
      window.electronAPI.answerSheetBuilder.replaceDefinition(
        input.definition,
        input.userId
      ),
    meta: {
      invalidates: [listKey],
      errorMessage: "解答用紙を作成できませんでした",
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
