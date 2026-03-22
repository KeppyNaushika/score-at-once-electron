/**
 * 個人成績表の印刷用スタイル
 * @media print で適用されるスタイルを定義
 */

/**
 * 印刷用のグローバルスタイルをヘッドに注入
 * コンポーネントのマウント時に呼び出す
 */
export function injectPrintStyles(): () => void {
  const styleId = "individual-report-print-styles"

  // 既存のスタイルがあれば削除
  const existing = document.getElementById(styleId)
  if (existing) {
    existing.remove()
  }

  const style = document.createElement("style")
  style.id = styleId
  style.textContent = `
    @media print {
      /* ページ設定 */
      @page {
        size: A4 portrait;
        margin: 10mm;
      }

      /* 印刷時に非表示にする要素 */
      .no-print,
      .no-print * {
        display: none !important;
      }

      /* ページ区切り */
      .page-break {
        page-break-after: always;
      }

      .page-break-before {
        page-break-before: always;
      }

      /* ページ内で分割しない */
      .no-break {
        page-break-inside: avoid;
      }

      /* 個人成績表ページのスタイル */
      .individual-report-page {
        width: 190mm !important;
        min-height: auto !important;
        padding: 0 !important;
        margin: 0 !important;
        transform: none !important;
        box-shadow: none !important;
        border: none !important;
      }

      /* テーブルのスタイル */
      .individual-report-page table {
        page-break-inside: auto;
      }

      .individual-report-page tr {
        page-break-inside: avoid;
        page-break-after: auto;
      }

      /* SVGのスタイル */
      .individual-report-page svg {
        page-break-inside: avoid;
      }

      /* 背景色を印刷 */
      * {
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
        color-adjust: exact !important;
      }

      /* フォント設定 */
      body {
        font-family: "Noto Sans JP", "Hiragino Sans", sans-serif !important;
      }
    }
  `

  document.head.appendChild(style)

  // クリーンアップ関数を返す
  return () => {
    const el = document.getElementById(styleId)
    if (el) {
      el.remove()
    }
  }
}

/**
 * 印刷用のHTMLテンプレートを生成
 * printToPDF用に使用
 */
export function generatePrintHtml(
  content: string,
  options?: {
    title?: string
  }
): string {
  const title = options?.title || "個人成績表"

  return `
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
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
      line-height: 1.5;
      color: #1a1a1a;
      background: white;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    .page-break {
      page-break-after: always;
    }

    .no-break {
      page-break-inside: avoid;
    }

    /* A4ページコンテナ */
    .individual-report-page {
      width: 190mm;
      min-height: 277mm;
      padding: 0;
      margin: 0 auto;
      background: white;
    }

    /* テーブルスタイル */
    table {
      width: 100%;
      border-collapse: collapse;
    }

    tr {
      page-break-inside: avoid;
    }

    /* SVGスタイル */
    svg {
      page-break-inside: avoid;
    }
  </style>
</head>
<body>
  ${content}
</body>
</html>
`
}
