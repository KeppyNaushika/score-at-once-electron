import type {} from "../../src/types/answerSheetBuilder.types"
import { bind } from "./invoke"

/**
 * 解答用紙ビルダーのIPC API。
 *
 * 書き込みは**実体 × 操作**で割ってある（大問を1つ足す・小問の属性を書く・並べ替える）。
 * 1本の大きな保存に戻さないこと — 触っていないレコードまで載せると、同期で先へ進んだ
 * 相手の編集を巻き戻す（docs/asb-ipc-split-plan.md §4.0）。
 *
 * `replaceDefinition` だけが木をまるごと運ぶ。使ってよいのは新規作成・undo/redo・
 * 複製・アーカイブ取り込みの4経路（同 §4.5）。
 */
export function createAnswerSheetBuilderApi() {
  return {
    answerSheetBuilder: {
      listDefinitions: bind("asb:list-definitions"),
      loadDefinition: bind("asb:load-definition"),
      replaceDefinition: bind("asb:replace-definition"),
      deleteDefinition: bind("asb:delete-definition"),
      getOwner: bind("asb:get-owner"),
      transferOwner: bind("asb:transfer-owner"),
      exportPng: bind("asb:export-png"),
      selectSavePath: bind("asb:select-save-path"),
      convertToExam: bind("asb:convert-to-exam"),
      uploadImage: bind("asb:upload-image"),
      deleteImage: bind("asb:delete-image"),
      selectImportFile: bind("asb:select-import-file"),
      exportDefinition: bind("asb:export-definition"),
      importDefinition: bind("asb:import-definition"),
      duplicateDefinition: bind("asb:duplicate-definition"),

      // 1件ずつの書き込み
      updateDefinition: bind("asb:update-definition"),
      applyLabelPreset: bind("asb:apply-label-preset"),

      createHeaderField: bind("asb:create-header-field"),
      updateHeaderField: bind("asb:update-header-field"),
      deleteHeaderField: bind("asb:delete-header-field"),
      reorderHeaderFields: bind("asb:reorder-header-fields"),

      createMajorQuestion: bind("asb:create-major-question"),
      updateMajorQuestion: bind("asb:update-major-question"),
      deleteMajorQuestion: bind("asb:delete-major-question"),
      reorderMajorQuestions: bind("asb:reorder-major-questions"),

      createSubQuestion: bind("asb:create-sub-question"),
      updateSubQuestion: bind("asb:update-sub-question"),
      deleteSubQuestion: bind("asb:delete-sub-question"),
      reorderSubQuestions: bind("asb:reorder-sub-questions"),

      createBranchQuestion: bind("asb:create-branch-question"),
      updateBranchQuestion: bind("asb:update-branch-question"),
      deleteBranchQuestion: bind("asb:delete-branch-question"),
      reorderBranchQuestions: bind("asb:reorder-branch-questions"),

      createTextElement: bind("asb:create-text-element"),
      updateTextElement: bind("asb:update-text-element"),
      deleteTextElement: bind("asb:delete-text-element"),

      createImageElement: bind("asb:create-image-element"),
      updateImageElement: bind("asb:update-image-element"),
      deleteImageElement: bind("asb:delete-image-element"),

      upsertManuscriptPaper: bind("asb:upsert-manuscript-paper"),
      deleteManuscriptPaper: bind("asb:delete-manuscript-paper"),

      createCharGuide: bind("asb:create-char-guide"),
      updateCharGuide: bind("asb:update-char-guide"),
      deleteCharGuide: bind("asb:delete-char-guide"),

      upsertOmrConfig: bind("asb:upsert-omr-config"),
      deleteOmrConfig: bind("asb:delete-omr-config"),
    },
  }
}
