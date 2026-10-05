/**
 * 「ページから読み込む」で取ってきた Anthropic の料金のページ（Markdown）を読み解く。
 *
 * main は本文をそのまま返すだけで、表を探して単価を読むのはここ。**列は見出しの文字で
 * 探す**（並び順に頼らない）。読めたものは下書きにするだけで、保存は教員が決める。
 *
 * - 単価の表: 見出しに「モデル」と、基本の入力・5分のキャッシュ書き込み・1時間の
 *   キャッシュ書き込み・キャッシュヒット・出力の5列がそろった最初の表
 * - 値: `$X / MTok`（脚注の `<sup>…</sup>` は無視する）
 * - モデル名: 「Claude Opus 5.5」→ `claude-opus-5-5`（小文字にし、空白と点をハイフンに）。
 *   括弧の注記（提供の終了・限定提供など）と脚注は外す。この形に当てはまらない名前は
 *   推し量らず「対応づけられなかった名前」に挙げる
 * - バッチ: 見出しにバッチの入力・出力がある表が別にあれば、基本の単価との比を全モデルで
 *   比べ、すべて同じ比のときだけ割合として読む（文章の言い回しには頼らない）。
 *   そろわなければ読まない（利用者の割合はそのまま）
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
    }
  | { isParsed: false; reason: string }

/** 列の見出しの見分け方（英語・日本語のどちらの見出しでも当たるように） */
const COLUMN_PATTERNS = {
  model: /^(model|モデル)/i,
  input: /base input|基本入力|ベース入力/i,
  cacheWrite5m: /5\s*m\s*cache write|5\s*分.*キャッシュ.*書/i,
  cacheWrite1h: /1\s*h\s*cache write|1\s*時間.*キャッシュ.*書/i,
  cacheRead: /cache hit|キャッシュ.*ヒット/i,
  output: /^output|出力/i,
  batchInput: /batch input|バッチ.*入力/i,
  batchOutput: /batch output|バッチ.*出力/i,
} as const

type ColumnName = keyof typeof COLUMN_PATTERNS

/** id にできるモデル名の形（「Claude」＋名前＋版） */
const MAPPABLE_MODEL_NAME = /^Claude(?: [A-Za-z]+)+ \d+(?:\.\d+)*$/

/** 比べるときの許し（小数の誤差） */
const RATIO_TOLERANCE = 1e-9

