import type {
  AnswerSheetDefinition,
  BranchQuestion,
  GlobalSettings,
  MajorQuestion,
  PaperSize,
  SubQuestion,
} from "@/types/answerSheetBuilder.types"

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
  margins: { top: 15, bottom: 15, left: 10, right: 10 },
  baseRowHeight: 12,
  columnWidths: { majorNumber: 10, subNumber: 10, branchNumber: 10 },
  spacing: { majorQuestionSpacing: 5, headerHeight: 0 },
  borderConfig: {
    outerBorder: "solid",
    majorDivider: "solid",
    subDivider: "solid",
    branchDivider: "dashed",
    numberColumnDivider: "solid",
  },
  omrMarkers: { enabled: false, sizeMm: 5, offsetMm: 3 },
  fonts: { family: "Noto Sans JP", defaultSize: 6, numberSize: 6 },
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
  }
}

export function createDefaultSubQuestion(label?: string): SubQuestion {
  return {
    id: generateId(),
    label: label ?? "①",
    branchQuestions: [],
    heightMultiplier: 1,
    points: 1,
    textElements: [],
  }
}

export function createDefaultMajorQuestion(label?: string): MajorQuestion {
  return {
    id: generateId(),
    label: label ?? "1",
    numberDisplayMode: "multirow",
    subQuestions: [createDefaultSubQuestion()],
    spacingBefore: false,
    subQuestionLayout: "vertical",
  }
}

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
// 小問番号プリセット
// =====================

export const SUB_QUESTION_LABEL_PRESETS = [
  "①②③④⑤⑥⑦⑧⑨⑩",
  "(1)(2)(3)(4)(5)(6)(7)(8)(9)(10)",
  "abcdefghij",
]

export const BRANCH_QUESTION_LABEL_PRESETS = [
  "(ア)(イ)(ウ)(エ)(オ)(カ)(キ)(ク)(ケ)(コ)",
  "(a)(b)(c)(d)(e)(f)(g)(h)(i)(j)",
  "(1)(2)(3)(4)(5)(6)(7)(8)(9)(10)",
]

/** 丸数字番号を取得 */
export function getCircledNumber(n: number): string {
  const circledNumbers = "①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳"
  if (n >= 1 && n <= 20) return circledNumbers[n - 1]
  return `(${n})`
}
