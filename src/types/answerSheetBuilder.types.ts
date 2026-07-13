/**
 * 解答用紙作成機能（Answer Sheet Builder）のIPC通信関連型定義
 *
 * 定義型は answerSheetDefinition.types.ts、
 * レイアウト計算結果型は answerSheetLayout.types.ts を参照。
 */

import type { Tag } from "@prisma/client"

import type { AnswerSheetDefinition } from "./answerSheetDefinition.types"
import type { ComputedMultiPageLayout } from "./answerSheetLayout.types"

export interface ASBExportPdfArgs {
  html: string
  outputPath: string
  pageWidthMm: number
  pageHeightMm: number
}

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

export interface ASBPrintArgs {
  html: string
  pageWidthMm: number
  pageHeightMm: number
}

export interface ASBExportResult {
  success: boolean
  filePath?: string
  error?: string
}

export interface ASBConvertResult {
  success: boolean
  examId?: string
  error?: string
}

export interface ASBUploadImageArgs {
  definitionId: string
  filePath: string
  originalName: string
}

export interface ASBUploadImageResult {
  success: boolean
  imagePath?: string // data/ からの相対パス
  error?: string
}

export interface ASBDeleteImageArgs {
  imagePath: string // data/ からの相対パス
}

export interface ASBDefinitionListItem {
  id: string
  name: string
  paperSize?: string
  orientation?: string
  questionCount?: number
  totalPoints?: number
  tags?: Tag[]
  updatedAt?: string
  createdAt?: string
}
