/**
 * データフォルダの中にパスを閉じ込める規則（`electron-src/lib/pathContainment.ts`）と、
 * デスクトップ版の `appimg://` の要求 URL の解決（`electron-src/lib/appImageProtocol.ts`）を縛る。
 *
 * - 根からの相対パスは、根の下に解決できるものだけを今までどおり解決する
 * - 根の外・根そのものを指すもの（`..`・絶対パス・NUL・空）は断る
 * - `appimg://` は、URL のエンコードを戻したあとで同じ規則を通す
 *
 * web 版では Worker の `path` が path-browserify になる。中身は Node の posix の path と
 * 同じ実装なので、仮想の根（`/opfs/data`）の場合もここで posix の path で確かめる。
 */
import * as path from "path"
import { describe, expect, it } from "vitest"

import { resolveAppImageRequestPath } from "../../electron-src/lib/appImageProtocol"
import {
  isRelativePathInside,
  isSafePathSegment,
  isStrictlyUnderRoot,
  PathOutsideRootError,
  requireRemovableUnderRoot,
  requireSafePathSegment,
  requireUnderRoot,
  resolveUnderRoot,
} from "../../electron-src/lib/pathContainment"

const ROOT_DIRECTORY = path.join(path.sep, "tmp", "score-at-once-root")
const WEB_ROOT_DIRECTORY = "/opfs/data"

describe("resolveUnderRoot: 根の下に解決できるもの", () => {
  it("試験の画像の相対パスを今までどおり根の下の絶対パスにする", () => {
    const resolved = resolveUnderRoot(
      ROOT_DIRECTORY,
      "exams/exam-1/master-answers/page.png"
    )
    expect(resolved).toEqual({
      kind: "ok",
      absolutePath: path.join(
        ROOT_DIRECTORY,
        "exams",
        "exam-1",
        "master-answers",
        "page.png"
      ),
      normalizedRelativePath: "exams/exam-1/master-answers/page.png",
    })
  })

  it("中で折り返して根の下に留まる相対パスは正規化して解決する", () => {
    const resolved = resolveUnderRoot(ROOT_DIRECTORY, "exams/a/../b/page.png")
    expect(resolved.kind).toBe("ok")
    if (resolved.kind !== "ok") return
    expect(resolved.normalizedRelativePath).toBe("exams/b/page.png")
    expect(resolved.absolutePath).toBe(
      path.join(ROOT_DIRECTORY, "exams", "b", "page.png")
    )
  })

  it("\\ 区切りの相対パスも / 区切りと同じに読む", () => {
    const resolved = resolveUnderRoot(ROOT_DIRECTORY, "exams\\exam-1\\page.png")
    expect(resolved.kind).toBe("ok")
    if (resolved.kind !== "ok") return
    expect(resolved.normalizedRelativePath).toBe("exams/exam-1/page.png")
  })

  it("web 版の仮想の根（/opfs/data）の下にも解決する", () => {
    expect(
      resolveUnderRoot(WEB_ROOT_DIRECTORY, "exams/exam-1/page.png")
    ).toEqual({
      kind: "ok",
      absolutePath: "/opfs/data/exams/exam-1/page.png",
      normalizedRelativePath: "exams/exam-1/page.png",
    })
  })
})

describe("resolveUnderRoot: 断るもの", () => {
  const refusedPaths = [
    { label: "空", relativePath: "" },
    { label: "根そのもの", relativePath: "." },
    { label: "折り返して根そのものになる", relativePath: "exams/.." },
    { label: "親", relativePath: ".." },
    { label: "親の下", relativePath: "../outside.png" },
    { label: "途中から親へ出る", relativePath: "exams/../../outside.png" },
    {
      label: "\\ 区切りで親へ出る",
      relativePath: "exams\\..\\..\\outside.png",
    },
    { label: "/ で始まる絶対パス", relativePath: "/outside/file.png" },
    { label: "\\ で始まる絶対パス", relativePath: "\\outside\\file.png" },
    { label: "ドライブ名で始まる", relativePath: "C:/outside/file.png" },
    { label: "ドライブ名だけ", relativePath: "C:outside.png" },
    { label: "NUL を含む", relativePath: "exams/page.png\0.txt" },
  ]

  for (const refusedPath of refusedPaths) {
    it(`${refusedPath.label}は断る`, () => {
      expect(
        resolveUnderRoot(ROOT_DIRECTORY, refusedPath.relativePath)
      ).toEqual({ kind: "outsideRoot" })
      expect(
        resolveUnderRoot(WEB_ROOT_DIRECTORY, refusedPath.relativePath)
      ).toEqual({ kind: "outsideRoot" })
    })
  }

  it("例外版は PathOutsideRootError を投げる", () => {
    expect(() => requireUnderRoot(ROOT_DIRECTORY, "../outside.png")).toThrow(
      PathOutsideRootError
    )
    expect(requireUnderRoot(ROOT_DIRECTORY, "exams/page.png")).toBe(
      path.join(ROOT_DIRECTORY, "exams", "page.png")
    )
  })
})

