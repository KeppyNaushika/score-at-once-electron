/**
 * resolveExamPaperSize のユニットテスト
 *
 * 注釈の fontSize / strokeWidth は mm で保持し「mm ÷ 用紙幅」でピクセルへ換算するため、
 * 採点画面・プレビュー・PDF出力で同じ用紙サイズを使わないと同じ注釈が経路ごとに
 * 違う大きさで出る。選び方を1箇所へ集約したので、その条件をここで固定する。
 */
import { describe, expect, it } from "vitest"

import { resolveExamPaperSize } from "../../electron-src/lib/shared/utilities/examPaperSize"

describe("resolveExamPaperSize", () => {
  it("ページ番号が最小のページの用紙サイズを採る", () => {
    expect(
      resolveExamPaperSize([
        { pageNumber: 2, imagePath: "b.png", pageSize: "A4" },
        { pageNumber: 1, imagePath: "a.png", pageSize: "B4" },
      ])
    ).toBe("B4")
  })

  it("取得順が番号順でなくても番号で決める", () => {
    // include に orderBy が無い経路があり、取得順は当てにできない
    expect(
      resolveExamPaperSize([
        { pageNumber: 3, imagePath: "c.png", pageSize: "A3" },
        { pageNumber: 1, imagePath: "a.png", pageSize: "B4" },
        { pageNumber: 2, imagePath: "b.png", pageSize: "A5" },
      ])
    ).toBe("B4")
  })

  it("模範解答画像の無いページは無視する", () => {
    // 旧バージョンで模範解答だけを削除されたページ。pageSize は既定値のまま
    // 放置されているので、混ぜると実際の用紙と食い違う
    expect(
      resolveExamPaperSize([
        { pageNumber: 1, imagePath: null, pageSize: "A4" },
        { pageNumber: 2, imagePath: "b.png", pageSize: "B4" },
      ])
    ).toBe("B4")
  })

  it("画像を持つページが1枚も無ければA4", () => {
    expect(
      resolveExamPaperSize([{ pageNumber: 1, imagePath: null, pageSize: "B4" }])
    ).toBe("A4")
  })

  it("ページが空・未取得ならA4", () => {
    expect(resolveExamPaperSize([])).toBe("A4")
    expect(resolveExamPaperSize(undefined)).toBe("A4")
    expect(resolveExamPaperSize(null)).toBe("A4")
  })
})
