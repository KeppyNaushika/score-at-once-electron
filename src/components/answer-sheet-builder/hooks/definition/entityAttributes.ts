/**
 * 実体から「自身の属性」（子と id を除いた列）を取り出す。
 *
 * 画面は属性の一部だけを触るので、足りない分をいまの姿から埋めるのに使う。
 */

import type {
  AnswerSheetDefinition,
  AsbBranchQuestionAttributes,
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
  MajorQuestion,
  ManuscriptCharGuide,
  ManuscriptPaper,
  SubQuestion,
} from "@/types/answerSheetDefinition.types"

export function definitionAttributes(
  definition: AnswerSheetDefinition
): AsbDefinitionAttributes {
  const { headerFields, ...settings } = definition.settings
  return {
    name: definition.name,
    description: definition.description,
    referenceDate: definition.referenceDate,
    labelPresets: definition.labelPresets,
    settings,
  }
}

export function headerFieldAttributes(
  headerField: HeaderFieldDefinition
): AsbHeaderFieldAttributes {
  const { id, order, ...attributes } = headerField
  return attributes
}

export function majorQuestionAttributes(
  majorQuestion: MajorQuestion
): AsbMajorQuestionAttributes {
  return { label: majorQuestion.label }
}

export function subQuestionAttributes(
  subQuestion: SubQuestion
): AsbSubQuestionAttributes {
  const {
    id,
    branchQuestions,
    textElements,
    imageElements,
    omrConfig,
    manuscriptPaper,
    ...attributes
  } = subQuestion
  return attributes
}

/** 原稿用紙から見た目の設定だけを取り出す（オンオフは別の意図が書く） */
export function manuscriptPaperSettings(
  manuscriptPaper: ManuscriptPaper
): AsbManuscriptPaperSettings {
  const { id, charGuides, enabled, ...settings } = manuscriptPaper
  return settings
}

export function branchQuestionAttributes(
  branchQuestion: BranchQuestion
): AsbBranchQuestionAttributes {
  const {
    id,
    textElements,
    imageElements,
    omrConfig,
    manuscriptPaper,
    ...attributes
  } = branchQuestion
  return attributes
}

export function textElementAttributes(
  textElement: CellTextElement
): AsbTextElementAttributes {
  const { id, ...attributes } = textElement
  return attributes
}

export function imageElementAttributes(
  imageElement: CellImageElement
): AsbImageElementAttributes {
  const { id, ...attributes } = imageElement
  return attributes
}

export function charGuideAttributes(
  charGuide: ManuscriptCharGuide
): AsbCharGuideAttributes {
  const { id, ...attributes } = charGuide
  return attributes
}
