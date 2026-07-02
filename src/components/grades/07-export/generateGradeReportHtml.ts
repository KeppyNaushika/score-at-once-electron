/**
 * 成績算出試験の個人成績通知書HTML生成
 */
import type {
  GradeCalculationResult,
  GradeItemResult,
  StudentGradeResult,
} from "@/types/grade.types"

import type { GradeReportOptions } from "./types"

/**
 * 複数生徒分の個人成績通知書HTMLをページ区切りで結合
 */
export function generateGradeReportBatchHtml(
  result: GradeCalculationResult,
  studentIds: string[],
  options: GradeReportOptions
): string {
  const reportsHtml = studentIds
    .map((studentId, index) => {
      const student = result.students.find(
        (student) => student.studentId === studentId
      )
      if (!student) return ""
      const isLast = index === studentIds.length - 1
      const pageBreak = isLast ? "" : ' style="page-break-after: always;"'
      return `<div class="student-report"${pageBreak}>${renderStudentReport(result, student, options)}</div>`
    })
    .join("")

  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(options.title)}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 10mm;
    }
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    body {
      font-family: "Noto Sans JP", "Hiragino Sans", "Yu Gothic", "Meiryo", sans-serif;
      font-size: 12px;
      line-height: 1.6;
      color: #1a1a1a;
      background: white;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 11px;
    }
    th, td {
      border: 1px solid #333;
      padding: 4px 8px;
      text-align: center;
      font-size: inherit;
    }
    th {
      background-color: #f5f5f5;
      font-weight: 600;
    }
    .report-page {
      width: 190mm;
      min-height: 277mm;
      padding: 5mm;
      background: white;
      display: flex;
      flex-direction: column;
    }
    .report-content {
      flex: 1;
    }
    .report-title {
      text-align: center;
      font-size: 18px;
      font-weight: bold;
      margin-bottom: 8mm;
      padding-bottom: 3mm;
      border-bottom: 2px solid #333;
    }
    .student-info {
      margin-bottom: 6mm;
      font-size: 13px;
    }
    .student-info span {
      margin-right: 16px;
    }
    .section-title {
      font-size: 13px;
      font-weight: bold;
      margin: 6mm 0 3mm;
      padding-bottom: 1mm;
      border-bottom: 1px solid #999;
    }
    .comment-section {
      margin-top: 8mm;
      border: 1px solid #333;
      min-height: 30mm;
      padding: 3mm;
    }
    .comment-section .label {
      font-size: 11px;
      color: #666;
      margin-bottom: 2mm;
    }
    .signature-section {
      margin-top: 8mm;
      display: flex;
      justify-content: flex-end;
      gap: 10mm;
    }
    .stamp-box {
      width: 20mm;
      height: 20mm;
      border: 1px solid #333;
      text-align: center;
      font-size: 10px;
      padding-top: 1mm;
    }
    .multi-column-tables {
      display: flex;
      gap: 4px;
    }
    .multi-column-tables table {
      flex: 1;
      min-width: 0;
    }
    .report-footer {
      display: flex;
      justify-content: space-between;
      margin-top: 6mm;
      padding-top: 2mm;
      border-top: 1px solid #ccc;
      font-size: 10px;
    }
    .report-footer-left { text-align: left; }
    .report-footer-center { text-align: center; }
    .report-footer-right { text-align: right; }
  </style>
</head>
<body>
  ${reportsHtml}
