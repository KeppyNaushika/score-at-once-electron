import { ipcRenderer } from "electron"

import type {
  ASBConvertToExamArgs,
  ASBDeleteImageArgs,
  ASBExportPdfArgs,
  ASBExportPngArgs,
  ASBPrintArgs,
  ASBUploadImageArgs,
} from "../../src/types/answerSheetBuilder.types"
import type { AnswerSheetDefinition } from "../../src/types/answerSheetDefinition.types"

/** 解答用紙ビルダーのIPC API（定義CRUD・PDF/PNG出力・印刷・インポート/エクスポート） */
export function createAnswerSheetBuilderApi() {
  return {
    answerSheetBuilder: {
      listDefinitions: (userId: string) =>
        ipcRenderer.invoke("asb:list-definitions", userId),
      loadDefinition: (id: string) =>
        ipcRenderer.invoke("asb:load-definition", id),
      saveDefinition: (definition: AnswerSheetDefinition, userId: string) =>
        ipcRenderer.invoke("asb:save-definition", definition, userId),
      deleteDefinition: (id: string) =>
        ipcRenderer.invoke("asb:delete-definition", id),
      exportPdf: (args: ASBExportPdfArgs) =>
        ipcRenderer.invoke("asb:export-pdf", args),
      exportPng: (args: ASBExportPngArgs) =>
        ipcRenderer.invoke("asb:export-png", args),
      selectSavePath: (options: {
        type: "pdf" | "png"
        defaultName?: string
      }) => ipcRenderer.invoke("asb:select-save-path", options),
      convertToExam: (args: ASBConvertToExamArgs) =>
        ipcRenderer.invoke("asb:convert-to-exam", args),
      print: (args: ASBPrintArgs) => ipcRenderer.invoke("asb:print", args),
      uploadImage: (args: ASBUploadImageArgs) =>
        ipcRenderer.invoke("asb:upload-image", args),
      deleteImage: (args: ASBDeleteImageArgs) =>
        ipcRenderer.invoke("asb:delete-image", args),
      selectImportFile: () => ipcRenderer.invoke("asb:select-import-file"),
      analyzeAsbArchive: (filePath: string) =>
        ipcRenderer.invoke("asb:analyze-asb-archive", filePath),
      exportDefinition: (definitionId: string) =>
        ipcRenderer.invoke("asb:export-definition", definitionId),
      importDefinition: (filePath: string, userId: string) =>
        ipcRenderer.invoke("asb:import-definition", filePath, userId),
      duplicateDefinition: (id: string, userId: string) =>
        ipcRenderer.invoke("asb:duplicate-definition", id, userId),
    },
  }
}
