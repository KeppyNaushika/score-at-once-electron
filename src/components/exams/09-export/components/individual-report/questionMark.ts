/**
 * 評価マーク情報を取得
 * プレビュー（React）とPDF出力（renderToStaticMarkup）の両方で使用
 */
export function getMarkInfo(status: string): {
  mark: string
  markColor: string
} {
  switch (status) {
    case "correct":
      return { mark: "○", markColor: "#16a34a" }
    case "incorrect":
      return { mark: "×", markColor: "#dc2626" }
    case "partial":
      return { mark: "△", markColor: "#ca8a04" }
    case "no_answer":
      return { mark: "-", markColor: "#666" }
    default:
      return { mark: "", markColor: "#333" }
  }
}
