/**
 * 「ページから読み込む」で取ってきた Anthropic の料金のページ（Markdown）を読み解く。
 *
 * main は本文をそのまま返すだけで、表を探して単価を読むのはここ（表の取り出しなど事業者に
 * 依らない部品は `pricingPageMarkdown.ts`）。**列は見出しの文字で探す**（並び順に
 * 頼らない）。読めたものは下書きにするだけで、保存は教員が決める。
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

import {
  cleanModelName,
  extractTables,
  findColumns,
  type MarkdownTable,
  type PagePrice,
  percentFromUniformRatios,
  type PricingPageParseResult,
  stripFootnotes,
} from "./pricingPageMarkdown"

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

/** id にできるモデル名の形（「Claude」＋名前＋版） */
const MAPPABLE_MODEL_NAME = /^Claude(?: [A-Za-z]+)+ \d+(?:\.\d+)*$/

/** `$4 / MTok` を 4 にする。読めなければ null */
export function parseMtokPrice(cell: string): number | null {
  const match = /\$\s*([0-9]+(?:\.[0-9]+)?)\s*\/\s*MTok/i.exec(
    stripFootnotes(cell)
  )
  return match ? Number(match[1]) : null
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
    const readCell = findColumns(table.headerCells, COLUMN_PATTERNS, [
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
  return percentFromUniformRatios(ratios)
}

/** 料金のページの本文を読み解く */
export function parseAnthropicPricingPage(
  markdown: string
): PricingPageParseResult {
  const tables = extractTables(markdown)
  const priceTable = tables
    .map((table) => ({
      table,
      readCell: findColumns(table.headerCells, COLUMN_PATTERNS, [
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
    batchExceptionNames: [],
  }
}
