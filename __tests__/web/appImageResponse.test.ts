/**
 * web 版の画像を返す Service Worker（`web/serviceWorker/serviceWorker.ts`）が、何に答え、
 * どこのファイルを、どの形式・どの頭で返すか（`web/serviceWorker/appImageResponse.ts`）を縛る。
 *
 * - 画像として読む要求だけに答え、ページとして開く要求には答えない
 * - 返すのはデータフォルダ（OPFS の `data/`）の下だけ
 * - SVG は画像として描く読み方のときだけ。どの応答にも文書として解釈させない頭が付く
 */
import { describe, expect, it } from "vitest"

import {
  appImageContentTypeOf,
  appImageHeaders,
  appImageNotFound,
  DATA_DIRECTORY_SEGMENTS,
  isImageRequest,
  toDataDirectorySegments,
} from "../../web/serviceWorker/appImageResponse"

describe("答える要求", () => {
  it("<img> と fetch() の読み込みには答える", () => {
    expect(isImageRequest({ mode: "no-cors", destination: "image" })).toBe(true)
    // crossOrigin="anonymous" の <img>
    expect(isImageRequest({ mode: "cors", destination: "image" })).toBe(true)
    // PDF 出力の描画が fetch() で読む
    expect(isImageRequest({ mode: "cors", destination: "" })).toBe(true)
  })

  it("ページとして開く要求には答えない", () => {
    expect(isImageRequest({ mode: "navigate", destination: "document" })).toBe(
      false
    )
    expect(isImageRequest({ mode: "navigate", destination: "iframe" })).toBe(
      false
    )
    expect(isImageRequest({ mode: "navigate", destination: "frame" })).toBe(
      false
    )
    expect(isImageRequest({ mode: "no-cors", destination: "object" })).toBe(
      false
    )
    expect(isImageRequest({ mode: "no-cors", destination: "embed" })).toBe(
      false
    )
    expect(isImageRequest({ mode: "same-origin", destination: "worker" })).toBe(
      false
    )
    expect(isImageRequest({ mode: "no-cors", destination: "script" })).toBe(
      false
    )
  })
})

describe("パスの解決", () => {
  it("相対パスはデータフォルダの下を指す", () => {
    expect(DATA_DIRECTORY_SEGMENTS).toEqual(["data"])
    expect(toDataDirectorySegments("exams/exam-1/answers/page-1.png")).toEqual([
      "data",
      "exams",
      "exam-1",
      "answers",
      "page-1.png",
    ])
  })

  it("エンコードされた名前を戻して読む", () => {
    expect(toDataDirectorySegments(encodeURI("exams/試験 1/解答.png"))).toEqual(
      ["data", "exams", "試験 1", "解答.png"]
    )
  })

  it("旧版の projects/ は exams/ として読む", () => {
    expect(toDataDirectorySegments("projects/exam-1/page.png")).toEqual([
      "data",
      "exams",
      "exam-1",
      "page.png",
    ])
  })

  it("絶対パスは断る", () => {
    expect(toDataDirectorySegments("/opfs/userData/auth.json")).toBeNull()
    expect(toDataDirectorySegments("%2Fopfs%2Fdata%2Fx.png")).toBeNull()
    expect(toDataDirectorySegments("/exams/exam-1/page.png")).toBeNull()
  })

  it("データフォルダの外へ出るパスは断る", () => {
    expect(toDataDirectorySegments("../userData/auth.json")).toBeNull()
    expect(toDataDirectorySegments("exams/../../temp/x.png")).toBeNull()
    expect(toDataDirectorySegments("exams%2F..%2F..%2Ftemp%2Fx.png")).toBeNull()
    expect(toDataDirectorySegments("exams\\..\\..\\x.png")).toBeNull()
  })

  it("空・壊れたエンコードは断る", () => {
    expect(toDataDirectorySegments("")).toBeNull()
    expect(toDataDirectorySegments("./")).toBeNull()
    expect(toDataDirectorySegments("%E0%A4%A")).toBeNull()
  })
})

describe("返す形式", () => {
  it("ラスター画像はどの読み方でも返す", () => {
    expect(appImageContentTypeOf("page.png", "image")).toBe("image/png")
    expect(appImageContentTypeOf("page.PNG", "")).toBe("image/png")
    expect(appImageContentTypeOf("photo.jpg", "")).toBe("image/jpeg")
    expect(appImageContentTypeOf("photo.jpeg", "image")).toBe("image/jpeg")
    expect(appImageContentTypeOf("anim.gif", "image")).toBe("image/gif")
    expect(appImageContentTypeOf("pic.webp", "image")).toBe("image/webp")
  })

  it("SVG は画像として描くときだけ返し、fetch() では返さない", () => {
    expect(appImageContentTypeOf("logo.svg", "image")).toBe("image/svg+xml")
    expect(appImageContentTypeOf("logo.SVG", "")).toBeNull()
  })

  it("画像でない形式は返さない", () => {
    expect(appImageContentTypeOf("page.html", "image")).toBeNull()
    expect(appImageContentTypeOf("doc.pdf", "")).toBeNull()
    expect(appImageContentTypeOf("auth.json", "")).toBeNull()
    expect(appImageContentTypeOf("noextension", "image")).toBeNull()
  })
})

describe("応答の頭", () => {
  const expectProtectiveHeaders = (headers: Headers) => {
    expect(headers.get("X-Content-Type-Options")).toBe("nosniff")
    const contentSecurityPolicy = headers.get("Content-Security-Policy") ?? ""
    expect(contentSecurityPolicy).toContain("default-src 'none'")
    expect(contentSecurityPolicy).toContain("sandbox")
    expect(contentSecurityPolicy).not.toContain("script-src")
    expect(headers.get("Cross-Origin-Resource-Policy")).toBe("same-origin")
    expect(headers.get("Access-Control-Allow-Origin")).toBeNull()
  }

  it("画像の応答に、文書として解釈させない頭が付く", () => {
    const headers = new Headers(appImageHeaders("image/png", 1234))
    expectProtectiveHeaders(headers)
    expect(headers.get("Content-Type")).toBe("image/png")
    expect(headers.get("Content-Length")).toBe("1234")
    expect(headers.get("Cache-Control")).toBe("no-store")
  })

  it("断る応答にも同じ頭が付く", () => {
    const response = appImageNotFound()
    expect(response.status).toBe(404)
    expectProtectiveHeaders(response.headers)
  })
})
