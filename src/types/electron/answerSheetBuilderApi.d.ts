/**
 * 解答用紙作成（Answer Sheet Builder）関連API
 */

import type {
  AnswerSheetDefinition,
  ASBConvertToExamArgs,
  ASBDefinitionListItem,
  ASBDeleteImageArgs,
  ASBExportPngArgs,
  ASBUploadImageArgs,
} from "../answerSheetBuilder.types"

export interface AnswerSheetBuilderAPI {
  answerSheetBuilder: {
    listDefinitions: (userId: string) => Promise<ASBDefinitionListItem[]>
    loadDefinition: (id: string) => Promise<AnswerSheetDefinition>
    saveDefinition: (
      definition: AnswerSheetDefinition,
      userId: string
    ) => Promise<void>
    deleteDefinition: (id: string) => Promise<void>
    /** 書き出したファイルのパス（複数ページのときは連番の先頭） */
    exportPng: (args: ASBExportPngArgs) => Promise<string>
    /** 選ばずに閉じた場合は canceled で返る（失敗ではない） */
    selectSavePath: (options: {
      type: "pdf" | "png"
      defaultName?: string
    }) => Promise<{ canceled: true } | { canceled: false; filePath: string }>
    /** できた試験の id */
    convertToExam: (args: ASBConvertToExamArgs) => Promise<string>
    /** data/ からの相対パス */
    uploadImage: (args: ASBUploadImageArgs) => Promise<string>
    deleteImage: (args: ASBDeleteImageArgs) => Promise<void>
    /** 選ばずに閉じた場合は canceled で返る（失敗ではない） */
    selectImportFile: () => Promise<
      { canceled: true } | { canceled: false; filePath: string }
    >
    /** 保存先を選ばずに閉じた場合は canceled で返る（失敗ではない） */
    exportDefinition: (
      definitionId: string
    ) => Promise<{ canceled: true } | { canceled: false; outputPath: string }>
    importDefinition: (
      filePath: string,
      userId: string
    ) => Promise<{ definitionId: string; warnings: string[] }>
    /** 複製してできた定義の id */
    duplicateDefinition: (id: string, userId: string) => Promise<string>
  }
}
