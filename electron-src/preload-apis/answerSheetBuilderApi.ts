import { ipcRenderer } from "electron"

import type {
  ASBConvertToExamArgs,
  ASBDeleteImageArgs,
  ASBExportPngArgs,
  ASBUploadImageArgs,
} from "../../src/types/answerSheetBuilder.types"
import type { AnswerSheetDefinition } from "../../src/types/answerSheetDefinition.types"

/** 解答用紙ビルダーのIPC API（定義CRUD・PNG出力・画像・インポート/エクスポート） */
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
      exportPng: (args: ASBExportPngArgs) =>
        ipcRenderer.invoke("asb:export-png", args),
      selectSavePath: (options: {
        type: "pdf" | "png"
        defaultName?: string
      }) => ipcRenderer.invoke("asb:select-save-path", options),
      convertToExam: (args: ASBConvertToExamArgs) =>
        ipcRenderer.invoke("asb:convert-to-exam", args),
      uploadImage: (args: ASBUploadImageArgs) =>
        ipcRenderer.invoke("asb:upload-image", args),
      deleteImage: (args: ASBDeleteImageArgs) =>
        ipcRenderer.invoke("asb:delete-image", args),
      selectImportFile: () => ipcRenderer.invoke("asb:select-import-file"),
      exportDefinition: (definitionId: string) =>
        ipcRenderer.invoke("asb:export-definition", definitionId),
      importDefinition: (filePath: string, userId: string) =>
        ipcRenderer.invoke("asb:import-definition", filePath, userId),
      duplicateDefinition: (id: string, userId: string) =>
        ipcRenderer.invoke("asb:duplicate-definition", id, userId),
    },
  }
}
