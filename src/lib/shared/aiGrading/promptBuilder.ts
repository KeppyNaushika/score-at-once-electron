/**
 * AI 採点で事業者へ送る文面の部品（docs/vlm-grading-design.md §3-1・§7-1）
 *
 * 1段目（`stage1Grading.ts`）と2段目（`stage2Grouping.ts`）が共有する、節の組み方と
 * 片の並べ方を置く。送った全文は保存しないので、各段の文面の組み立てが組み立て直しの
 * 唯一の定義になる（指示の文言を変えたら、その段の版を上げる）。
 *
 * 固定部（`fixedParts`）は同じ入力からバイト単位で同じ内容にする。時刻・氏名を入れない
 * （事業者のプロンプトキャッシュが効かなくなる）。答案の画像は呼び出し側が可変部に置く。
 *
 * main（送信）と renderer（見積もり・画面の説明）の両方から引くので `src/lib/shared/` に置く。
 */

import type { AiPrompt } from "@prisma/client"

import type { PromptPart } from "@/electron-src/lib/aiGrading/providers/types"

/** 送る画像（問題の画像・模範解答の切り出し・答案） */
export interface PromptImage {
  mediaType: "image/png" | "image/jpeg"
  base64Data: string
}

/** プロンプトのうち、送る文面になる欄 */
export type PromptTextFields = Pick<
  AiPrompt,
  "questionText" | "modelAnswerText" | "rubricText" | "annotationInstruction"
>

/** 配点の節。配点の無い設問は点を付けず、判断できないときは点の無い保留にするよう伝える */
export function formatPointsSection(points: number | null): string {
  if (points === null) {
    return "## 配点\nこの設問には配点がありません。partial は使わないでください。判断できないときは、partialScore を null にした pending にしてください。"
  }
  return `## 配点\n${points}点`
}

/** 1つの節（見出しと本文）。本文が空なら null（節ごと省く） */
export function textSection(heading: string, body: string): string | null {
  const trimmedBody = body.trim()
  return trimmedBody === "" ? null : `## ${heading}\n${trimmedBody}`
}

/**
 * 文と画像の並びを、隣り合う文を1つにまとめた片の列にする。
 * まとめ方を固定しておくことで、同じ入力なら同じ片の列になる
 */
export function joinPromptSegments(
  segments: readonly (string | PromptImage | null)[]
): PromptPart[] {
  const parts: PromptPart[] = []
  let pendingTexts: string[] = []
  const flushTexts = () => {
    if (pendingTexts.length === 0) return
    parts.push({ kind: "text", text: pendingTexts.join("\n\n") })
    pendingTexts = []
  }
  segments.forEach((segment) => {
    if (segment === null) return
    if (typeof segment === "string") {
      pendingTexts.push(segment)
      return
    }
    flushTexts()
    parts.push({
      kind: "image",
      mediaType: segment.mediaType,
      base64Data: segment.base64Data,
    })
  })
  flushTexts()
  return parts
}

interface PromptContentInput {
  /** 助言の文案の指示は2段目だけが使うので、ここでは読まない */
  prompt: Omit<PromptTextFields, "annotationInstruction">
  points: number | null
  /** 問題の画像（並び順）。無ければ省く */
  questionImages?: readonly PromptImage[]
  /** 模範解答のページから設問枠を切り出した画像。無ければ省く */
  modelAnswerImage?: PromptImage | null
}

/**
 * 問題の画像の節。1枚なら見出しと画像、2枚以上なら見出しに枚数を書き、画像ごとに何枚目かを添える
 */
function questionImageSegments(
  questionImages: readonly PromptImage[]
): (string | PromptImage)[] {
  if (questionImages.length === 0) return []
  if (questionImages.length === 1)
    return ["## 問題文（画像）", questionImages[0]]
  return [
    `## 問題文（画像 ${questionImages.length}枚。この順に読んでください）`,
    ...questionImages.flatMap((questionImage, index) => [
      `（${index + 1}枚目）`,
      questionImage,
    ]),
  ]
}

/**
 * プロンプトの中身（配点・問題文・模範解答・採点基準）の節を並べる（1段目の固定部の頭）
 */
export function buildPromptContentSegments(
  input: PromptContentInput
): (string | PromptImage | null)[] {
  const { prompt, points, modelAnswerImage } = input
  const questionImages = input.questionImages ?? []
  const questionTextSection = textSection("問題文", prompt.questionText)
  const modelAnswerTextSection = textSection("模範解答", prompt.modelAnswerText)
  const rubricSection = textSection("採点基準", prompt.rubricText)
  const hasNoContent =
    questionTextSection === null &&
    questionImages.length === 0 &&
    modelAnswerTextSection === null &&
    !modelAnswerImage &&
    rubricSection === null

  return [
    formatPointsSection(points),
    questionTextSection,
    ...questionImageSegments(questionImages),
    modelAnswerTextSection,
    modelAnswerImage ? "## 模範解答（画像）" : null,
    modelAnswerImage ?? null,
    rubricSection,
    hasNoContent
      ? "問題文・模範解答・採点基準はありません。答案と配点から判断してください。"
      : null,
  ]
}

/** 依頼の文面（アプリ共通の指示と固定部） */
export interface GradingRequestParts {
  systemText: string
  /** キャッシュさせる前置き。答案の画像はこの後ろに置く */
  fixedParts: PromptPart[]
}

/** 採点の可変部（答案の画像1枚） */
export function buildGradingVariableParts(
  answerImage: PromptImage
): PromptPart[] {
  return joinPromptSegments([answerImage])
}
