// @vitest-environment jsdom
/**
 * 注釈の本文を MathJax に渡す HTML にする変換（`annotationMarkup.ts`）。
 *
 * 本文は DB の値（取り込んだ `.sao` の他人の文字も入る）なので、HTML の特殊文字は文字として
 * 出し、要素になるのは記法から作る strong/em/u/del だけであることを縛る。記法と数式の扱いは
 * 今までどおりであることも合わせて見る。
 */
import { describe, expect, it } from "vitest"

import {
  escapeHtml,
  parseTextWithMath,
  sanitizeCssColor,
} from "@/lib/textbox-canvas/annotationMarkup"

/** 記法から作るタグ（これ以外の要素が出てきたら、本文が HTML として解釈されている） */
const MARKUP_TAG_NAMES = new Set(["STRONG", "EM", "U", "DEL"])

/** 描く側と同じく innerHTML で読み込んだ要素 */
function loadAsHtml(html: string): HTMLDivElement {
  const container = document.createElement("div")
  container.innerHTML = html
  return container
}

function elementTagNamesOf(container: HTMLElement): string[] {
  return Array.from(container.querySelectorAll("*")).map(
    (element) => element.tagName
  )
}

describe("escapeHtml", () => {
  it("& < > \" ' を文字参照にする", () => {
    expect(escapeHtml(`&<>"'`)).toBe("&amp;&lt;&gt;&quot;&#39;")
  })

  it("記法と数式の区切りに使う文字は変えない", () => {
    expect(escapeHtml("**a** __b__ ~~c~~ $x$ \\(y\\)")).toBe(
      "**a** __b__ ~~c~~ $x$ \\(y\\)"
    )
  })
})

describe("parseTextWithMath: HTML の特殊文字は文字のまま", () => {
  /** タグに見える本文（エスケープしなければ要素になるもの） */
  const htmlLikeTexts = [
    `<img src="x" alt="画像">`,
    `<script>void 0</script>`,
    `<a href="#">リンク</a>`,
    `"><svg></svg>`,
    `<iframe></iframe>`,
    `a < b && c > d`,
    `&lt; は文字参照のまま &amp;`,
  ]

  it.each(htmlLikeTexts)("タグに見える本文 %# は要素にならず、そのままの文字で出る", (text) => {
    const container = loadAsHtml(parseTextWithMath(text))
    expect(elementTagNamesOf(container)).toEqual([])
    expect(container.textContent).toBe(text)
  })

  it("記法の中に書いたタグも文字のまま（要素は記法のタグだけ）", () => {
    const text = `**<img src="x">** と __<b>下線</b>__`
    const container = loadAsHtml(parseTextWithMath(text))
    expect(
      elementTagNamesOf(container).every((tagName) =>
        MARKUP_TAG_NAMES.has(tagName)
      )
    ).toBe(true)
    expect(container.querySelector("strong")?.textContent).toBe('<img src="x">')
    expect(container.querySelector("u")?.textContent).toBe("<b>下線</b>")
  })
})

describe("parseTextWithMath: 記法と数式は今までどおり", () => {
  it("**太字**・*斜体*・__下線__・~~取り消し~~ をタグにする", () => {
    expect(parseTextWithMath("**太字**")).toBe("<strong>太字</strong>")
    expect(parseTextWithMath("*斜体*")).toBe("<em>斜体</em>")
    expect(parseTextWithMath("__下線__")).toBe("<u>下線</u>")
    expect(parseTextWithMath("~~取り消し~~")).toBe("<del>取り消し</del>")
  })

  it("数式の中の * は記法として扱わない", () => {
    expect(parseTextWithMath("$a*b*c$ と *強調*")).toBe(
      "$a*b*c$ と <em>強調</em>"
    )
  })

  it("\\( \\) と \\[ \\] は $ 記法にそろえる", () => {
    expect(parseTextWithMath("\\(x^2\\)")).toBe("$x^2$")
    expect(parseTextWithMath("\\[\\frac{1}{2}\\]")).toBe("$$\\frac{1}{2}$$")
  })

  it("数式の中の < は読み込むと文字に戻り、TeX としてそのまま MathJax に届く", () => {
    const container = loadAsHtml(parseTextWithMath("$a<b$ かつ $c>d$"))
    expect(elementTagNamesOf(container)).toEqual([])
    expect(container.textContent).toBe("$a<b$ かつ $c>d$")
  })

  it("記法の中の数式もそのまま残る", () => {
    const container = loadAsHtml(parseTextWithMath("**答えは $x=1$**"))
    expect(container.querySelector("strong")?.textContent).toBe(
      "答えは $x=1$"
    )
  })
})

describe("sanitizeCssColor", () => {
  it.each(["#ef4444", "#F00", "#ff000080", "rgb(255, 0, 0)", "rgba(0,0,0,0.5)", "hsl(0 100% 50%)", "red"])(
    "%s は色として通す",
    (color) => {
      expect(sanitizeCssColor(color, "#000000")).toBe(color)
    }
  )

  it.each([
    "red; background: url(x)",
    '#000"><b>x</b>',
    "rgb(0,0,0);display:none",
    "expression(1)",
    "",
  ])("色でない値 %# は既定の色にする", (color) => {
    expect(sanitizeCssColor(color, "#000000")).toBe("#000000")
  })
})
