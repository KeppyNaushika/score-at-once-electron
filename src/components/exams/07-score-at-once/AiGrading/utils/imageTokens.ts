/**
 * 送る画像1枚の入力トークン数を、事業者・モデルごとの公式の数え方で求める
 * （docs/vlm-grading-design.md §3-2）。
 *
 * 大きさは main が実際に送る画像と同じ求め方で測ったもの（`measureRunImageSizes`。
 * 切り出し・拡大率 `imageScale` を掛けた後の画素数）を受け取る。事業者側の縮小はここで再現する。
 *
 * - Anthropic: 28×28 画素の区画1つが1トークン。モデルの段（標準・高解像度）ごとの長辺と
 *   トークン数の上限に収まるよう、縦横比を保って縮めてから数える
 *   （https://platform.claude.com/docs/en/build-with-claude/vision 、
 *   https://platform.claude.com/docs/en/build-with-claude/vision-coordinates ）
 * - OpenAI: 32×32 画素の区画に倍率を掛けるモデルと、512 画素のタイルで数えるモデルがある。
 *   アプリは `detail: "high"` で送る（`providers/openaiProvider.ts`）
 *   （https://developers.openai.com/api/docs/guides/images-vision ）
 */

import type { GradingProviderId } from "@/electron-src/lib/aiGrading/providers/types"

export interface ImageSize {
  width: number
  height: number
}

/** モデル名の末尾の日付（スナップショット）を外す。`claude-haiku-4-5-20251001` → `claude-haiku-4-5` */
export function stripModelSnapshotDate(model: string): string {
  return model.replace(/-\d{8}$/, "").replace(/-\d{4}-\d{2}-\d{2}$/, "")
}

// ── Anthropic ──────────────────────────────────────────────

const ANTHROPIC_PATCH_PIXELS = 28

/** 解像度の段ごとの上限（長辺の画素・トークン数） */
const ANTHROPIC_STANDARD_TIER = { maxEdge: 1568, maxTokens: 1568 }
const ANTHROPIC_HIGH_RESOLUTION_TIER = { maxEdge: 2576, maxTokens: 4784 }

/** 高解像度の段になる最初の版（Claude 4.7 以降） */
const ANTHROPIC_HIGH_RESOLUTION_FROM_VERSION = 4.7

/**
 * Claude のモデル名から版（4.5 なら 4.5）を読む。読めなければ null。
 * `claude-opus-5-5` → 5.5、`claude-opus-5` → 5、`claude-haiku-4-5-20251001` → 4.5
 */
export function parseClaudeVersion(model: string): number | null {
  const matched = /^claude-[a-z]+-(\d+)(?:-(\d))?$/.exec(
    stripModelSnapshotDate(model)
  )
  if (!matched) return null
  return Number(matched[1]) + Number(matched[2] ?? "0") / 10
}

function countAnthropicPatches(width: number, height: number): number {
  return (
    Math.ceil(width / ANTHROPIC_PATCH_PIXELS) *
    Math.ceil(height / ANTHROPIC_PATCH_PIXELS)
  )
}

/** 偶数への丸め（公式の参照実装と同じ。.5 ちょうどを偶数側へ） */
function roundHalfToEven(value: number): number {
  const floored = Math.floor(value)
  if (value - floored !== 0.5) return Math.round(value)
  return floored % 2 === 0 ? floored : floored + 1
}

/** 事業者が縮める先の大きさ（公式の参照実装をそのまま写したもの） */
function resizeForAnthropic(
  width: number,
  height: number,
  limits: { maxEdge: number; maxTokens: number }
): ImageSize {
  const fits = (candidateWidth: number, candidateHeight: number) =>
    Math.ceil(candidateWidth / ANTHROPIC_PATCH_PIXELS) *
      ANTHROPIC_PATCH_PIXELS <=
      limits.maxEdge &&
    Math.ceil(candidateHeight / ANTHROPIC_PATCH_PIXELS) *
      ANTHROPIC_PATCH_PIXELS <=
      limits.maxEdge &&
    countAnthropicPatches(candidateWidth, candidateHeight) <= limits.maxTokens

  if (fits(width, height)) return { width, height }
  if (height > width) {
    const transposed = resizeForAnthropic(height, width, limits)
    return { width: transposed.height, height: transposed.width }
  }
  // 長辺について、収まる最大の大きさを二分探索する
  const aspectRatio = width / height
  const shortEdgeOf = (longEdge: number) =>
    Math.max(roundHalfToEven(longEdge / aspectRatio), 1)
  let fittingLongEdge = 1
  let tooLongEdge = width
  while (fittingLongEdge + 1 < tooLongEdge) {
    const middle = Math.floor((fittingLongEdge + tooLongEdge) / 2)
    if (fits(middle, shortEdgeOf(middle))) fittingLongEdge = middle
    else tooLongEdge = middle
  }
  return { width: fittingLongEdge, height: shortEdgeOf(fittingLongEdge) }
}

function countAnthropicImageTokens(model: string, image: ImageSize): number {
  const version = parseClaudeVersion(model)
  // 版の読めないモデルは、多めに出る高解像度の段で数える
  const limits =
    version === null || version >= ANTHROPIC_HIGH_RESOLUTION_FROM_VERSION
      ? ANTHROPIC_HIGH_RESOLUTION_TIER
      : ANTHROPIC_STANDARD_TIER
  const resized = resizeForAnthropic(image.width, image.height, limits)
  return countAnthropicPatches(resized.width, resized.height)
}

