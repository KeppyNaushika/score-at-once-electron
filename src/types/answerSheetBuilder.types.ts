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
  htmlPages: string[]
  outputPath: string
  dpi: number
  pageWidthMm: number
  pageHeightMm: number
}

export interface ASBConvertToExamArgs {
  definition: AnswerSheetDefinition
  userId: string
  multiPageLayout: ComputedMultiPageLayout
  answerSheetHtmlPages: string[]
  modelAnswerHtmlPages: string[]
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
