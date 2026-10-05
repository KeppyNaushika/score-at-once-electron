/**
 * 「ページから読み込む」で取ってきた OpenAI の料金のページ（Markdown）を読み解く。
 *
 * main は本文をそのまま返すだけで、表を探して単価を読むのはここ（表の取り出しなど事業者に
 * 依らない部品は `pricingPageMarkdown.ts`）。**列は見出しの文字で探す**（並び順に頼らない）。
 * 読めたものは下書きにするだけで、保存は教員が決める。
 *
 * - ページには処理の区分（ティア）ごとに同じ形の表が並び、表の直前の見出しが区分の名前で
 *   始まる。単価は見出しが「Standard」で始まり、モデル・入力・キャッシュ入力・出力の列が
 *   そろった最初の表から読む。アプリは区分を指定せずに送る（`providers/openaiProvider.ts`）
 *   ので、ほかの区分（Flex など）の表は読まない
 * - 入力の長さで単価の分かれる表は、短い側（「Short context …」の列）を読む。採点の依頼は
 *   長い側の境目に届かない
 * - 値: `$X`（100万トークンあたり）。`-` は「別の料金が無い」
 * - キャッシュ: OpenAI の使用量は、キャッシュの読み書きを入力から抜き出して数える
 *   （`openaiProvider.ts` の `toProviderUsage`）。だから別の料金が無い（`-`・列が無い）
 *   ときは入力と同じ単価にする（0 にすると、その分を数えずに安く見積もる）。
 *   キャッシュの書き込みに保持の長さの区別は無いので、5分・1時間の両方に同じ値を入れる
 * - モデル名: 表の名前がそのままモデルの id。末尾の括弧の注記（入力の長さの区切りなど）と
 *   脚注は外す。id の形（小文字・数字を `-` と `.` でつないだもの）に当てはまらない名前は
 *   推し量らず「対応づけられなかった名前」に挙げる
 * - バッチ: 見出しが「Batch」で始まる表があれば、通常の単価との比（入力・出力）をモデルごとに
 *   求め、半分より多いモデルがそろって持つ比を割合として読む（文章の言い回しには頼らない）。
 *   古いモデルに割引の無いものがあり、全モデルの一致を求めると読めないため。割合はアプリでは
 *   事業者に1つなので、違う比のモデルは「割合と違うモデル」として下書きに挙げる
 */

import {
  type CellReader,
  cleanModelName,
  extractTables,
  findColumns,
  type MarkdownTable,
  type ModelBatchRatios,
  type PagePrice,
  type PricingPageParseResult,
  readMajorityBatchPercent,
  stripFootnotes,
} from "./pricingPageMarkdown"

/** 列の見出しの見分け方（入力の長さで分かれる表では短い側に当てる） */
const COLUMN_PATTERNS = {
  model: /^model$/i,
  input: /^(?:short context\s+)?input$/i,
  cacheRead: /^(?:short context\s+)?cached input$/i,
  cacheWrite: /^(?:short context\s+)?cache writes?$/i,
  output: /^(?:short context\s+)?output$/i,
} as const

type ColumnName = keyof typeof COLUMN_PATTERNS

/** 単価の表に欠かせない列（キャッシュの書き込みの列は無い表もある） */
const REQUIRED_COLUMN_NAMES: readonly ColumnName[] = [
  "model",
  "input",
  "cacheRead",
  "output",
]

/** 表の直前の見出しから区分を見分ける */
const STANDARD_TIER_HEADING = /^standard\b/i
const BATCH_TIER_HEADING = /^batch\b/i

/** モデルの id の形 */
const MODEL_ID_PATTERN = /^[a-z0-9]+(?:[.-][a-z0-9]+)*$/

/** `$1.25` を 1.25 にする。読めなければ null */
export function parseDollarPrice(cell: string): number | null {
  const match = /^\$\s*([0-9][0-9,]*(?:\.[0-9]+)?)$/.exec(stripFootnotes(cell))
  return match ? Number(match[1].replace(/,/g, "")) : null
}

/** 別の料金が無いことを表す欄か（`-` と空欄） */
function isNoPriceCell(cell: string): boolean {
  return /^[-–—]?$/.test(stripFootnotes(cell))
}

/** 名前がそのままモデルの id にできれば返す。できなければ null */
export function openaiModelIdFromName(displayName: string): string | null {
  return MODEL_ID_PATTERN.test(displayName) ? displayName : null
}

/**
 * キャッシュの欄の単価。値があればその値、別の料金が無ければ入力と同じ、
 * 読めない文字なら null
 */
