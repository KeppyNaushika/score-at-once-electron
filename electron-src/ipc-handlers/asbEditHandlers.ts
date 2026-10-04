/**
 * 解答用紙の編集（実体 × 操作の1件ずつの書き込み）のIPCハンドラー
 *
 * どれも `definitionId` を先に取る。**担当かどうかの判定に要る**（判定は現在の DB を
 * 見て main が行う。renderer が渡す利用者 id は信じない）。また、子だけが変わった
 * ときも解答用紙の更新日時を進める必要があり、その相手を名指しするのにも要る。
 *
 * 定義まるごとの置き換え・一覧・画像・出力は `answerSheetBuilderHandlers.ts`。
 */

import type {
  AsbBranchQuestionAttributes,
  AsbCellParent,
  AsbCharGuideAttributes,
  AsbDefinitionAttributes,
  AsbHeaderFieldAttributes,
  AsbImageElementAttributes,
  AsbMajorQuestionAttributes,
  AsbManuscriptPaperSettings,
  AsbSubQuestionAttributes,
  AsbTextElementAttributes,
  BranchQuestion,
  CellImageElement,
  CellTextElement,
  HeaderFieldDefinition,
  LabelAssignment,
  LabelCategory,
  MajorQuestion,
  ManuscriptCharGuide,
  SubQuestion,
} from "../../src/types/answerSheetDefinition.types"
import type { OMRCellConfig } from "../../src/types/omr.types"
import {
  createAsbBranchQuestion,
  deleteAsbBranchQuestion,
  reorderAsbBranchQuestions,
  updateAsbBranchQuestion,
} from "../lib/prisma/asbBranchQuestion"
import {
  createAsbCharGuide,
  deleteAsbCharGuide,
  updateAsbCharGuide,
} from "../lib/prisma/asbCharGuide"
import {
  applyAsbLabelPreset,
  updateAsbDefinition,
} from "../lib/prisma/asbDefinition"
import {
  createAsbHeaderField,
  deleteAsbHeaderField,
  reorderAsbHeaderFields,
  updateAsbHeaderField,
} from "../lib/prisma/asbHeaderField"
import {
  createAsbImageElement,
  deleteAsbImageElement,
  updateAsbImageElement,
} from "../lib/prisma/asbImageElement"
import {
  createAsbMajorQuestion,
  deleteAsbMajorQuestion,
  reorderAsbMajorQuestions,
  updateAsbMajorQuestion,
} from "../lib/prisma/asbMajorQuestion"
import {
  setAsbManuscriptPaperEnabled,
  updateAsbManuscriptPaper,
} from "../lib/prisma/asbManuscriptPaper"
import {
  deleteAsbOmrConfig,
  upsertAsbOmrConfig,
} from "../lib/prisma/asbOmrConfig"
import {
  createAsbSubQuestion,
  deleteAsbSubQuestion,
  reorderAsbSubQuestions,
  updateAsbSubQuestion,
} from "../lib/prisma/asbSubQuestion"
import {
  createAsbTextElement,
  deleteAsbTextElement,
  updateAsbTextElement,
} from "../lib/prisma/asbTextElement"
import { type HandlerMap } from "./ipcHandlerUtils"

