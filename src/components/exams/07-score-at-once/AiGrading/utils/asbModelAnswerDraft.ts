/**
 * 解答用紙（ASB）から模範解答テキストの下書きを作る（docs/vlm-grading-design.md §2・§3-1）。
 *
 * 試験と ASB の間に FK は無く、つながりは設問のラベル文字列だけ。ASB から試験を作るときの
 * ラベル（`examConverter.ts`・レイアウトの `createCell`）と同じ形の候補を作って、設問の
 * ラベルと突き合わせる。ラベルは 03 画面の編集で崩れうるので、結果は**下書き**として
 * 入れ、教員が直せる形にする。
 *
 * 模範解答はテキスト要素の `||…||`（`inlineMarkupParser.ts`）。
 */

import { parseInlineMarkup } from "@/lib/answer-sheet-builder/inlineMarkupParser"

import type { AsbModelAnswerSource } from "../types"

type AsbMajorQuestion = AsbModelAnswerSource["majorQuestions"][number]
type AsbSubQuestion = AsbMajorQuestion["subQuestions"][number]
type AsbTextElement = AsbSubQuestion["textElements"][number]

/** ラベルが当たった解答欄と、そこから抜き出した模範解答 */
export interface AsbModelAnswerDraft {
  /** 当たったラベル */
  matchedLabel: string
  /** `||…||` を抜き出したもの（複数あれば改行でつなぐ）。無ければ空文字 */
  modelAnswerText: string
}

/**
 * テキストから `||…||` の中身を抜き出す。数式は `$…$` / `$$…$$` に戻して残す
 * （VLM へ送る文面として読める形にする）。離れた `||…||` は改行でつなぐ
 */
export function extractModelAnswerText(text: string): string {
  const groups: string[][] = []
  let isInsideGroup = false
  for (const segment of parseInlineMarkup(text)) {
    if (!segment.modelAnswer) {
      isInsideGroup = false
      continue
    }
    const segmentText = segment.displayMath
      ? `$$${segment.text}$$`
      : segment.math
        ? `$${segment.text}$`
        : segment.text
    if (isInsideGroup) {
      groups[groups.length - 1].push(segmentText)
    } else {
      groups.push([segmentText])
      isInsideGroup = true
    }
  }
  return groups
    .map((group) => group.join("").trim())
    .filter((groupText) => groupText !== "")
    .join("\n")
}

function extractFromTextElements(
  textElements: readonly AsbTextElement[]
): string {
  return textElements
    .map((textElement) => extractModelAnswerText(textElement.text))
    .filter((modelAnswerText) => modelAnswerText !== "")
    .join("\n")
}

/** 下書きに使うのは小問・枝問の木だけ（解答用紙そのものの列は見ない） */
type AsbQuestionTree = Pick<AsbModelAnswerSource, "majorQuestions">

/** ラベルの候補（試験を作るときと同じ形）と、その解答欄のテキスト要素 */
function listLabelCandidates(source: AsbQuestionTree) {
  return source.majorQuestions.flatMap((majorQuestion) =>
    majorQuestion.subQuestions.flatMap((subQuestion) => [
      {
        // 小問（枝問を1つの設問へまとめたときも同じラベル。小問が無名なら大問だけ）
        label: [majorQuestion.label, subQuestion.label]
          .filter(Boolean)
          .join("-"),
        textElements: [
          ...subQuestion.textElements,
          ...subQuestion.branchQuestions.flatMap(
            (branchQuestion) => branchQuestion.textElements
          ),
        ],
      },
      ...subQuestion.branchQuestions.map((branchQuestion) => ({
        label: `${majorQuestion.label}-${subQuestion.label}-${branchQuestion.label}`,
        textElements: branchQuestion.textElements,
      })),
    ])
  )
}

/**
 * 設問のラベルに当たる解答欄を探し、模範解答の下書きを返す。当たらなければ null
 */
export function draftModelAnswerFromAsb(
  source: AsbQuestionTree,
  cropRegionLabel: string
): AsbModelAnswerDraft | null {
  const targetLabel = cropRegionLabel.trim()
  if (targetLabel === "") return null
  const candidate = listLabelCandidates(source).find(
    (labelCandidate) => labelCandidate.label.trim() === targetLabel
  )
  if (!candidate) return null
  return {
    matchedLabel: candidate.label,
    modelAnswerText: extractFromTextElements(candidate.textElements),
  }
}
