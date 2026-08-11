import type {} from "../../src/types/answerSheetBuilder.types"
import { bind } from "./invoke"

/** 解答用紙ビルダーのIPC API（定義CRUD・PNG出力・画像・インポート/エクスポート） */
export function createAnswerSheetBuilderApi() {
  return {
    answerSheetBuilder: {
      listDefinitions: bind("asb:list-definitions"),
      loadDefinition: bind("asb:load-definition"),
      saveDefinition: bind("asb:save-definition"),
      deleteDefinition: bind("asb:delete-definition"),
      exportPng: bind("asb:export-png"),
      selectSavePath: bind("asb:select-save-path"),
      convertToExam: bind("asb:convert-to-exam"),
      uploadImage: bind("asb:upload-image"),
      deleteImage: bind("asb:delete-image"),
      selectImportFile: bind("asb:select-import-file"),
      exportDefinition: bind("asb:export-definition"),
      importDefinition: bind("asb:import-definition"),
      duplicateDefinition: bind("asb:duplicate-definition"),
    },
  }
}
