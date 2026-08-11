import type {
  ASBConvertToExamArgs,
  ASBDeleteImageArgs,
  ASBExportPngArgs,
  ASBUploadImageArgs,
} from "../../src/types/answerSheetBuilder.types"
import type { AnswerSheetDefinition } from "../../src/types/answerSheetDefinition.types"
import { invoke } from "./invoke"

/** 解答用紙ビルダーのIPC API（定義CRUD・PNG出力・画像・インポート/エクスポート） */
export function createAnswerSheetBuilderApi() {
  return {
    answerSheetBuilder: {
      listDefinitions: (userId: string) =>
        invoke("asb:list-definitions", userId),
      loadDefinition: (id: string) => invoke("asb:load-definition", id),
      saveDefinition: (definition: AnswerSheetDefinition, userId: string) =>
        invoke("asb:save-definition", definition, userId),
      deleteDefinition: (id: string) => invoke("asb:delete-definition", id),
      exportPng: (args: ASBExportPngArgs) => invoke("asb:export-png", args),
      selectSavePath: (options: {
        type: "pdf" | "png"
        defaultName?: string
      }) => invoke("asb:select-save-path", options),
      convertToExam: (args: ASBConvertToExamArgs) =>
        invoke("asb:convert-to-exam", args),
      uploadImage: (args: ASBUploadImageArgs) =>
        invoke("asb:upload-image", args),
      deleteImage: (args: ASBDeleteImageArgs) =>
        invoke("asb:delete-image", args),
      selectImportFile: () => invoke("asb:select-import-file"),
      exportDefinition: (definitionId: string) =>
        invoke("asb:export-definition", definitionId),
      importDefinition: (filePath: string, userId: string) =>
        invoke("asb:import-definition", filePath, userId),
      duplicateDefinition: (id: string, userId: string) =>
        invoke("asb:duplicate-definition", id, userId),
    },
  }
}
