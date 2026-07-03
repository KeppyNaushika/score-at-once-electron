import type {
  AnswerSheetDefinition,
  BranchQuestion,
  GlobalSettings,
  HeaderFieldDefinition,
  LineStyle,
  MajorQuestion,
  ManuscriptGuidePosition,
  PaperSize,
  SubQuestion,
} from "@/types/answerSheetDefinition.types"

// =====================
// 原稿用紙の既定値
// =====================

/** 行方向（字間）の罫線は破線が一般的 */
export const DEFAULT_MANUSCRIPT_CHAR_DIVIDER: LineStyle = "dashed"
/** 行間（行の区切り）の罫線は実線 */
export const DEFAULT_MANUSCRIPT_LINE_DIVIDER: LineStyle = "solid"
/** 原稿用紙マス罫線の太さ（mm）。輪転印刷でかすれないよう黒・実用太さ */
export const DEFAULT_MANUSCRIPT_DIVIDER_WIDTH = 0.2
/** 文字数ガイドの既定文字サイズ（1マス＝1とした相対値。マス比） */
export const DEFAULT_MANUSCRIPT_GUIDE_FONT_RATIO = 0.3
/** 文字数ガイドの隅からの既定余白（1マス＝1とした相対値。マス比） */
export const DEFAULT_MANUSCRIPT_GUIDE_PADDING_RATIO = 0.05
/** 区切り罫線（○字以内/以上の目印）の既定太さ（mm） */
export const DEFAULT_MANUSCRIPT_BOUNDARY_WIDTH = 0.5
/** 文字数ガイドの既定表示位置（左下が一般的） */
export const DEFAULT_MANUSCRIPT_GUIDE_POSITION: ManuscriptGuidePosition =
  "bottom-left"

// =====================
// 破線/点線パターンの既定値
// =====================

/** 破線のダッシュ長の既定倍率（線幅に対する倍率） */
export const DEFAULT_DASH_RATIO = 3
/** 破線/点線の間隔の既定倍率（線幅に対する倍率） */
export const DEFAULT_GAP_RATIO = 2

// =====================
// 用紙サイズ定数（mm）
// =====================

export const PAPER_SIZES: Record<PaperSize, { width: number; height: number }> =
  {
    A4: { width: 210, height: 297 },
    B5: { width: 182, height: 257 },
    B4: { width: 257, height: 364 },
    A3: { width: 297, height: 420 },
  }

/** 1mm = 2.835pt (pdf-lib用) */
export const MM_TO_PT = 2.835

// =====================
// デフォルト設定
// =====================

export const DEFAULT_SETTINGS: GlobalSettings = {
  paperSize: "A4",
  orientation: "portrait",
  verticalLayout: false,
  margins: { top: 15, bottom: 15, left: 10, right: 10 },
  baseRowHeight: 12,
  columnWidths: { majorNumber: 10, subNumber: 10, branchNumber: 10 },
  spacing: { majorQuestionSpacing: 5, headerHeight: 0 },
  borderConfig: {
    outerBorder: "solid",
    majorDivider: "solid",
    subDivider: "solid",
    branchDivider: "dashed",
    majorNumberDivider: "solid",
    subNumberDivider: "solid",
    branchNumberDivider: "solid",
    outerBorderWidth: 0.7,
    majorDividerWidth: 0.5,
    subDividerWidth: 0.4,
    branchDividerWidth: 0.3,
    majorNumberDividerWidth: 0.4,
    subNumberDividerWidth: 0.4,
    branchNumberDividerWidth: 0.3,
    manuscriptCharDivider: DEFAULT_MANUSCRIPT_CHAR_DIVIDER,
    manuscriptLineDivider: DEFAULT_MANUSCRIPT_LINE_DIVIDER,
    manuscriptCharDividerWidth: DEFAULT_MANUSCRIPT_DIVIDER_WIDTH,
    manuscriptLineDividerWidth: DEFAULT_MANUSCRIPT_DIVIDER_WIDTH,
  },
  omrMarkers: { enabled: false, sizeMm: 5, offsetMm: 6 },
  fonts: {
    family: "Noto Sans JP",
    defaultSize: 6,
    majorNumberSize: 6,
    subNumberSize: 6,
    branchNumberSize: 5,
  },
  numberDisplayMode: "multirow",
  multiColumn: {
    enabled: false,
    columnCount: 2,
    columnGapMm: 5,
    dividerLine: null,
    dividerLineWidth: 0.3,
  },
  headerFields: [],
}