function readCachePrice(
  cell: string | null,
  inputPerMillionUsd: number
): number | null {
  if (cell === null || isNoPriceCell(cell)) return inputPerMillionUsd
  return parseDollarPrice(cell)
}

/** 直前の見出しが区分に当たり、単価の列がそろった最初の表 */
function findTierTable(
  tables: readonly MarkdownTable[],
  tierHeading: RegExp
): { table: MarkdownTable; readCell: CellReader<ColumnName> } | null {
  const tierTables = tables.flatMap((table) => {
    if (table.heading === null || !tierHeading.test(table.heading)) return []
    const readCell = findColumns(
      table.headerCells,
      COLUMN_PATTERNS,
      REQUIRED_COLUMN_NAMES
    )
    return readCell ? [{ table, readCell }] : []
  })
  return tierTables[0] ?? null
}

/** バッチの表から、通常の単価との比を読む（多数のモデルがそろって持つ比を割合にする） */
function readBatchPricePercent(
  tables: readonly MarkdownTable[],
  prices: readonly PagePrice[]
): { batchPricePercent: number | null; batchExceptionNames: string[] } {
  const batchTable = findTierTable(tables, BATCH_TIER_HEADING)
  if (!batchTable) return { batchPricePercent: null, batchExceptionNames: [] }
  const { readCell } = batchTable
  const priceByModel = new Map(
    prices.map((pagePrice) => [pagePrice.model, pagePrice])
  )
  const modelRatios = batchTable.table.rows.flatMap(
    (cells): ModelBatchRatios[] => {
      const pagePrice = priceByModel.get(
        cleanModelName(readCell(cells, "model"))
      )
      const batchInput = parseDollarPrice(readCell(cells, "input"))
      const batchOutput = parseDollarPrice(readCell(cells, "output"))
      if (!pagePrice || batchInput === null || batchOutput === null) return []
      if (
        pagePrice.inputPerMillionUsd === 0 ||
        pagePrice.outputPerMillionUsd === 0
      ) {
        return []
      }
      return [
        {
          displayName: pagePrice.displayName,
          ratios: [
            batchInput / pagePrice.inputPerMillionUsd,
            batchOutput / pagePrice.outputPerMillionUsd,
          ],
        },
      ]
    }
  )
  return readMajorityBatchPercent(modelRatios)
}

/** 料金のページの本文を読み解く */
export function parseOpenaiPricingPage(
  markdown: string
): PricingPageParseResult {
  const tables = extractTables(markdown)
  const standardTable = findTierTable(tables, STANDARD_TIER_HEADING)
  if (!standardTable) {
    return {
      isParsed: false,
      reason:
        "通常（Standard）の単価の表が見つかりませんでした（ページの形が変わったか、Markdown でない形が返りました）",
    }
  }
  const { readCell } = standardTable
  const readCacheWriteCell = findColumns(
    standardTable.table.headerCells,
    COLUMN_PATTERNS,
    ["cacheWrite"]
  )
  const prices: PagePrice[] = []
  const unmappedNames: string[] = []
  standardTable.table.rows.forEach((cells) => {
    const displayName = cleanModelName(readCell(cells, "model"))
    if (displayName === "") return
    const model = openaiModelIdFromName(displayName)
    const inputPerMillionUsd = parseDollarPrice(readCell(cells, "input"))
    const outputPerMillionUsd = parseDollarPrice(readCell(cells, "output"))
    const isDuplicate = prices.some((pagePrice) => pagePrice.model === model)
    if (
      model === null ||
      isDuplicate ||
      inputPerMillionUsd === null ||
      outputPerMillionUsd === null
    ) {
      unmappedNames.push(displayName)
      return
    }
    const cacheReadPerMillionUsd = readCachePrice(
      readCell(cells, "cacheRead"),
      inputPerMillionUsd
    )
    const cacheWritePerMillionUsd = readCachePrice(
      readCacheWriteCell ? readCacheWriteCell(cells, "cacheWrite") : null,
      inputPerMillionUsd
    )
    if (cacheReadPerMillionUsd === null || cacheWritePerMillionUsd === null) {
      unmappedNames.push(displayName)
      return
    }
    prices.push({
      displayName,
      model,
      inputPerMillionUsd,
      outputPerMillionUsd,
      cacheReadPerMillionUsd,
      cacheWrite5mPerMillionUsd: cacheWritePerMillionUsd,
      cacheWrite1hPerMillionUsd: cacheWritePerMillionUsd,
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
    ...readBatchPricePercent(tables, prices),
  }
}