/** Markdown の表（見出しの行と本文の行） */
interface MarkdownTable {
  headerCells: string[]
  rows: string[][]
}

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
function extractTables(markdown: string): MarkdownTable[] {
  const tables: MarkdownTable[] = []
  let currentLines: string[] = []
  const flush = () => {
    if (currentLines.length >= 2) {
      const [headerLine, ...bodyLines] = currentLines
      tables.push({
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
    } else {
      flush()
    }
  })
  flush()
  return tables
}

/** 列名から、行のその列の中身を引く口 */
type CellReader<Name extends ColumnName> = (
  cells: readonly string[],
  columnName: Name
) => string

/** 求める列がすべてそろっていれば、列名で行の中身を引く口を返す */
function findColumns<Name extends ColumnName>(
  headerCells: readonly string[],
  columnNames: readonly Name[]
): CellReader<Name> | null {
  const positions = new Map<ColumnName, number>()
  columnNames.forEach((columnName) => {
    const position = headerCells.findIndex((headerCell) =>
      COLUMN_PATTERNS[columnName].test(headerCell)
    )
    if (position >= 0) positions.set(columnName, position)
  })
  if (positions.size !== columnNames.length) return null
  return (cells, columnName) => cells[positions.get(columnName) ?? -1] ?? ""
}

/** 脚注（`<sup>…</sup>`）と強調の印を外す */
function stripFootnotes(cell: string): string {
  return cell
    .replace(/<sup>.*?<\/sup>/gi, "")
    .replace(/[*_]/g, "")
    .trim()
}

/** `$4 / MTok` を 4 にする。読めなければ null */
export function parseMtokPrice(cell: string): number | null {
  const match = /\$\s*([0-9]+(?:\.[0-9]+)?)\s*\/\s*MTok/i.exec(
    stripFootnotes(cell)
  )
  return match ? Number(match[1]) : null
}

/** 名前の括弧の注記（リンクを含む）と脚注を外す */
export function cleanModelName(cell: string): string {
  return stripFootnotes(cell)
    .replace(/\s*\((?:[^()]|\([^()]*\))*\)\s*$/, "")
    .trim()
}

/** 「Claude Opus 5.5」を `claude-opus-5-5` にする。この形でなければ null */
export function modelIdFromDisplayName(displayName: string): string | null {
  if (!MAPPABLE_MODEL_NAME.test(displayName)) return null
  return displayName.toLowerCase().replace(/[\s.]+/g, "-")
}

/** バッチの表から、すべてのモデルで同じ比のときだけ割合を読む */
function readBatchPricePercent(
  tables: readonly MarkdownTable[],
  prices: readonly PagePrice[]
): number | null {
  const priceByName = new Map(
    prices.map((pagePrice) => [pagePrice.displayName, pagePrice])
  )
  const ratios = tables.flatMap((table) => {
    const readCell = findColumns(table.headerCells, [
      "model",
      "batchInput",
      "batchOutput",
    ])
    if (!readCell) return []
    return table.rows.flatMap((cells) => {
      const pagePrice = priceByName.get(
        cleanModelName(readCell(cells, "model"))
      )
      const batchInput = parseMtokPrice(readCell(cells, "batchInput"))
      const batchOutput = parseMtokPrice(readCell(cells, "batchOutput"))
      if (!pagePrice || batchInput === null || batchOutput === null) return []
      if (
        pagePrice.inputPerMillionUsd === 0 ||
        pagePrice.outputPerMillionUsd === 0
      ) {
        return []
      }
      return [
        batchInput / pagePrice.inputPerMillionUsd,
        batchOutput / pagePrice.outputPerMillionUsd,
      ]
    })
  })
  if (ratios.length === 0) return null
  const [firstRatio] = ratios
  if (ratios.some((ratio) => Math.abs(ratio - firstRatio) > RATIO_TOLERANCE)) {
    return null
  }
  if (firstRatio < 0 || firstRatio > 1) return null
  return Math.round(firstRatio * 100 * 1e6) / 1e6
}

/** 料金のページの本文を読み解く */
export function parseAnthropicPricingPage(
  markdown: string
): PricingPageParseResult {
  const tables = extractTables(markdown)
  const priceTable = tables
    .map((table) => ({
      table,
      readCell: findColumns(table.headerCells, [
        "model",
        "input",
        "cacheWrite5m",
        "cacheWrite1h",
        "cacheRead",
        "output",
      ]),
    }))
    .find((candidate) => candidate.readCell !== null)
  if (!priceTable || !priceTable.readCell) {
    return {
      isParsed: false,
      reason:
        "単価の表が見つかりませんでした（ページの形が変わったか、Markdown でない形が返りました）",
    }
  }
  const { readCell } = priceTable
  const prices: PagePrice[] = []
  const unmappedNames: string[] = []
  priceTable.table.rows.forEach((cells) => {
    const displayName = cleanModelName(readCell(cells, "model"))
    if (displayName === "") return
    const model = modelIdFromDisplayName(displayName)
    const amounts = {
      inputPerMillionUsd: parseMtokPrice(readCell(cells, "input")),
      outputPerMillionUsd: parseMtokPrice(readCell(cells, "output")),
      cacheReadPerMillionUsd: parseMtokPrice(readCell(cells, "cacheRead")),
      cacheWrite5mPerMillionUsd: parseMtokPrice(
        readCell(cells, "cacheWrite5m")
      ),
      cacheWrite1hPerMillionUsd: parseMtokPrice(
        readCell(cells, "cacheWrite1h")
      ),
    }
    const {
      inputPerMillionUsd,
      outputPerMillionUsd,
      cacheReadPerMillionUsd,
      cacheWrite5mPerMillionUsd,
      cacheWrite1hPerMillionUsd,
    } = amounts
    if (
      model === null ||
      inputPerMillionUsd === null ||
      outputPerMillionUsd === null ||
      cacheReadPerMillionUsd === null ||
      cacheWrite5mPerMillionUsd === null ||
      cacheWrite1hPerMillionUsd === null
    ) {
      unmappedNames.push(displayName)
      return
    }
    prices.push({
      displayName,
      model,
      inputPerMillionUsd,
      outputPerMillionUsd,
      cacheReadPerMillionUsd,
      cacheWrite5mPerMillionUsd,
      cacheWrite1hPerMillionUsd,
    })
  })
  if (prices.length === 0) {
    return {
      isParsed: false,
      reason: "単価の表から、読めるモデルが1つもありませんでした",
    }
  }
  return {
    isParsed: true,
    prices,
    unmappedNames,
    batchPricePercent: readBatchPricePercent(tables, prices),
  }
}
