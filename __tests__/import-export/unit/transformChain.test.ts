/**
 * アーカイブ共通の変換チェーン基盤（shared/transformChain）のユニットテスト
 *
 * exam/coursework/asb/student の4ランナーが共有するため、
 * バージョン範囲判定の丸め・非semver拒否・チェーン実行をここで固定する。
 */

import { describe, expect, test } from "vitest"

import type { ChainTransformer } from "../../../electron-src/lib/import/shared/transformChain"
import {
  detectVersionInRange,
  runTransformChain,
} from "../../../electron-src/lib/import/shared/transformChain"

const SUPPORTED = ["1.0.0", "1.1.0", "1.4.0"] as const
type TestVersion = (typeof SUPPORTED)[number]

interface TestData {
  value: string
}

function createTransformer(
  fromVersion: TestVersion,
  toVersion: TestVersion
): ChainTransformer<TestVersion, TestData> {
  return {
    fromVersion,
    toVersion,
    transform: (data) => ({
      data: { value: `${data.value}→${toVersion}` },
      warnings: [`${fromVersion}→${toVersion}`],
    }),
  }
}

describe("detectVersionInRange", () => {
  test("範囲内のバージョンは下端へ丸められる", () => {
    expect(detectVersionInRange("1.1.5", SUPPORTED)).toBe("1.1.0")
    expect(detectVersionInRange("1.0.0", SUPPORTED)).toBe("1.0.0")
  })

  test("最新版以上は最新版、最古版未満は最古版へ丸められる", () => {
    expect(detectVersionInRange("9.0.0", SUPPORTED)).toBe("1.4.0")
    expect(detectVersionInRange("0.9.0", SUPPORTED)).toBe("1.0.0")
  })

  test("非semver文字列は unknown（最古版への誤クランプ禁止）", () => {
    // compareVersions は数値化できない部分を 0 扱いするため、
    // ガードが無いと "invalid" が 0.0.0 とみなされ最古版へ丸められてしまう
    expect(detectVersionInRange("invalid", SUPPORTED)).toBe("unknown")
    expect(detectVersionInRange("1.0", SUPPORTED)).toBe("unknown")
    expect(detectVersionInRange("", SUPPORTED)).toBe("unknown")
  })
})

describe("runTransformChain", () => {
  const transformers = [
    createTransformer("1.0.0", "1.1.0"),
    createTransformer("1.1.0", "1.4.0"),
  ]

  test("変換器を版数順に連鎖適用し、警告と適用履歴を集約する", () => {
    const outcome = runTransformChain({
      data: { value: "start" },
      originalVersion: "1.0.0" as TestVersion,
      targetVersion: "1.4.0" as TestVersion,
      transformers,
      archiveLabel: "test",
      initialWarnings: ["検出補正"],
    })
    expect(outcome.data.value).toBe("start→1.1.0→1.4.0")
    expect(outcome.appliedTransformations).toEqual([
      { from: "1.0.0", to: "1.1.0" },
      { from: "1.1.0", to: "1.4.0" },
    ])
    expect(outcome.warnings).toEqual(["検出補正", "1.0.0→1.1.0", "1.1.0→1.4.0"])
  })

  test("既に最新の場合は無変換で素通しされる", () => {
    const data = { value: "current" }
    const outcome = runTransformChain({
      data,
      originalVersion: "1.4.0" as TestVersion,
      targetVersion: "1.4.0" as TestVersion,
      transformers,
      archiveLabel: "test",
    })
    expect(outcome.data).toBe(data)
    expect(outcome.appliedTransformations).toEqual([])
  })

  test("チェーンが途切れている場合は例外を投げる", () => {
    expect(() =>
      runTransformChain({
        data: { value: "start" },
        originalVersion: "1.0.0" as TestVersion,
        targetVersion: "1.4.0" as TestVersion,
        transformers: [createTransformer("1.0.0", "1.1.0")], // 1.1.0→1.4.0 が欠落
        archiveLabel: "test",
      })
    ).toThrow(/No test transformer found for version 1\.1\.0/)
  })
})