describe("isStrictlyUnderRoot / requireRemovableUnderRoot", () => {
  it("根の下は通し、根そのもの・親・名前の前方だけが同じ隣は通さない", () => {
    expect(
      isStrictlyUnderRoot(ROOT_DIRECTORY, path.join(ROOT_DIRECTORY, "exams"))
    ).toBe(true)
    expect(isStrictlyUnderRoot(ROOT_DIRECTORY, ROOT_DIRECTORY)).toBe(false)
    expect(
      isStrictlyUnderRoot(ROOT_DIRECTORY, `${ROOT_DIRECTORY}${path.sep}`)
    ).toBe(false)
    expect(
      isStrictlyUnderRoot(ROOT_DIRECTORY, path.dirname(ROOT_DIRECTORY))
    ).toBe(false)
    expect(isStrictlyUnderRoot(ROOT_DIRECTORY, `${ROOT_DIRECTORY}-other`)).toBe(
      false
    )
    expect(isStrictlyUnderRoot(ROOT_DIRECTORY, "exams")).toBe(false)
  })

  it("再帰削除の前の確認は、根そのものと根の外で例外を投げる", () => {
    expect(() =>
      requireRemovableUnderRoot(ROOT_DIRECTORY, ROOT_DIRECTORY)
    ).toThrow(PathOutsideRootError)
    expect(() =>
      requireRemovableUnderRoot(ROOT_DIRECTORY, path.dirname(ROOT_DIRECTORY))
    ).toThrow(PathOutsideRootError)
    const examDirectory = path.join(ROOT_DIRECTORY, "exams", "exam-1")
    expect(requireRemovableUnderRoot(ROOT_DIRECTORY, examDirectory)).toBe(
      examDirectory
    )
  })

  it("web 版の仮想の根でも同じに判断する", () => {
    expect(
      isStrictlyUnderRoot(WEB_ROOT_DIRECTORY, "/opfs/data/exams/exam-1")
    ).toBe(true)
    expect(isStrictlyUnderRoot(WEB_ROOT_DIRECTORY, "/opfs/data")).toBe(false)
    expect(isStrictlyUnderRoot(WEB_ROOT_DIRECTORY, "/opfs/userData")).toBe(
      false
    )
  })
})

describe("isRelativePathInside", () => {
  it("決まったディレクトリのさらに下だけを通す", () => {
    expect(isRelativePathInside("exams/exam-1/page.png", ["exams"])).toBe(true)
    expect(isRelativePathInside("exams", ["exams"])).toBe(false)
    expect(isRelativePathInside("database.db", ["exams"])).toBe(false)
    expect(isRelativePathInside("exams/../database.db", ["exams"])).toBe(false)
    expect(isRelativePathInside("../exams/page.png", ["exams"])).toBe(false)
    expect(isRelativePathInside("/exams/page.png", ["exams"])).toBe(false)
  })
})

describe("isSafePathSegment / requireSafePathSegment", () => {
  it("uuid と cuid（初期の版の id）は通す", () => {
    expect(isSafePathSegment("3f2b8c1e-4d5a-4b6c-8d7e-9f0a1b2c3d4e")).toBe(true)
    expect(isSafePathSegment("clx1a2b3c0000abcd1234efgh")).toBe(true)
  })

  const refusedSegments = [
    { label: "空", segment: "" },
    { label: ".", segment: "." },
    { label: "..", segment: ".." },
    { label: "/ を含む", segment: "exam/1" },
    { label: "\\ を含む", segment: "exam\\1" },
    { label: ": を含む", segment: "C:" },
    { label: ". を含む", segment: "exam.1" },
    { label: "NUL を含む", segment: "exam\0" },
    { label: "長すぎる", segment: "a".repeat(129) },
  ]
  for (const refusedSegment of refusedSegments) {
    it(`${refusedSegment.label}は断る`, () => {
      expect(isSafePathSegment(refusedSegment.segment)).toBe(false)
      expect(() => requireSafePathSegment(refusedSegment.segment)).toThrow(
        PathOutsideRootError
      )
    })
  }
})

describe("resolveAppImageRequestPath（appimg://）", () => {
  it("相対パスの URL を根の下の絶対パスにする（/// と // の両方）", () => {
    const expected = path.join(ROOT_DIRECTORY, "exams", "exam-1", "page.png")
    expect(
      resolveAppImageRequestPath(
        "appimg:///exams/exam-1/page.png",
        ROOT_DIRECTORY
      )
    ).toBe(expected)
    expect(
      resolveAppImageRequestPath(
        "appimg://exams/exam-1/page.png",
        ROOT_DIRECTORY
      )
    ).toBe(expected)
  })

  it("エンコードした文字は戻してから解決する", () => {
    expect(
      resolveAppImageRequestPath(
        "appimg:///exams/exam-1/%E6%A8%A1%E7%AF%84.png",
        ROOT_DIRECTORY
      )
    ).toBe(path.join(ROOT_DIRECTORY, "exams", "exam-1", "模範.png"))
  })

  it("旧名 projects/ は exams/ として読む", () => {
    expect(
      resolveAppImageRequestPath(
        "appimg:///projects/exam-1/page.png",
        ROOT_DIRECTORY
      )
    ).toBe(path.join(ROOT_DIRECTORY, "exams", "exam-1", "page.png"))
  })

  const refusedUrls = [
    { label: "親へ出る", url: "appimg:///../outside.png" },
    {
      label: "エンコードした区切りで親へ出る",
      url: "appimg:///..%2Foutside.png",
    },
    {
      label: "エンコードした . と区切りで親へ出る",
      url: "appimg:///exams%2F%2E%2E%2F%2E%2E%2Foutside.png",
    },
    {
      label: "エンコードした \\ で親へ出る",
      url: "appimg:///..%5Coutside.png",
    },
    { label: "絶対パス", url: "appimg:////outside/file.png" },
    { label: "エンコードした絶対パス", url: "appimg:///%2Foutside%2Ffile.png" },
    { label: "根そのもの", url: "appimg:///" },
    { label: "NUL を含む", url: "appimg:///exams/page.png%00.txt" },
    { label: "エンコードが壊れている", url: "appimg:///exams/%E0%A4%A.png" },
  ]
  for (const refusedUrl of refusedUrls) {
    it(`${refusedUrl.label}は断る`, () => {
      expect(resolveAppImageRequestPath(refusedUrl.url, ROOT_DIRECTORY)).toBe(
        null
      )
    })
  }
})