// ── OpenAI ─────────────────────────────────────────────────

const OPENAI_PATCH_PIXELS = 32

/** 32 画素の区画で数えるモデルの、`detail: "high"` での上限と倍率 */
interface OpenAiPatchRule {
  kind: "patch"
  multiplier: number
  maxDimension: number
  patchBudget: number
}

/** 512 画素のタイルで数えるモデルの、基本とタイル1枚のトークン数 */
interface OpenAiTileRule {
  kind: "tile"
  baseTokens: number
  tileTokens: number
}

/** 公式の表に無いモデル（新しい世代）は区画で数え、倍率と上限は現行の多数派に合わせる */
const OPENAI_DEFAULT_PATCH_RULE: OpenAiPatchRule = {
  kind: "patch",
  multiplier: 1.2,
  maxDimension: 2048,
  patchBudget: 2500,
}

/** 公式の表で数え方の分かるモデル（スナップショットの日付を外した名前で引く） */
const OPENAI_IMAGE_RULES = new Map<string, OpenAiPatchRule | OpenAiTileRule>([
  ["gpt-5.2", { ...OPENAI_DEFAULT_PATCH_RULE, patchBudget: 6144 }],
  ["gpt-4.1-mini", { ...OPENAI_DEFAULT_PATCH_RULE, multiplier: 1.62 }],
  ["gpt-4.1-nano", { ...OPENAI_DEFAULT_PATCH_RULE, multiplier: 2.46 }],
  ["o4-mini", { ...OPENAI_DEFAULT_PATCH_RULE, multiplier: 1.72 }],
  ["gpt-5.1", { kind: "tile", baseTokens: 70, tileTokens: 140 }],
  ["gpt-5", { kind: "tile", baseTokens: 70, tileTokens: 140 }],
  ["gpt-4o", { kind: "tile", baseTokens: 85, tileTokens: 170 }],
  ["gpt-4.1", { kind: "tile", baseTokens: 85, tileTokens: 170 }],
  ["gpt-4o-mini", { kind: "tile", baseTokens: 2833, tileTokens: 5667 }],
])

function scaleToFit(image: ImageSize, maxDimension: number): ImageSize {
  const scale = Math.min(1, maxDimension / Math.max(image.width, image.height))
  return {
    width: Math.max(1, Math.floor(image.width * scale)),
    height: Math.max(1, Math.floor(image.height * scale)),
  }
}

function countOpenAiPatches(image: ImageSize): number {
  return (
    Math.ceil(image.width / OPENAI_PATCH_PIXELS) *
    Math.ceil(image.height / OPENAI_PATCH_PIXELS)
  )
}

function countOpenAiPatchTokens(rule: OpenAiPatchRule, image: ImageSize) {
  const limited = scaleToFit(image, rule.maxDimension)
  let patchCount = countOpenAiPatches(limited)
  if (patchCount > rule.patchBudget) {
    // 区画の数が上限を超えたら、区画の格子に合うよう縮める（公式の手順 B・C）
    const shrinkFactor = Math.sqrt(
      (OPENAI_PATCH_PIXELS ** 2 * rule.patchBudget) /
        (limited.width * limited.height)
    )
    const scaledColumns = (limited.width * shrinkFactor) / OPENAI_PATCH_PIXELS
    const scaledRows = (limited.height * shrinkFactor) / OPENAI_PATCH_PIXELS
    const adjustedFactor =
      shrinkFactor *
      Math.min(
        Math.floor(scaledColumns) / scaledColumns,
        Math.floor(scaledRows) / scaledRows
      )
    patchCount = countOpenAiPatches({
      width: Math.floor(limited.width * adjustedFactor),
      height: Math.floor(limited.height * adjustedFactor),
    })
  }
  return Math.ceil(patchCount * rule.multiplier)
}

function countOpenAiTileTokens(rule: OpenAiTileRule, image: ImageSize) {
  const fitted = scaleToFit(image, 2048)
  const shortestSide = Math.min(fitted.width, fitted.height)
  const scale = shortestSide > 768 ? 768 / shortestSide : 1
  const tileCount =
    Math.ceil(Math.floor(fitted.width * scale) / 512) *
    Math.ceil(Math.floor(fitted.height * scale) / 512)
  return rule.baseTokens + rule.tileTokens * tileCount
}

function countOpenAiImageTokens(model: string, image: ImageSize): number {
  const rule =
    OPENAI_IMAGE_RULES.get(stripModelSnapshotDate(model)) ??
    OPENAI_DEFAULT_PATCH_RULE
  return rule.kind === "tile"
    ? countOpenAiTileTokens(rule, image)
    : countOpenAiPatchTokens(rule, image)
}

/** 送る画像1枚の入力トークン数 */
export function countImageTokens(
  provider: GradingProviderId,
  model: string,
  image: ImageSize
): number {
  if (image.width <= 0 || image.height <= 0) return 0
  switch (provider) {
    case "anthropic":
      return countAnthropicImageTokens(model, image)
    case "openai":
      return countOpenAiImageTokens(model, image)
  }
}
