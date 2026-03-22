/**
 * 解答用紙作成（Answer Sheet Builder）関連API
 */
export interface AnswerSheetBuilderAPI {
  answerSheetBuilder: {
    listDefinitions: (userId: string) => Promise<{
      success: boolean
      data?: import("../answerSheetBuilder.types").ASBDefinitionListItem[]
      error?: string
    }>
    loadDefinition: (id: string) => Promise<{
      success: boolean
      data?: import("../answerSheetBuilder.types").AnswerSheetDefinition
      error?: string
    }>
    saveDefinition: (
      definition: import("../answerSheetBuilder.types").AnswerSheetDefinition,
      userId: string
    ) => Promise<{ success: boolean; error?: string }>
    deleteDefinition: (
      id: string
    ) => Promise<{ success: boolean; error?: string }>
    exportPdf: (
      args: import("../answerSheetBuilder.types").ASBExportPdfArgs
    ) => Promise<import("../answerSheetBuilder.types").ASBExportResult>
    exportPng: (
      args: import("../answerSheetBuilder.types").ASBExportPngArgs
    ) => Promise<import("../answerSheetBuilder.types").ASBExportResult>
    selectSavePath: (options: {
      type: "pdf" | "png"
      defaultName?: string
    }) => Promise<{
      success: boolean
      filePath?: string
      canceled?: boolean
      error?: string
    }>
    convertToExam: (
      args: import("../answerSheetBuilder.types").ASBConvertToExamArgs
    ) => Promise<import("../answerSheetBuilder.types").ASBConvertResult>
    print: (
      args: import("../answerSheetBuilder.types").ASBPrintArgs
    ) => Promise<{ success: boolean; error?: string }>
    uploadImage: (
      args: import("../answerSheetBuilder.types").ASBUploadImageArgs
    ) => Promise<import("../answerSheetBuilder.types").ASBUploadImageResult>
    deleteImage: (
      args: import("../answerSheetBuilder.types").ASBDeleteImageArgs
    ) => Promise<{ success: boolean; error?: string }>
    selectImportFile: () => Promise<{
      success: boolean
      filePath?: string
      canceled?: boolean
      error?: string
    }>
    analyzeAsbArchive: (filePath: string) => Promise<{
      success: boolean
      manifest?: import("../asbArchive.types").AsbArchiveManifest
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
