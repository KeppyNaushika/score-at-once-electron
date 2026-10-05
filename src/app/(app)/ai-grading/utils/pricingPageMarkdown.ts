/**
 * 「ページから読み込む」で取ってきた料金のページ（Markdown）を読む、事業者に依らない部品。
 *
 * 表を取り出す・列を見出しの文字で探す・バッチの比をそろえて読む、までをここに置き、
 * どの表のどの列を単価にするかは事業者ごとの読み解き（`anthropicPricingPage.ts`・
 * `openaiPricingPage.ts`）が決める。
 */

/** ページから読めたモデル1つの単価（100万トークンあたりの米ドル） */
export interface PagePrice {
  /** ページに書かれた名前（注記を外したもの） */
  displayName: string
  /** 名前から作ったモデルの id */
  model: string
  inputPerMillionUsd: number
  outputPerMillionUsd: number
  cacheReadPerMillionUsd: number
  cacheWrite5mPerMillionUsd: number
  cacheWrite1hPerMillionUsd: number
}

/** 読み解いた結果 */
export type PricingPageParseResult =
  | {
      isParsed: true
      prices: PagePrice[]
      /** 単価の表にあったが、id に対応づけられなかった・値を読めなかった名前 */
      unmappedNames: string[]
      /** バッチの単価が通常の何 % か。読めなければ null */
      batchPricePercent: number | null
      /** バッチの単価が、読めた割合と違うモデル（その割合を掛けると金額がずれる） */
      batchExceptionNames: string[]
    }
  | { isParsed: false; reason: string }

/** Markdown の表（直前の見出し・見出しの行・本文の行） */
export interface MarkdownTable {
  /** 表より前にある、いちばん近い Markdown の見出し（`#` を外した文字）。無ければ null */
  heading: string | null
  headerCells: string[]
  rows: string[][]
}

/** 比べるときの許し（小数の誤差） */
const RATIO_TOLERANCE = 1e-9

/** `| a | b |` を ["a", "b"] にする */
function splitTableRow(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim())
}

function isSeparatorRow(cells: readonly string[]): boolean {
  return cells.every((cell) => /^:?-{2,}:?$/.test(cell))
}

/** 本文から Markdown の表をすべて取り出す */
export function extractTables(markdown: string): MarkdownTable[] {
  const tables: MarkdownTable[] = []
  let currentLines: string[] = []
  let currentHeading: string | null = null
  const flush = () => {
    if (currentLines.length >= 2) {
      const [headerLine, ...bodyLines] = currentLines
      tables.push({
        heading: currentHeading,
        headerCells: splitTableRow(headerLine),
        rows: bodyLines
          .map(splitTableRow)
          .filter((cells) => !isSeparatorRow(cells)),
      })
    }
    currentLines = []
  }
  markdown.split(/\r?\n/).forEach((line) => {
    if (line.trim().startsWith("|")) {
      currentLines.push(line)
      return
    }
    flush()
    const headingMatch = /^\s{0,3}#{1,6}\s+(.*?)\s*#*\s*$/.exec(line)
    if (headingMatch) currentHeading = headingMatch[1]
  })
  flush()
  return tables
}

/** 列名から、行のその列の中身を引く口 */
export type CellReader<Name extends string> = (
  cells: readonly string[],
  columnName: Name
) => string

/**
 * 求める列がすべてそろっていれば、列名で行の中身を引く口を返す。
 * 列は見出しの文字で探し、当たる見出しが複数あれば左のものを使う
 */
export function findColumns<Name extends string>(
  headerCells: readonly string[],
  columnPatterns: Readonly<Record<Name, RegExp>>,
  columnNames: readonly Name[]
): CellReader<Name> | null {
  const positions = new Map<Name, number>()
  columnNames.forEach((columnName) => {
    const position = headerCells.findIndex((headerCell) =>
      columnPatterns[columnName].test(headerCell)
    )
    if (position >= 0) positions.set(columnName, position)
  })
  if (positions.size !== columnNames.length) return null
  return (cells, columnName) => cells[positions.get(columnName) ?? -1] ?? ""
}

/** 脚注（`<sup>…</sup>`）と強調の印を外す */
export function stripFootnotes(cell: string): string {
  return cell
    .replace(/<sup>.*?<\/sup>/gi, "")
    .replace(/[*_]/g, "")
    .trim()
}

/** 名前の末尾の括弧の注記（リンクを含む）と脚注を外す */
export function cleanModelName(cell: string): string {
  return stripFootnotes(cell)
    .replace(/\s*\((?:[^()]|\([^()]*\))*\)\s*$/, "")
    .trim()
}

/** モデル1つの、バッチと通常の単価の比（入力・出力など欄ごと） */
export interface ModelBatchRatios {
  displayName: string
  ratios: number[]
}

function isSameRatio(ratioA: number, ratioB: number): boolean {
  return Math.abs(ratioA - ratioB) <= RATIO_TOLERANCE
}

/** 比（0〜1）を割合（%）にする。小数の誤差は丸める */
function ratioToPercent(ratio: number): number {
  return Math.round(ratio * 100 * 1e6) / 1e6
}

/**
 * バッチの比を、半分より多いモデルがそろって持つ比として読む。欄の比がそろわないモデルと、
 * 多数と違う比のモデルは「割合と違うモデル」に挙げる。半分より多いモデルがそろわなければ、
 * 割合は読まない（null）
 */
export function readMajorityBatchPercent(
  modelRatios: readonly ModelBatchRatios[]
): { batchPricePercent: number | null; batchExceptionNames: string[] } {
  const comparedModels = modelRatios.filter(
    (modelRatio) => modelRatio.ratios.length > 0
  )
  const uniformRatioOf = (modelRatio: ModelBatchRatios): number | null => {
    const [firstRatio] = modelRatio.ratios
    return modelRatio.ratios.every((ratio) => isSameRatio(ratio, firstRatio))
      ? firstRatio
      : null
  }
  const candidateRatios = comparedModels.flatMap((modelRatio) => {
    const ratio = uniformRatioOf(modelRatio)
    return ratio === null || ratio < 0 || ratio > 1 ? [] : [ratio]
  })
  const majorityRatio = candidateRatios.find(
    (candidateRatio) =>
      candidateRatios.filter((ratio) => isSameRatio(ratio, candidateRatio))
        .length *
        2 >
      comparedModels.length
  )
  if (majorityRatio === undefined) {
    return { batchPricePercent: null, batchExceptionNames: [] }
  }
  return {
    batchPricePercent: ratioToPercent(majorityRatio),
    batchExceptionNames: comparedModels
      .filter((modelRatio) => {
        const ratio = uniformRatioOf(modelRatio)
        return ratio === null || !isSameRatio(ratio, majorityRatio)
      })
      .map((modelRatio) => modelRatio.displayName),
  }
}

/**
 * バッチと通常の単価の比（モデル・欄ごと）から、すべて同じ比のときだけ割合（%）を返す。
 * 比が1つも無い・そろわない・0〜1 を外れるときは null
 */
export function percentFromUniformRatios(
  ratios: readonly number[]
): number | null {
  if (ratios.length === 0) return null
  const [firstRatio] = ratios
  if (ratios.some((ratio) => !isSameRatio(ratio, firstRatio))) return null
  if (firstRatio < 0 || firstRatio > 1) return null
  return ratioToPercent(firstRatio)
}
