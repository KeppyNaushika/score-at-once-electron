/**
 * grade-archive バージョン変換チェーン（transformGradeToLatest）の検証。
 *
 * 守りたい不変条件は「旧 .grade を読み込んだとき、現行形式へ正規化され、
 * 失われるデータは warning として必ず利用者に伝わること」。
 *
 * 検出は manifest.version ではなくデータ形状で行う設計なので、テストも
 * 「旧バージョンが実際に書き出していた形」をフィクスチャにする。version 文字列を
 * 現行値に偽装したフィクスチャは検出経路を素通りしてしまい検証にならない。
 */

import { describe, expect, it } from "vitest"

import { transformGradeToLatest } from "../../../electron-src/lib/import/grade-transformers"
import type {
  GradeArchiveData,
  GradeArchiveManifest,
} from "../../../src/types/gradeArchive.types"

const manifest: GradeArchiveManifest = {
  version: "1.9.0",
  appVersion: "0.15.0",
  exportedAt: "2026-07-01T00:00:00.000Z",
  gradeId: "g1",
  gradeName: "1学期成績",
  counts: {
    gradeItems: 1,
    dataSources: 0,
    manualScores: 0,
    boundarySets: 2,
    boundaries: 0,
    classrooms: 0,
    students: 0,
  },
}

/**
 * v1.9.0 が実際に書き出していた形。境界セット・手動上書きが targetType を持ち、
 * 総合は gradeItemName が null。courseworkArchive は 1.5.0 以降の現行形式。
 */
function buildV1_9_0Archive(): GradeArchiveData {
  return {
    manifest,
    gradeData: {
      grade: { name: "1学期成績", description: null, referenceDate: null },
      gradeItems: [{ name: "知識・技能", order: 0, dataSources: [] }],
      classroomRefs: [],
      examRefs: [],
      studentRefs: [],
      gradeOverrides: [
        {
          studentNumber: "S001",
          targetType: "grade_item",
          gradeItemName: "知識・技能",
          overrideLabel: "A",
        },
        {
          studentNumber: "S001",
          targetType: "overall",
          gradeItemName: null,
          overrideLabel: "5",
        },
      ],
    },
    courseworkArchive: {
      courseworks: [],
      studentsData: [],
      classesData: [],
      membershipsData: [],
      tagsData: [],
      counts: {
        courseworks: 0,
        items: 0,
        scores: 0,
        students: 0,
        classrooms: 0,
      },
    },
    boundariesData: {
      boundarySets: [
        {
          targetType: "grade_item",
          gradeItemName: "知識・技能",
          boundaries: [{ label: "A", minPercentage: 80, order: 0 }],
        },
        {
          targetType: "overall",
          gradeItemName: null,
          boundaries: [{ label: "5", minPercentage: 84, order: 0 }],
        },
      ],
    },
  }
}

describe("transformGradeToLatest: 1.9.0 → 1.10.0（総合の撤去）", () => {
  it("総合の境界セット・手動上書きが破棄され、評価項目のものは残る", () => {
    const { data } = transformGradeToLatest(buildV1_9_0Archive())

    expect(data.boundariesData.boundarySets).toHaveLength(1)
    expect(data.boundariesData.boundarySets[0].gradeItemName).toBe("知識・技能")
    expect(data.gradeData.gradeOverrides).toHaveLength(1)
    expect(data.gradeData.gradeOverrides![0].gradeItemName).toBe("知識・技能")
    expect(data.gradeData.gradeOverrides![0].overrideLabel).toBe("A")
  })

  it("破棄した件数が warning として利用者に伝わる（黙って消さない）", () => {
    const { warnings } = transformGradeToLatest(buildV1_9_0Archive())

    expect(warnings.some((warning) => warning.includes("成績境界セット"))).toBe(
      true
    )
    expect(warnings.some((warning) => warning.includes("手動上書き"))).toBe(
      true
    )
    // 件数が本文に出ていること（0件でも warning が出る誤りの検出）
    expect(warnings.join("\n")).toContain("1 件")
  })

  it("targetType は新形式へ持ち越さない", () => {
    const { data } = transformGradeToLatest(buildV1_9_0Archive())

    expect(data.boundariesData.boundarySets[0].targetType).toBeUndefined()
    expect(data.gradeData.gradeOverrides![0].targetType).toBeUndefined()
  })

  it("元バージョンを 1.9.0 と報告し、適用した変換と矛盾しない", () => {
    const { originalVersion, finalVersion, appliedTransformations } =
      transformGradeToLatest(buildV1_9_0Archive())

    expect(originalVersion).toBe("1.9.0")
    expect(finalVersion).toBe("1.10.0")
    expect(appliedTransformations).toContainEqual({
      from: "1.9.0",
      to: "1.10.0",
    })
  })

  it("manifest.version が現行へ更新される", () => {
    const { data } = transformGradeToLatest(buildV1_9_0Archive())

    expect(data.manifest.version).toBe("1.10.0")
  })

  it("総合の名残が無い現行アーカイブは変換されず warning も出ない", () => {
    const archive = buildV1_9_0Archive()
    // 現行形式＝targetType 無し・gradeItemName は必ず非null
    archive.boundariesData.boundarySets = [
      {
        gradeItemName: "知識・技能",
        boundaries: [{ label: "A", minPercentage: 80, order: 0 }],
      },
    ]
    archive.gradeData.gradeOverrides = [
      {
        studentNumber: "S001",
        gradeItemName: "知識・技能",
        overrideLabel: "A",
      },
    ]

    const { warnings, appliedTransformations, originalVersion } =
      transformGradeToLatest(archive)

    expect(warnings).toEqual([])
    expect(appliedTransformations).toEqual([])
    expect(originalVersion).toBe("1.10.0")
  })

  it("gradeOverrides を持たない旧アーカイブでも境界セットだけ正規化できる", () => {
    const archive = buildV1_9_0Archive()
    delete archive.gradeData.gradeOverrides

    const { data, warnings } = transformGradeToLatest(archive)

    expect(data.boundariesData.boundarySets).toHaveLength(1)
    expect(data.gradeData.gradeOverrides).toBeUndefined()
    // 上書きは元々0件なので上書き側の warning は出ない
    expect(warnings.some((warning) => warning.includes("手動上書き"))).toBe(
      false
    )
  })
})