// =====================
// デフォルト問題構造
// =====================

let _nextId = 1
export function generateId(): string {
  return `asb_${Date.now()}_${_nextId++}`
}

export function createDefaultBranchQuestion(label?: string): BranchQuestion {
  return {
    id: generateId(),
    label: label ?? "(1)",
    heightMultiplier: 1,
    points: 1,
    textElements: [],
    imageElements: [],
  }
}

export function createDefaultSubQuestion(label?: string): SubQuestion {
  return {
    id: generateId(),
    label: label ?? "(1)",
    branchQuestions: [],
    heightMultiplier: 1,
    points: 1,
    textElements: [],
    imageElements: [],
  }
}

export function createDefaultMajorQuestion(
  label?: string,
  subLabel?: string
): MajorQuestion {
  return {
    id: generateId(),
    label: label ?? "1",
    subQuestions: [createDefaultSubQuestion(subLabel)],
  }
}

export function createDefaultHeaderField(
  overrides?: Partial<HeaderFieldDefinition>
): HeaderFieldDefinition {
  return {
    id: generateId(),
    type: overrides?.type ?? "field",
    label: overrides?.label ?? "フィールド",
    widthMm: overrides?.widthMm ?? 30,
    heightMm: overrides?.heightMm ?? 8,
    gridCount: overrides?.gridCount ?? 0,
    lineStyle: overrides?.lineStyle ?? "solid",
    lineWidth: overrides?.lineWidth ?? 0.4,
    order: overrides?.order ?? 0,
    fontSize: overrides?.fontSize,
    linkedRegionType: overrides?.linkedRegionType,
  }
}

export const HEADER_FIELD_PRESETS: {
  label: string
  defaults: Partial<HeaderFieldDefinition>
}[] = [
  {
    label: "受験番号",
    defaults: {
      type: "field",
      label: "受験番号",
      widthMm: 40,
      gridCount: 8,
      linkedRegionType: "STUDENT_ID",
    },
  },
  {
    label: "クラス",
    defaults: { type: "field", label: "クラス", widthMm: 20, gridCount: 3 },
  },
  {
    label: "番号",
    defaults: { type: "field", label: "番号", widthMm: 20, gridCount: 3 },
  },
  {
    label: "氏名",
    defaults: {
      type: "field",
      label: "氏名",
      widthMm: 60,
      gridCount: 0,
      linkedRegionType: "STUDENT_NAME",
    },
  },
  {
    label: "合計点",
    defaults: {
      type: "field",
      label: "合計点",
      widthMm: 30,
      gridCount: 0,
      linkedRegionType: "TOTAL_SCORE",
    },
  },
  {
    label: "小計点",
    defaults: {
      type: "field",
      label: "小計点",
      widthMm: 30,
      gridCount: 0,
      linkedRegionType: "SUBTOTAL_SCORE",
    },
  },
  {
    label: "可変スペース",
    defaults: { type: "hfill", label: "", widthMm: 0, heightMm: 8 },
  },
  {
    label: "ラベル（テキスト表示）",
    defaults: {
      type: "label",
      label: "試験名",
      widthMm: 40,
      heightMm: 8,
      fontSize: 5,
    },
  },
]

