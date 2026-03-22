import { ipcRenderer } from "electron"

/** 解答用紙ビルダーのIPC API（定義CRUD・PDF/PNG出力・印刷・インポート/エクスポート） */
export function createAnswerSheetBuilderApi() {
  return {
    answerSheetBuilder: {
      listDefinitions: (userId: string) =>
        ipcRenderer.invoke("asb:list-definitions", userId),
      loadDefinition: (id: string) =>
        ipcRenderer.invoke("asb:load-definition", id),
      saveDefinition: (
        definition: import("../../src/types/answerSheetDefinition.types").AnswerSheetDefinition,
        userId: string
      ) => ipcRenderer.invoke("asb:save-definition", definition, userId),
      deleteDefinition: (id: string) =>
        ipcRenderer.invoke("asb:delete-definition", id),
      exportPdf: (
        args: import("../../src/types/answerSheetBuilder.types").ASBExportPdfArgs
      ) => ipcRenderer.invoke("asb:export-pdf", args),
      exportPng: (
        args: import("../../src/types/answerSheetBuilder.types").ASBExportPngArgs
      ) => ipcRenderer.invoke("asb:export-png", args),
      selectSavePath: (options: {
        type: "pdf" | "png"
        defaultName?: string
      }) => ipcRenderer.invoke("asb:select-save-path", options),
      convertToExam: (
        args: import("../../src/types/answerSheetBuilder.types").ASBConvertToExamArgs
      ) => ipcRenderer.invoke("asb:convert-to-exam", args),
      print: (
        args: import("../../src/types/answerSheetBuilder.types").ASBPrintArgs
      ) => ipcRenderer.invoke("asb:print", args),
      uploadImage: (
        args: import("../../src/types/answerSheetBuilder.types").ASBUploadImageArgs
      ) => ipcRenderer.invoke("asb:upload-image", args),
      deleteImage: (
        args: import("../../src/types/answerSheetBuilder.types").ASBDeleteImageArgs
      ) => ipcRenderer.invoke("asb:delete-image", args),
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