</body>
</html>`
}

function renderStudentReport(
  _result: GradeCalculationResult,
  student: StudentGradeResult,
  options: GradeReportOptions
): string {
  const sections: string[] = []

  // タイトル
  sections.push(`<div class="report-title">${escapeHtml(options.title)}</div>`)

  // 生徒情報
  sections.push(`<div class="student-info">
    <span>${escapeHtml(student.className ?? "")}</span>
    <span>出席番号: ${student.attendanceNumber ?? "-"}</span>
    <span>${escapeHtml(student.lastName)} ${escapeHtml(student.firstName)}</span>
  </div>`)

  // 項目別評価
  if (options.showItemGrades && student.gradeItemResults.length > 0) {
    sections.push(renderItemGradesSection(student, options))
  }

  // データソース内訳
  if (options.showSourceBreakdown) {
    const breakdownHtml = renderSourceBreakdownSection(student, options)
    if (breakdownHtml) sections.push(breakdownHtml)
  }

  // コメント欄
  if (options.showCommentSection) {
    sections.push(`<div class="comment-section">
      <div class="label">コメント</div>
    </div>`)
  }

  // 押印欄
  if (options.showSignatureSection) {
    sections.push(`<div class="signature-section">
      <div class="stamp-box">保護者</div>
      <div class="stamp-box">担任</div>
      <div class="stamp-box">校長</div>
    </div>`)
  }

  // フッター
  const footer = options.footer
  const hasFooter = footer.left || footer.center || footer.right
  const footerHtml = hasFooter
    ? `<div class="report-footer">
        <div class="report-footer-left">${escapeHtmlMultiline(footer.left)}</div>
        <div class="report-footer-center">${escapeHtmlMultiline(footer.center)}</div>
        <div class="report-footer-right">${escapeHtmlMultiline(footer.right)}</div>
      </div>`
    : ""

  return `<div class="report-page"><div class="report-content">${sections.join("")}</div>${footerHtml}</div>`
}

/**
 * 項目別評価セクションを生成
 */
function renderItemGradesSection(
  student: StudentGradeResult,
  options: GradeReportOptions
): string {
  const cols = options.itemGradeColumns
  const fontSize = options.itemGradeFontSize
  const columns = Math.max(1, Math.min(5, options.itemGradeTableColumns))

  const buildHeaderRow = (): string => {
    const headerCols = ["<th>評価項目</th>"]
    if (cols.score) headerCols.push("<th>得点</th>")
    if (cols.percentage) headerCols.push("<th>得点率</th>")
    if (cols.gradeLabel) headerCols.push("<th>評価</th>")
    return `<tr>${headerCols.join("")}</tr>`
  }

  const buildItemRow = (item: GradeItemResult): string => {
    const cells = [
      `<td style="text-align:left">${escapeHtml(item.gradeItemName)}</td>`,
    ]
    if (cols.score) {
      const score =
        item.weightedScore !== null ? item.weightedScore.toFixed(1) : "-"
      cells.push(`<td>${score} / ${item.weightedMaxScore.toFixed(1)}</td>`)
    }
    if (cols.percentage) {
      const pct =
        item.percentage !== null ? item.percentage.toFixed(1) + "%" : "-"
      cells.push(`<td>${pct}</td>`)
    }
    if (cols.gradeLabel) {
      const label = item.gradeLabel ?? "-"
      cells.push(`<td><strong>${escapeHtml(label)}</strong></td>`)
    }
    return `<tr>${cells.join("")}</tr>`
  }

  const fontStyle = `style="font-size: ${fontSize}px"`
  const items = student.gradeItemResults

  if (columns <= 1) {
    const rows = items.map(buildItemRow).join("")
    return `<div class="section-title">項目別評価</div>
    <table ${fontStyle}><thead>${buildHeaderRow()}</thead><tbody>${rows}</tbody></table>`
  }

  // 多列レイアウト: アイテムを均等分割
  const chunks = splitIntoColumns(items, columns)
  const tables = chunks
    .map((chunk) => {
      const rows = chunk.map(buildItemRow).join("")
      return `<table ${fontStyle}><thead>${buildHeaderRow()}</thead><tbody>${rows}</tbody></table>`
    })
    .join("")

  return `<div class="section-title">項目別評価</div>
  <div class="multi-column-tables">${tables}</div>`
}

/**
 * データソース内訳セクションを生成（rowspan対応）
 */
function renderSourceBreakdownSection(
  student: StudentGradeResult,
  options: GradeReportOptions
): string | null {
  const srcCols = options.sourceBreakdownColumns
  const label = options.dataSourceLabel || "成績資料"
  const fontSize = options.sourceBreakdownFontSize
  const columns = Math.max(1, Math.min(5, options.sourceBreakdownTableColumns))

  // rowspan対応の行データを構築
  type BreakdownRow = {
    gradeItemName: string
    isFirstInGroup: boolean
    groupSize: number
    dataSourceName: string
    rawScore: number | null
    maxScore: number
    isEstimated: boolean
    weightedScore: number | null
    weight: number
    letterValue: string | null
    adjustment: number | null
    comment: string | null
  }

  const allRows: BreakdownRow[] = []
  for (const item of student.gradeItemResults) {
    const sources = item.sourceScores
    for (let i = 0; i < sources.length; i++) {
      const source = sources[i]
      allRows.push({
        gradeItemName: item.gradeItemName,
        isFirstInGroup: i === 0,
        groupSize: sources.length,
        dataSourceName: source.dataSourceName,
        rawScore: source.rawScore,
        maxScore: source.maxScore,
        isEstimated: source.isEstimated,
        weightedScore: source.weightedScore,
        weight: source.weight,
        letterValue: source.letterValue,
        adjustment: source.adjustment,
        comment: source.comment,
      })
    }
  }

  if (allRows.length === 0) return null

  // コメントが1つでもあるか（列の有無判定にも使用）
  const hasAnyComment = allRows.some(
    (row) => row.comment !== null && row.comment !== ""
  )
  const showComment = srcCols.comment && hasAnyComment

  const buildHeaderRow = (): string => {
    const headerCols = [`<th>項目</th>`, `<th>${escapeHtml(label)}</th>`]
    if (srcCols.score) headerCols.push("<th>得点</th>")
    if (srcCols.weight) headerCols.push("<th>換算得点</th>")
    if (showComment) headerCols.push("<th>コメント</th>")
    return `<tr>${headerCols.join("")}</tr>`
  }

  const buildRow = (row: BreakdownRow): string => {
    const cells: string[] = []
    if (row.isFirstInGroup) {
      const rowspanAttr = row.groupSize > 1 ? ` rowspan="${row.groupSize}"` : ""
      cells.push(
        `<td style="text-align:left; vertical-align:middle"${rowspanAttr}>${escapeHtml(row.gradeItemName)}</td>`
      )
    }
    cells.push(
      `<td style="text-align:left">${escapeHtml(row.dataSourceName)}</td>`
    )
    if (srcCols.score) {
      // 文字評価は「記号(換算点)」、数値はそのまま。加減点があれば併記。
      const scoreText =
        row.rawScore !== null
          ? row.letterValue !== null
            ? `${escapeHtml(row.letterValue)} (${row.rawScore.toFixed(1)})`
            : row.rawScore.toFixed(1)
          : "-"
      const estimated = row.isEstimated ? " (推定)" : ""
      const adj =
        row.adjustment !== null && row.adjustment !== 0
          ? ` <span style="color:#b45309">[${row.adjustment > 0 ? "+" : ""}${row.adjustment}]</span>`
          : ""
      cells.push(
        `<td>${scoreText}${estimated} / ${row.maxScore.toFixed(1)}${adj}</td>`
      )
    }
    if (srcCols.weight) {
      const weighted =
        row.weightedScore !== null ? row.weightedScore.toFixed(2) : "-"
      cells.push(`<td>${weighted} / ${row.weight.toFixed(2)}</td>`)
    }
    if (showComment) {
      cells.push(
        `<td style="text-align:left">${escapeHtml(row.comment ?? "")}</td>`
      )
    }
    return `<tr>${cells.join("")}</tr>`
  }

  const fontStyle = `style="font-size: ${fontSize}px"`

  if (columns <= 1) {
    const rows = allRows.map(buildRow).join("")
    return `<div class="section-title">${escapeHtml(label)}内訳</div>
    <table ${fontStyle}>
      <thead>${buildHeaderRow()}</thead>
      <tbody>${rows}</tbody>
    </table>`
  }

  // 多列レイアウト: gradeItemグループ単位で分割
  const groups: BreakdownRow[][] = []
  let currentGroup: BreakdownRow[] = []
  for (const row of allRows) {
    if (row.isFirstInGroup && currentGroup.length > 0) {
      groups.push(currentGroup)
      currentGroup = []
    }
    currentGroup.push(row)
  }
  if (currentGroup.length > 0) groups.push(currentGroup)

  const columnGroups = splitIntoColumns(groups, columns)
  const tables = columnGroups
    .map((chunk) => {
      const flatRows = chunk.flat()
      const rows = flatRows.map(buildRow).join("")
      return `<table ${fontStyle}><thead>${buildHeaderRow()}</thead><tbody>${rows}</tbody></table>`
    })
    .join("")

  return `<div class="section-title">${escapeHtml(label)}内訳</div>
  <div class="multi-column-tables">${tables}</div>`
}

/**
 * 配列を指定列数に均等分割
 */
function splitIntoColumns<T>(items: T[], columns: number): T[][] {
  const perColumn = Math.ceil(items.length / columns)
  const result: T[][] = []
  for (let i = 0; i < columns; i++) {
    const chunk = items.slice(i * perColumn, (i + 1) * perColumn)
    if (chunk.length > 0) result.push(chunk)
  }
  return result
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

/** HTMLエスケープし、改行を <br> に変換する（フッター等の複数行テキスト用） */
function escapeHtmlMultiline(str: string): string {
  return escapeHtml(str).replace(/\r?\n/g, "<br>")
}
