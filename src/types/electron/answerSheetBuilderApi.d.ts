/**
 * 解答用紙作成（Answer Sheet Builder）関連API
 */

import type {
  AnswerSheetDefinition,
  ASBConvertResult,
  ASBConvertToExamArgs,
  ASBDefinitionListItem,
  ASBDeleteImageArgs,
  ASBExportPngArgs,
  ASBExportResult,
  ASBUploadImageArgs,
  ASBUploadImageResult,
} from "../answerSheetBuilder.types"

export interface AnswerSheetBuilderAPI {
  answerSheetBuilder: {
    listDefinitions: (userId: string) => Promise<{
      success: boolean
      data?: ASBDefinitionListItem[]
      error?: string
    }>
    loadDefinition: (id: string) => Promise<{
      success: boolean
      data?: AnswerSheetDefinition
      error?: string
    }>
    saveDefinition: (
      definition: AnswerSheetDefinition,
      userId: string
    ) => Promise<{ success: boolean; error?: string }>
    deleteDefinition: (
      id: string
    ) => Promise<{ success: boolean; error?: string }>
    exportPng: (args: ASBExportPngArgs) => Promise<ASBExportResult>
    selectSavePath: (options: {
      type: "pdf" | "png"
      defaultName?: string
    }) => Promise<{
      success: boolean
      filePath?: string
      canceled?: boolean
      error?: string
    }>
    convertToExam: (args: ASBConvertToExamArgs) => Promise<ASBConvertResult>
    uploadImage: (args: ASBUploadImageArgs) => Promise<ASBUploadImageResult>
    deleteImage: (
      args: ASBDeleteImageArgs
    ) => Promise<{ success: boolean; error?: string }>
    selectImportFile: () => Promise<{
      success: boolean
      filePath?: string
      canceled?: boolean
      error?: string
    }>
    exportDefinition: (
      definitionId: string
    ) => Promise<{ success: boolean; outputPath?: string; error?: string }>
    importDefinition: (
      filePath: string,
      userId: string
    ) => Promise<{
      success: boolean
      definitionId?: string
      warnings?: string[]
      error?: string
    }>
    duplicateDefinition: (
      id: string,
      userId: string
    ) => Promise<{
      success: boolean
      definitionId?: string
      error?: string
    }>
  }
}
