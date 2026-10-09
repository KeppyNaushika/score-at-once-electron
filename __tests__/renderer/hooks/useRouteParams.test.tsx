// @vitest-environment jsdom
/**
 * `useRouteParams` が、どの動的ルートでも `useParams` と同じ値を返すことの検査。
 *
 * 期待値は `src/app` のフォルダ構成から作る（`<section>/[param]/<段>/page.tsx` なら
 * `/<section>/<id>/<段>` で `{ param: id }`）。動的ルートを足して表へ足し忘れると、
 * ここで落ちる。
 */
import { renderHook } from "@testing-library/react"
import * as fs from "fs"
import * as path from "path"
import { afterEach, describe, expect, it, vi } from "vitest"

import { useRouteParams } from "@/hooks/useRouteParams"

const navigationMock = vi.hoisted(() => ({ pathname: "/" }))

vi.mock("next/navigation", () => ({
  usePathname: () => navigationMock.pathname,
}))

afterEach(() => {
  navigationMock.pathname = "/"
})

function routeParamsAt(pathname: string) {
  navigationMock.pathname = pathname
  return renderHook(() => useRouteParams()).result.current
}

const APP_ROUTE_ROOT = path.resolve(__dirname, "../../../src/app/(app)")
const DYNAMIC_SEGMENT_PATTERN = /^\[(\w+)\]$/

/** フォルダ名が動的セグメント（`[examId]` 等。catch-all `[...x]` も含めて）か */
function isDynamicSegmentName(folderName: string): boolean {
  return folderName.startsWith("[")
}

function subfolderNames(folderPath: string): string[] {
  return fs
    .readdirSync(folderPath, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
}

/** 動的ルート1つ（`/exams/[examId]`）と、その下で page.tsx を持つ段 */
interface DynamicRoute {
  section: string
  paramName: string
  stepFolderNames: string[]
}

function collectDynamicRoutes(): DynamicRoute[] {
  return subfolderNames(APP_ROUTE_ROOT).flatMap((section) =>
    subfolderNames(path.join(APP_ROUTE_ROOT, section))
      .filter(isDynamicSegmentName)
      .map((dynamicFolderName) => {
        const paramMatch = DYNAMIC_SEGMENT_PATTERN.exec(dynamicFolderName)
        if (!paramMatch) {
          throw new Error(
            `useRouteParams は catch-all を扱わない: ${section}/${dynamicFolderName}`
          )
        }
        const dynamicFolderPath = path.join(
          APP_ROUTE_ROOT,
          section,
          dynamicFolderName
        )
        return {
          section,
          paramName: paramMatch[1],
          stepFolderNames: subfolderNames(dynamicFolderPath).filter(
            (stepFolderName) =>
              fs.existsSync(
                path.join(dynamicFolderPath, stepFolderName, "page.tsx")
              )
          ),
        }
      })
  )
}

const dynamicRoutes = collectDynamicRoutes()

describe("useRouteParams", () => {
  it("src/app の動的ルートを見つけている（走査の空振りを止める）", () => {
    expect(
      dynamicRoutes.map((dynamicRoute) => dynamicRoute.section).sort()
    ).toEqual([
      "answer-sheet-builder",
      "classrooms",
      "coursework",
      "exams",
      "grades",
      "students",
    ])
  })

  it("動的セグメントの入れ子は無い（あれば表の作りを見直す）", () => {
    const nestedDynamicFolders = dynamicRoutes.flatMap((dynamicRoute) =>
      dynamicRoute.stepFolderNames.filter(isDynamicSegmentName)
    )
    expect(nestedDynamicFolders).toEqual([])
  })

  describe.each(dynamicRoutes)(
    "/$section/[$paramName]",
    ({ section, paramName, stepFolderNames }) => {
      const entityId = "0b6f3c1e-8a2d-4f5b-9c7e-1d2a3b4c5d6e"

      it("概要で param を返す", () => {
        expect(routeParamsAt(`/${section}/${entityId}`)).toEqual({
          [paramName]: entityId,
        })
      })

      it("末尾のスラッシュがあっても同じ", () => {
        expect(routeParamsAt(`/${section}/${entityId}/`)).toEqual({
          [paramName]: entityId,
        })
      })

      it.each(stepFolderNames)("段 %s でも同じ param を返す", (stepName) => {
        expect(routeParamsAt(`/${section}/${entityId}/${stepName}`)).toEqual({
          [paramName]: entityId,
        })
      })

      it("一覧（動的セグメントの外）では空", () => {
        expect(routeParamsAt(`/${section}`)).toEqual({})
      })
    }
  )

  it("useParams と同じくデコード済みの値を返す", () => {
    expect(routeParamsAt("/exams/%E8%A9%A6%E9%A8%93%201/01-upload")).toEqual({
      examId: "試験 1",
    })
  })

  it("動的ルートの無い画面では空", () => {
    expect(routeParamsAt("/")).toEqual({})
    expect(routeParamsAt("/dashboard")).toEqual({})
    expect(routeParamsAt("/settings/anything")).toEqual({})
  })

  it("Object の既定のプロパティ名を section と取り違えない", () => {
    expect(routeParamsAt("/constructor/x")).toEqual({})
    expect(routeParamsAt("/toString/x")).toEqual({})
  })
})
