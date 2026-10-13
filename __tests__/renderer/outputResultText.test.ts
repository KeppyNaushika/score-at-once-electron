/**
 * 出力の結果の文言（`src/lib/outputResultText.ts`）の固定。
 *
 * web 版の保存先は仮想パス（`/web-downloads/<uuid>/<ファイル名>`）なので、利用者にはファイル名
 * だけを見せる。デスクトップ版はパスをそのまま見せる（今までの表示を変えない）。
 */
import { describe, expect, it } from "vitest"

import { fileNameOfPath, savedFileLocationText } from "@/lib/outputResultText"

describe("fileNameOfPath", () => {
  it("区切りが / でも \\ でも最後の名前を取る", () => {
    expect(fileNameOfPath("/web-downloads/0f1e/採点データ.xlsx")).toBe(
      "採点データ.xlsx"
    )
    expect(fileNameOfPath("C:\\Users\\teacher\\output.pdf")).toBe("output.pdf")
    expect(fileNameOfPath("output.pdf")).toBe("output.pdf")
  })

  it("末尾が区切りで名前が無ければ、パスをそのまま返す", () => {
    expect(fileNameOfPath("/web-downloads/0f1e/")).toBe("/web-downloads/0f1e/")
  })
})

describe("savedFileLocationText", () => {
  it("デスクトップ版はパスをそのまま見せる", () => {
    expect(savedFileLocationText("/Users/teacher/output.pdf", false)).toBe(
      "/Users/teacher/output.pdf"
    )
  })

  it("web 版は仮想パスを見せず、ファイル名だけにする", () => {
    const shownText = savedFileLocationText(
      "/web-downloads/6f1c2a9e-1d1b-4c7e-9d1f-3a1b2c3d4e5f/試験.sao",
      true
    )
    expect(shownText).toBe("試験.sao")
    expect(shownText).not.toContain("web-downloads")
  })
})
