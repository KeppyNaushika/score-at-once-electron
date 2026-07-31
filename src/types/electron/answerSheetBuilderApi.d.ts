/**
 * 解答用紙作成（Answer Sheet Builder）関連API
 */

import type {
  AnswerSheetDefinition,
  ASBConvertResult,
  ASBConvertToExamArgs,
  ASBDefinitionListItem,
  ASBDeleteImageArgs,
  ASBExportPdfArgs,
  ASBExportPngArgs,
  ASBExportResult,
  ASBPrintArgs,
  ASBUploadImageArgs,
  ASBUploadImageResult,
} from "../answerSheetBuilder.types"
import type { AsbArchiveManifest } from "../asbArchive.types"

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
    exportPdf: (args: ASBExportPdfArgs) => Promise<ASBExportResult>
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
    print: (args: ASBPrintArgs) => Promise<{ success: boolean; error?: string }>
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
    analyzeAsbArchive: (filePath: string) => Promise<{
      success: boolean
      manifest?: AsbArchiveManifest
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
