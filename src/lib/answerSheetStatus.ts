/**
 * 解答用紙（AsbDefinition）のステータス判定ユーティリティ
 *
 * 一覧の「次のステップ」列に出す、2段ワークフローの現在地を求める。
 * 試験（examStatus）・成績（gradeStatus）と同じく、表示文言と遷移 URL は
 * presentation 情報なので main では組まず renderer 側の唯一の実装として持つ。
 */

import type { ASBDefinitionListItem } from "@/types/answerSheetBuilder.types"

/**
 * 進捗判定が読む解答用紙1件。
 *
 * 一覧の行（`ASBDefinitionListItem`）から、判定に要る2つだけを取る。
 * 設問数は**一覧が既に読んでいる**もので（名前セルの2行目に出す「設問数」と同じ値）、
 * 判定のために新しい取得は増やしていない。概要ページのように行を持たない側は
 * `countAsbQuestions` で数えた値を渡せばよい。
 */
type AnswerSheetProgressSource = Pick<
  ASBDefinitionListItem,
  "id" | "questionCount"
>

interface AnswerSheetStatus {
  step: number
  text: string
  url: string
}

/** 各段の完了状態 */
export interface AnswerSheetStepCompletion {
  /** 1. 作成（01-edit）。設問が1問でもあれば着手済みとみなす */
  hasQuestions: boolean
}

/**
 * 解答用紙の各段の完了状態を取得する。
 *
 * 作成できたかどうかは設問の有無で見る。用紙の設定（サイズ・向き）は
 * 既定値が必ず入るので「設定したか」を区別できず、進み具合の目印にならない。
 */
export function getAnswerSheetCompletion(
  definition: AnswerSheetProgressSource
): AnswerSheetStepCompletion {
  return {
    // 一覧の行では未取得のことがあるので、無い＝0問として扱う
    hasQuestions: (definition.questionCount ?? 0) > 0,
  }
}

/**
 * 解答用紙の「次のステップ」を導出する。
 *
 * 設問が無ければ作成、あれば書き出し。試験・成績と同じく、
 * すべて済んだ状態でも最後の段（書き出し）を指し続ける。
 */
export function getAnswerSheetStatus(
  definition: AnswerSheetProgressSource
): AnswerSheetStatus {
  const id = definition.id
  const completion = getAnswerSheetCompletion(definition)

  if (!completion.hasQuestions) {
    return {
      step: 1,
      text: "解答用紙の作成",
      url: `/answer-sheet-builder/${id}/01-edit`,
    }
  }

  return {
    step: 2,
    text: "解答用紙の書き出し",
    url: `/answer-sheet-builder/${id}/02-export`,
  }
}