/** 解答用紙の編集のIPCチャンネル（ヘッダー項目・設問・セルの中身・原稿用紙・文字位置マーカー）を登録する */
export const asbEditHandlers = {
  "asb:update-definition": async (
    definitionId: string,
    attributes: AsbDefinitionAttributes
  ) => {
    await updateAsbDefinition(definitionId, attributes)
  },

  "asb:apply-label-preset": async (
    definitionId: string,
    category: LabelCategory,
    preset: string,
    relabeled: LabelAssignment[]
  ) => {
    await applyAsbLabelPreset(definitionId, category, preset, relabeled)
  },

  "asb:create-header-field": async (
    definitionId: string,
    headerField: HeaderFieldDefinition
  ) => {
    await createAsbHeaderField(definitionId, headerField)
  },

  "asb:update-header-field": async (
    definitionId: string,
    headerFieldId: string,
    attributes: AsbHeaderFieldAttributes
  ) => {
    await updateAsbHeaderField(definitionId, headerFieldId, attributes)
  },

  "asb:delete-header-field": async (
    definitionId: string,
    headerFieldId: string
  ) => {
    await deleteAsbHeaderField(definitionId, headerFieldId)
  },

  "asb:reorder-header-fields": async (
    definitionId: string,
    orderedIds: string[]
  ) => {
    await reorderAsbHeaderFields(definitionId, orderedIds)
  },

  "asb:create-major-question": async (
    definitionId: string,
    majorQuestion: MajorQuestion
  ) => {
    await createAsbMajorQuestion(definitionId, majorQuestion)
  },

  "asb:update-major-question": async (
    definitionId: string,
    majorQuestionId: string,
    attributes: AsbMajorQuestionAttributes
  ) => {
    await updateAsbMajorQuestion(definitionId, majorQuestionId, attributes)
  },

  "asb:delete-major-question": async (
    definitionId: string,
    majorQuestionId: string
  ) => {
    await deleteAsbMajorQuestion(definitionId, majorQuestionId)
  },

  "asb:reorder-major-questions": async (
    definitionId: string,
    orderedIds: string[]
  ) => {
    await reorderAsbMajorQuestions(definitionId, orderedIds)
  },

  "asb:create-sub-question": async (
    definitionId: string,
    majorQuestionId: string,
    subQuestion: SubQuestion
  ) => {
    await createAsbSubQuestion(definitionId, majorQuestionId, subQuestion)
  },

  "asb:update-sub-question": async (
    definitionId: string,
    subQuestionId: string,
    attributes: AsbSubQuestionAttributes
  ) => {
    await updateAsbSubQuestion(definitionId, subQuestionId, attributes)
  },

  "asb:delete-sub-question": async (
    definitionId: string,
    subQuestionId: string
  ) => {
    await deleteAsbSubQuestion(definitionId, subQuestionId)
  },

  "asb:reorder-sub-questions": async (
    definitionId: string,
    majorQuestionId: string,
    orderedIds: string[]
  ) => {
    await reorderAsbSubQuestions(definitionId, majorQuestionId, orderedIds)
  },

  "asb:create-branch-question": async (
    definitionId: string,
    subQuestionId: string,
    branchQuestion: BranchQuestion
  ) => {
    await createAsbBranchQuestion(definitionId, subQuestionId, branchQuestion)
  },

  "asb:update-branch-question": async (
    definitionId: string,
    branchQuestionId: string,
    attributes: AsbBranchQuestionAttributes
  ) => {
    await updateAsbBranchQuestion(definitionId, branchQuestionId, attributes)
  },

  "asb:delete-branch-question": async (
    definitionId: string,
    branchQuestionId: string
  ) => {
    await deleteAsbBranchQuestion(definitionId, branchQuestionId)
  },

  "asb:reorder-branch-questions": async (
    definitionId: string,
    subQuestionId: string,
    orderedIds: string[]
  ) => {
    await reorderAsbBranchQuestions(definitionId, subQuestionId, orderedIds)
  },

  "asb:create-text-element": async (
    definitionId: string,
    parent: AsbCellParent,
    textElement: CellTextElement
  ) => {
    await createAsbTextElement(definitionId, parent, textElement)
  },

  "asb:update-text-element": async (
    definitionId: string,
    textElementId: string,
    attributes: AsbTextElementAttributes
  ) => {
    await updateAsbTextElement(definitionId, textElementId, attributes)
  },

  "asb:delete-text-element": async (
    definitionId: string,
    textElementId: string
  ) => {
    await deleteAsbTextElement(definitionId, textElementId)
  },

  "asb:create-image-element": async (
    definitionId: string,
    parent: AsbCellParent,
    imageElement: CellImageElement
  ) => {
    await createAsbImageElement(definitionId, parent, imageElement)
  },

  "asb:update-image-element": async (
    definitionId: string,
    imageElementId: string,
    attributes: AsbImageElementAttributes
  ) => {
    await updateAsbImageElement(definitionId, imageElementId, attributes)
  },

  "asb:delete-image-element": async (
    definitionId: string,
    imageElementId: string
  ) => {
    await deleteAsbImageElement(definitionId, imageElementId)
  },

  // 原稿用紙の行を作る経路はここだけ。返すのは**実際に書いた行の id**で、既にそのセルに
  // 行があれば渡された id は捨てられるので、捨てた結果を renderer が木へ取り込める
  "asb:set-manuscript-paper-enabled": async (
    definitionId: string,
    parent: AsbCellParent,
    manuscriptPaperId: string,
    enabled: boolean,
    initialSettings: AsbManuscriptPaperSettings
  ): Promise<string> =>
    await setAsbManuscriptPaperEnabled(
      definitionId,
      parent,
      manuscriptPaperId,
      enabled,
      initialSettings
    ),

  "asb:update-manuscript-paper": async (
    definitionId: string,
    manuscriptPaperId: string,
    settings: AsbManuscriptPaperSettings
  ) => {
    await updateAsbManuscriptPaper(definitionId, manuscriptPaperId, settings)
  },

  "asb:create-char-guide": async (
    definitionId: string,
    manuscriptPaperId: string,
    charGuide: ManuscriptCharGuide
  ) => {
    await createAsbCharGuide(definitionId, manuscriptPaperId, charGuide)
  },

  "asb:update-char-guide": async (
    definitionId: string,
    charGuideId: string,
    attributes: AsbCharGuideAttributes
  ) => {
    await updateAsbCharGuide(definitionId, charGuideId, attributes)
  },

  "asb:delete-char-guide": async (
    definitionId: string,
    charGuideId: string
  ) => {
    await deleteAsbCharGuide(definitionId, charGuideId)
  },

  "asb:upsert-omr-config": async (
    definitionId: string,
    parent: AsbCellParent,
    config: OMRCellConfig
  ) => {
    await upsertAsbOmrConfig(definitionId, parent, config)
  },

  "asb:delete-omr-config": async (
    definitionId: string,
    parent: AsbCellParent
  ) => {
    await deleteAsbOmrConfig(definitionId, parent)
  },
} satisfies HandlerMap
