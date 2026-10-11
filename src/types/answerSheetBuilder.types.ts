/**
 * 解答用紙作成機能（Answer Sheet Builder）のIPC通信関連型定義
 *
 * 定義型は answerSheetDefinition.types.ts、
 * レイアウト計算結果型は answerSheetLayout.types.ts を参照。
 */

import type { Tag } from "@prisma/client"

import type { AnswerSheetDefinition } from "./answerSheetDefinition.types"
import type { ComputedMultiPageLayout } from "./answerSheetLayout.types"

export interface ASBExportPngArgs {
  /** ページの PNG（renderer で描いたもの）。2ページ以上なら `-1` `-2`… を付けて別のファイルにする */
  pngPages: Uint8Array[]
  outputPath: string
}

export interface ASBConvertToExamArgs {
  definition: AnswerSheetDefinition
  userId: string
  multiPageLayout: ComputedMultiPageLayout
  /** 答案の雛形・模範解答のページの PNG（renderer で描いたもの、ページ順） */
  answerSheetPngPages: Uint8Array[]
  modelAnswerPngPages: Uint8Array[]
}

export interface ASBUploadImageArgs {
  definitionId: string
  filePath: string
  originalName: string
}

export interface ASBDeleteImageArgs {
  imagePath: string // data/ からの相対パス
}

export interface ASBDefinitionListItem {
  id: string
  name: string
  /** 説明（任意）。一覧では名前セルの2行目に出す */
  description?: string | null
  /**
   * この解答用紙がいつのものか（任意）。一覧では「使用日」として出す。
   * 境界を越えるときに ISO 文字列になる（`listAsbDefinitions`）。
   */
  referenceDate?: string | null
  /** 担当者（この解答用紙を編集できる唯一の利用者） */
  ownerId: string
  ownerName: string
  paperSize?: string
  orientation?: string
  questionCount?: number
  totalPoints?: number
  tags?: Tag[]
  updatedAt?: string
  createdAt?: string
}
