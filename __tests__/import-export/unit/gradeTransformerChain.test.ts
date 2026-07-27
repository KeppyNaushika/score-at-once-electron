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
import { GRADE_CURRENT_VERSION } from "../../../src/types/gradeArchive.types"

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
    expect(finalVersion).toBe(GRADE_CURRENT_VERSION)
    expect(appliedTransformations).toContainEqual({
      from: "1.9.0",
      to: "1.10.0",
    })
  })

  it("manifest.version が現行へ更新される", () => {
    const { data } = transformGradeToLatest(buildV1_9_0Archive())

    expect(data.manifest.version).toBe(GRADE_CURRENT_VERSION)
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
    expect(originalVersion).toBe(GRADE_CURRENT_VERSION)
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

/**
 * v1.10.0 が実際に書き出していた形。制約ルールの設定は kind 別の JSON 文字列
 * （config）で、評価項目を「名前」で参照していた（issue #1063 以前）。
 */
function buildV1_10_0Archive(): GradeArchiveData {
  const archive = buildV1_9_0Archive()
  // 総合の名残を取り除いて 1.10.0 相当の形にする
  archive.boundariesData.boundarySets = [
    {
      gradeItemName: "知識・技能",
      boundaries: [{ label: "A", minPercentage: 80, order: 0 }],
    },
  ]
  archive.gradeData.gradeOverrides = []
  archive.gradeData.gradeItems = [
    { name: "知識・技能", order: 0, dataSources: [] },
    { name: "評定", order: 1, dataSources: [] },
  ]
  archive.gradeData.gradeConstraints = [
    {
      name: "評定と観点の整合",
      kind: "consistency",
      config: JSON.stringify({
        labelValues: { A: 5, B: 3, C: 1 },
        aggregate: "sum",
        tolerance: 2,
        target: "評定",
        viewpointItems: ["知識・技能"],
      }),
      expression: "",
      color: "#fecaca",
      message: "観点と評定が合いません",
      enabled: true,
      order: 0,
    },
    {
      name: "A・C混在禁止",
      kind: "mutual_exclusion",
      config: JSON.stringify({ labels: ["A", "C"] }),
      expression: "",
      color: "#fde68a",
      message: null,
      enabled: true,
      order: 1,
    },
    {
      name: "壊れたconfig",
      kind: "consistency",
      config: "これはJSONではない",
      expression: "",
      color: "#fecaca",
      message: null,
      enabled: true,
      order: 2,
    },
  ]
  return archive
}

describe("transformGradeToLatest: 1.10.0 → 1.11.0（制約ルールの設定JSON展開）", () => {
  it("config を構造化フィールドへ展開し、評価項目は名前で残す", () => {
    const { data, appliedTransformations, originalVersion } =
      transformGradeToLatest(buildV1_10_0Archive())

    expect(originalVersion).toBe("1.10.0")
    expect(appliedTransformations).toContainEqual({
      from: "1.10.0",
      to: "1.11.0",
    })

    const constraints = data.gradeData.gradeConstraints!
    const consistency = constraints.find(
      (constraint) => constraint.kind === "consistency"
    )!
    // uuid は旧アーカイブに無いので名前だけ（importer が名前フォールバックで解決する）
    expect(consistency.targetGradeItemName).toBe("評定")
    expect(consistency.targetGradeItemId).toBeUndefined()
    expect(consistency.viewpointGradeItemNames).toEqual(["知識・技能"])
    expect(consistency.labelValues).toEqual({ A: 5, B: 3, C: 1 })
    expect(consistency.aggregate).toBe("sum")
    expect(consistency.tolerance).toBe(2)
    // 教員が書いた違反メッセージは触らない
    expect(consistency.message).toBe("観点と評定が合いません")
    // 展開後は config を残さない
    expect(consistency.config).toBeUndefined()

    const exclusion = constraints.find(
      (constraint) => constraint.kind === "mutual_exclusion"
    )!
    expect(exclusion.exclusionLabels).toEqual(["A", "C"])
    expect(exclusion.config).toBeUndefined()
  })

  it("壊れた config は既定値へ倒して取り込める形にする", () => {
    const { data } = transformGradeToLatest(buildV1_10_0Archive())

    const broken = data.gradeData.gradeConstraints!.find(
      (constraint) => constraint.name === "壊れたconfig"
    )!
    // 旧 parseConfig の既定値フォールバックと同じ挙動（JSON.parse 失敗で既定値）
    expect(broken.targetGradeItemName).toBeNull()
    expect(broken.aggregate).toBe("average")
    expect(broken.tolerance).toBe(1)
    expect(broken.viewpointGradeItemNames).toEqual([])
    expect(broken.config).toBeUndefined()
  })

  it("マニフェストを現行へ上げ、変換した件数を warning で知らせる", () => {
    const { data, warnings } = transformGradeToLatest(buildV1_10_0Archive())

    expect(data.manifest.version).toBe(GRADE_CURRENT_VERSION)
    expect(warnings.some((warning) => warning.includes("1.10.0→1.11.0"))).toBe(
      true
    )
  })

  it("既に 1.11.0 の形なら変換しない", () => {
    const archive = buildV1_10_0Archive()
    archive.gradeData.gradeConstraints = [
      {
        name: "整合",
        kind: "consistency",
        targetGradeItemId: "gi-h",
        targetGradeItemName: "評定",
        aggregate: "average",
        tolerance: 1,
        viewpointGradeItemIds: ["gi-k"],
        viewpointGradeItemNames: ["知識・技能"],
        labelValues: { A: 5 },
        exclusionLabels: [],
        expression: "",
        color: "#fecaca",
        message: null,
        enabled: true,
        order: 0,
      },
    ]

    const { appliedTransformations, originalVersion } =
      transformGradeToLatest(archive)

    expect(
      appliedTransformations.some(
        (transformation) => transformation.to === "1.11.0"
      )
    ).toBe(false)
    expect(originalVersion).toBe(GRADE_CURRENT_VERSION)
  })
})