export function createDefaultDefinition(): AnswerSheetDefinition {
  return {
    id: generateId(),
    name: "新しい解答用紙",
    settings: { ...DEFAULT_SETTINGS },
    majorQuestions: [createDefaultMajorQuestion()],
    renderMode: "answer-sheet",
  }
}

// =====================
// 用紙サイズラベル
// =====================

export const PAPER_SIZE_OPTIONS: { value: PaperSize; label: string }[] = [
  { value: "A4", label: "A4 (210×297mm)" },
  { value: "B5", label: "B5 (182×257mm)" },
  { value: "B4", label: "B4 (257×364mm)" },
  { value: "A3", label: "A3 (297×420mm)" },
]

// =====================
// プリセット用ヘルパー
// =====================

/** 丸数字番号を取得（1〜50対応） */
export function getCircledNumber(n: number): string {
  if (n >= 1 && n <= 20) return String.fromCodePoint(0x245f + n)
  if (n >= 21 && n <= 35) return String.fromCodePoint(0x3250 + n - 20)
  if (n >= 36 && n <= 50) return String.fromCodePoint(0x32b0 + n - 35)
  return `(${n})`
}

/** 漢数字（1〜99） */
function kanjiNumber(n: number): string {
  const digits = ["", "一", "二", "三", "四", "五", "六", "七", "八", "九"]
  if (n >= 1 && n <= 9) return digits[n]
  if (n === 10) return "十"
  const tens = Math.floor(n / 10)
  const ones = n % 10
  if (tens === 1) return `十${digits[ones]}`
  return `${digits[tens]}十${ones > 0 ? digits[ones] : ""}`
}

/** 全角数字変換 */
function toFullWidth(n: number): string {
  return String(n).replace(/\d/g, (c) =>
    String.fromCodePoint(c.charCodeAt(0) + 0xfee0)
  )
}

/** プリセット文字列を個別ラベル配列にパースする */
export function parsePresetLabels(preset: string): string[] {
  // 括弧付き: "(x)", "[x]", "〔x〕"
  const bracketMatches = preset.match(/(?:\([^)]+\)|\[[^\]]+\]|〔[^〕]+〕)/g)
  if (bracketMatches) return bracketMatches
  // カンマ区切り: "1,2,3,..."
  if (preset.includes(",")) return preset.split(",")
  // 丸数字や単文字: "①②③..." or "abcdefghij"
  return [...preset]
}

// =====================
// プリセット定数（~50対応）
// =====================

const N = 50
const KATAKANA =
  "アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン"

export const MAJOR_QUESTION_LABEL_PRESETS = [
  Array.from({ length: N }, (_, i) => String(i + 1)).join(","),
  "ⅠⅡⅢⅣⅤⅥⅦⅧⅨⅩⅪⅫ",
  Array.from({ length: N }, (_, i) => kanjiNumber(i + 1)).join(","),
  Array.from({ length: N }, (_, i) => `[${i + 1}]`).join(""),
]

export const SUB_QUESTION_LABEL_PRESETS = [
  Array.from({ length: N }, (_, i) => `(${i + 1})`).join(""),
  Array.from({ length: N }, (_, i) => getCircledNumber(i + 1)).join(""),
  Array.from({ length: N }, (_, i) => `〔問${toFullWidth(i + 1)}〕`).join(""),
  Array.from({ length: N }, (_, i) => `問${i + 1}`).join(","),
  "abcdefghijklmnopqrstuvwxyz",
]

export const BRANCH_QUESTION_LABEL_PRESETS = [
  Array.from({ length: KATAKANA.length }, (_, i) => `(${KATAKANA[i]})`).join(
    ""
  ),
  Array.from({ length: 26 }, (_, i) => `(${String.fromCharCode(97 + i)})`).join(
    ""
  ),
  Array.from({ length: N }, (_, i) => `(${i + 1})`).join(""),
  Array.from({ length: N }, (_, i) => getCircledNumber(i + 1)).join(""),
]
