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

import {
  isCurrentCollectedCourseworkData,
  isLegacyCollectedCourseworkData,
} from "../../../electron-src/lib/import/coursework-transformers/legacyShape"
import { transformGradeToLatest } from "../../../electron-src/lib/import/grade-transformers"
import type { LegacyGradeArchiveData } from "../../../electron-src/lib/import/grade-transformers/legacyShape"
import type { GradeArchiveManifest } from "../../../src/types/gradeArchive.types"
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
function buildV1_9_0Archive(): LegacyGradeArchiveData {
  return {
    manifest,
    gradeData: {
      grade: { name: "1学期成績", description: null, referenceDate: null },
      gradeItems: [{ name: "知識・技能", order: 0, dataSources: [] }],
      classroomRefs: [],
      examRefs: [],
      studentRefs: [
        {
          studentNumber: "S001",
          classroomName: null,
          customOrder: 0,
        },
      ],
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
      courseworkClassrooms: [],
      courseworkTags: [],
      courseworkStudents: [],
      courseworkItems: [],
      courseworkLetterScales: [],
      courseworkScores: [],
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

    const gradeItemNameById = new Map(
      data.gradeItems.map((gradeItem) => [gradeItem.id, gradeItem.name])
    )
    expect(data.gradeBoundarySets).toHaveLength(1)
    expect(gradeItemNameById.get(data.gradeBoundarySets[0].gradeItemId)).toBe(
      "知識・技能"
    )
    expect(data.gradeOverrides).toHaveLength(1)
    expect(gradeItemNameById.get(data.gradeOverrides[0].gradeItemId)).toBe(
      "知識・技能"
    )
    expect(data.gradeOverrides[0].overrideLabel).toBe("A")
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

  it("targetType は新形式へ持ち越さない（行に列そのものが無い）", () => {
    const { data } = transformGradeToLatest(buildV1_9_0Archive())

    expect(data.gradeBoundarySets[0]).not.toHaveProperty("targetType")
    expect(data.gradeOverrides[0]).not.toHaveProperty("targetType")
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

    // 総合の名残が無いので 1.9.0→1.10.0 は当たらない。射影形式である以上
    // 1.12.0→1.13.0 の平坦化だけは必ず通る
    expect(warnings.some((warning) => warning.includes("1.9.0"))).toBe(false)
    expect(appliedTransformations).toEqual([{ from: "1.12.0", to: "1.13.0" }])
    expect(originalVersion).toBe("1.12.0")
  })

  it("gradeOverrides を持たない旧アーカイブでも境界セットだけ正規化できる", () => {
    const archive = buildV1_9_0Archive()
    delete archive.gradeData.gradeOverrides

    const { data, warnings } = transformGradeToLatest(archive)

    expect(data.gradeBoundarySets).toHaveLength(1)
    expect(data.gradeOverrides).toHaveLength(0)
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
function buildV1_10_0Archive(): LegacyGradeArchiveData {
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

    const gradeItemIdByName = new Map(
      data.gradeItems.map((gradeItem) => [gradeItem.name, gradeItem.id])
    )
    const consistency = data.gradeConstraints.find(
      (constraint) => constraint.kind === "consistency"
    )!
    // 旧 config の名前参照は、平坦化の過程で評価項目の行 id へ解決される
    expect(consistency.targetGradeItemId).toBe(gradeItemIdByName.get("評定"))
    expect(
      data.gradeConstraintViewpoints
        .filter((viewpoint) => viewpoint.constraintId === consistency.id)
        .map((viewpoint) => viewpoint.gradeItemId)
    ).toEqual([gradeItemIdByName.get("知識・技能")])
    expect(
      data.gradeConstraintLabelValues
        .filter((labelValue) => labelValue.constraintId === consistency.id)
        .map((labelValue) => [labelValue.label, Number(labelValue.value)])
    ).toEqual([
      ["A", 5],
      ["B", 3],
      ["C", 1],
    ])
    expect(consistency.aggregate).toBe("sum")
    expect(Number(consistency.tolerance)).toBe(2)
    // 教員が書いた違反メッセージは触らない
    expect(consistency.message).toBe("観点と評定が合いません")
    // 展開後は config を残さない（行に列そのものが無い）
    expect(consistency).not.toHaveProperty("config")

    const exclusion = data.gradeConstraints.find(
      (constraint) => constraint.kind === "mutual_exclusion"
    )!
    expect(
      data.gradeConstraintExclusionLabels
        .filter(
          (exclusionLabel) => exclusionLabel.constraintId === exclusion.id
        )
        .map((exclusionLabel) => exclusionLabel.label)
    ).toEqual(["A", "C"])
  })

  it("壊れた config は既定値へ倒して取り込める形にする", () => {
    const { data } = transformGradeToLatest(buildV1_10_0Archive())

    const broken = data.gradeConstraints.find(
      (constraint) => constraint.name === "壊れたconfig"
    )!
    // 旧 parseConfig の既定値フォールバックと同じ挙動（JSON.parse 失敗で既定値）
    expect(broken.targetGradeItemId).toBeNull()
    expect(broken.aggregate).toBe("average")
    expect(Number(broken.tolerance)).toBe(1)
    expect(
      data.gradeConstraintViewpoints.filter(
        (viewpoint) => viewpoint.constraintId === broken.id
      )
    ).toEqual([])
    expect(broken).not.toHaveProperty("config")
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
    expect(originalVersion).toBe("1.12.0")
  })
})

/**
 * v1.11.0 までが実際に書き出していた内包資料の形（入れ子・射影ツリー）。
 * 点数は人（Student）の uuid を指していた。
 */
function buildV1_11_0Archive(): LegacyGradeArchiveData {
  const archive = buildV1_9_0Archive()
  archive.manifest = { ...manifest, version: "1.11.0" }
  // 1.9.0 の名残（総合エントリ）を取り除き、内包資料だけが旧形の状態にする
  archive.boundariesData.boundarySets = []
  archive.gradeData.gradeOverrides = []
  archive.courseworkArchive = undefined
  archive.legacyCourseworkArchive = {
    courseworks: [
      {
        id: "cw-1",
        name: "第1回レポート",
        description: null,
        date: null,
        classrooms: [],
        tags: [],
        students: [{ studentId: "student-kept", customOrder: 0 }],
        items: [
          {
            id: "item-1",
            name: "提出物",
            order: 0,
            maxScore: 100,
            inputMode: "numeric",
            letterScales: [],
            scores: [
              {
                studentId: "student-kept",
                score: 85,
                letterValue: null,
                adjustment: null,
                adjustmentReason: null,
                comment: null,
                updatedAt: "2026-06-01T00:00:00.000Z",
              },
              {
                studentId: "student-orphan",
                score: 40,
                letterValue: null,
                adjustment: null,
                adjustmentReason: null,
                comment: null,
                updatedAt: "2026-06-01T00:00:00.000Z",
              },
            ],
          },
        ],
      },
    ],
    studentsData: [],
    classesData: [],
    membershipsData: [],
    tagsData: [],
    counts: {
      courseworks: 1,
      items: 1,
      scores: 2,
      students: 0,
      classrooms: 0,
    },
  }
  return archive
}

describe("transformGradeToLatest: 1.11.0 → 1.12.0（内包資料の平坦化）", () => {
  it("入れ子の内包資料をテーブルごとのセクションへ展開する", () => {
    const { data } = transformGradeToLatest(buildV1_11_0Archive())

    expect(data).not.toHaveProperty("legacyCourseworkArchive")
    expect(data.courseworkArchive.courseworks).toHaveLength(1)
    expect(data.courseworkArchive.courseworkItems).toHaveLength(1)
    expect(data.courseworkArchive.courseworkStudents).toHaveLength(1)
  })

  it("点数が資料の対象者を指し、名簿外の点数は破棄される", () => {
    const { data, warnings } = transformGradeToLatest(buildV1_11_0Archive())

    const scores = data.courseworkArchive.courseworkScores
    expect(scores).toHaveLength(1)
    expect(scores[0].courseworkStudentId).toBe(
      data.courseworkArchive.courseworkStudents[0].id
    )
    expect(scores[0].score).toBe("85")
    expect(warnings.some((warning) => warning.includes("1 件を破棄"))).toBe(
      true
    )
  })

  it("元バージョンを 1.11.0 と報告し、適用した変換と矛盾しない", () => {
    const { originalVersion, appliedTransformations } = transformGradeToLatest(
      buildV1_11_0Archive()
    )

    expect(originalVersion).toBe("1.11.0")
    expect(appliedTransformations).toContainEqual({
      from: "1.11.0",
      to: "1.12.0",
    })
  })
})

/**
 * 資料を1件も参照していない成績。収集器は内包資料を「空だが形はある」オブジェクトとして
 * 必ず書き出すので、旧アーカイブの大多数がこの形になる。
 * 中身（courseworks の要素）で新旧を見分けようとすると空配列で判別できず、
 * 旧アーカイブが現行の形と誤認されて取り込みが落ちていた。
 */
const EMPTY_LEGACY_EMBEDDED = {
  courseworks: [],
  studentsData: [],
  classesData: [],
  membershipsData: [],
  tagsData: [],
  counts: { courseworks: 0, items: 0, scores: 0, students: 0, classrooms: 0 },
}

describe("内包資料が空の旧アーカイブ", () => {
  it("現行の形と誤認せず、旧形式として扱う", () => {
    expect(isLegacyCollectedCourseworkData(EMPTY_LEGACY_EMBEDDED)).toBe(true)
    expect(isCurrentCollectedCourseworkData(EMPTY_LEGACY_EMBEDDED)).toBe(false)
  })

  it("現行の形（全セクションが揃っている）は旧形式と誤認しない", () => {
    const current = {
      ...EMPTY_LEGACY_EMBEDDED,
      courseworkClassrooms: [],
      courseworkTags: [],
      courseworkStudents: [],
      courseworkItems: [],
      courseworkLetterScales: [],
      courseworkScores: [],
    }
    expect(isCurrentCollectedCourseworkData(current)).toBe(true)
    expect(isLegacyCollectedCourseworkData(current)).toBe(false)
  })

  it("変換後は全セクションが揃い、取り込み側が undefined を踏まない", () => {
    const archive = buildV1_11_0Archive()
    archive.legacyCourseworkArchive = EMPTY_LEGACY_EMBEDDED

    const { data } = transformGradeToLatest(archive)

    expect(data.courseworkArchive.courseworks).toEqual([])
    expect(data.courseworkArchive.courseworkClassrooms).toEqual([])
    expect(data.courseworkArchive.courseworkTags).toEqual([])
    expect(data.courseworkArchive.courseworkStudents).toEqual([])
    expect(data.courseworkArchive.courseworkItems).toEqual([])
    expect(data.courseworkArchive.courseworkLetterScales).toEqual([])
    expect(data.courseworkArchive.courseworkScores).toEqual([])
  })
})

describe("transformGradeToLatest: 1.12.0 → 1.13.0（成績本体の平坦化）", () => {
  it("射影された入れ子をテーブルごとのセクションへ展開する", () => {
    const { data, appliedTransformations } = transformGradeToLatest(
      buildV1_11_0Archive()
    )

    expect(appliedTransformations).toContainEqual({
      from: "1.12.0",
      to: "1.13.0",
    })
    // 成績本体が入れ子でなく行の配列になっている
    expect(data).not.toHaveProperty("gradeData")
    expect(data).not.toHaveProperty("boundariesData")
    expect(data.grades).toHaveLength(1)
    expect(data.grades[0].name).toBe("1学期成績")
    expect(data.gradeItems.length).toBeGreaterThan(0)
    // 各行が id を持ち、アーカイブ内で結合できる
    expect(
      data.gradeDataSources.every((dataSource) =>
        data.gradeItems.some(
          (gradeItem) => gradeItem.id === dataSource.gradeItemId
        )
      )
    ).toBe(true)
  })

  it("生徒・学級は full レコードとして外部参照セクションへ出る", () => {
    const { data } = transformGradeToLatest(buildV1_9_0Archive())

    expect(data.studentsData.map((student) => student.studentNumber)).toEqual([
      "S001",
    ])
    // 対象者の行は生徒 uuid を指し、その uuid は studentsData に載っている
    expect(data.gradeStudents[0].studentId).toBe(data.studentsData[0].id)
  })

  it("旧形式が名前でしか持たない参照を id へ解決する（試験・小計・領域）", () => {
    const archive = buildV1_9_0Archive()
    archive.gradeData.gradeItems = [
      {
        name: "知識・技能",
        order: 0,
        dataSources: [
          {
            type: "subtotal",
            name: "小計参照",
            weight: 100,
            order: 0,
            examName: "1学期中間",
            subtotalName: "大問1",
            cropRegionLabel: null,
          },
        ],
      },
    ]

    const { data } = transformGradeToLatest(archive)

    const dataSource = data.gradeDataSources[0]
    // 行は uuid だけを持ち、同定情報は refs 側にある
    expect(dataSource.examId).not.toBeNull()
    expect(dataSource.subtotalId).not.toBeNull()
    expect(dataSource).not.toHaveProperty("examName")
    expect(
      data.examRefs.find((examRef) => examRef.id === dataSource.examId)
        ?.examName
    ).toBe("1学期中間")
    const subtotalRef = data.subtotalRefs.find(
      (candidate) => candidate.id === dataSource.subtotalId
    )!
    expect(subtotalRef.name).toBe("大問1")
    // 小計名で当て直すには試験の絞り込みが要るので、試験も併せて持つ
    expect(subtotalRef.examId).toBe(dataSource.examId)
  })

  it("旧アーカイブは氏名を持たないので、その旨を警告する（生徒は作れない）", () => {
    const { data, warnings } = transformGradeToLatest(buildV1_9_0Archive())

    // 学籍番号での照合には使えるが、氏名が無いので取り込み側は生徒を作らない
    expect(data.studentsData[0].lastName).toBe("")
    expect(
      warnings.some((warning) => warning.includes("氏名・学級所属を持ちません"))
    ).toBe(true)
    // 在籍期間を捏造しないので学級所属は空
    expect(data.membershipsData).toEqual([])
  })

  it("同名の評価項目でもデータソースは片寄せされない（合成idに並び順を混ぜる）", () => {
    const archive = buildV1_9_0Archive()
    archive.gradeData.gradeItems = [
      {
        name: "観点別評価",
        order: 0,
        dataSources: [
          {
            type: "exam_total",
            name: "1つ目",
            weight: 100,
            order: 0,
            examName: null,
            subtotalName: null,
            cropRegionLabel: null,
          },
        ],
      },
      {
        name: "観点別評価",
        order: 1,
        dataSources: [
          {
            type: "exam_total",
            name: "2つ目",
            weight: 100,
            order: 0,
            examName: null,
            subtotalName: null,
            cropRegionLabel: null,
          },
        ],
      },
    ]
    archive.gradeData.gradeOverrides = []
    archive.boundariesData.boundarySets = []

    const { data } = transformGradeToLatest(archive)

    // 2項目が別の id を持ち、データソースが1本ずつ付く
    expect(new Set(data.gradeItems.map((item) => item.id)).size).toBe(2)
    for (const gradeItem of data.gradeItems) {
      expect(
        data.gradeDataSources.filter(
          (dataSource) => dataSource.gradeItemId === gradeItem.id
        )
      ).toHaveLength(1)
    }
  })

  it("別試験の同名小計・同ラベル領域は別の参照として扱う", () => {
    const archive = buildV1_9_0Archive()
    const buildSource = (
      name: string,
      examName: string
    ): (typeof archive.gradeData.gradeItems)[number]["dataSources"][number] => ({
      type: "crop_region",
      name,
      weight: 100,
      order: 0,
      examName,
      subtotalName: "大問1",
      cropRegionLabel: "問3",
    })
    archive.gradeData.gradeItems = [
      {
        name: "知識・技能",
        order: 0,
        dataSources: [
          buildSource("中間の問3", "中間テスト"),
          buildSource("期末の問3", "期末テスト"),
        ],
      },
    ]
    archive.gradeData.gradeOverrides = []
    archive.boundariesData.boundarySets = []

    const { data } = transformGradeToLatest(archive)

    const [midterm, finalExam] = data.gradeDataSources
    expect(midterm.examId).not.toBe(finalExam.examId)
    // ラベル・小計名が同じでも、試験が違えば別の参照になる
    expect(midterm.cropRegionId).not.toBe(finalExam.cropRegionId)
    expect(midterm.subtotalId).not.toBe(finalExam.subtotalId)
    // 同定情報も試験ごとに1件ずつ出る
    expect(data.cropRegionRefs).toHaveLength(2)
    expect(data.subtotalRefs).toHaveLength(2)
  })

  it("Project 時代の project_total を exam_total へ直す", () => {
    const archive = buildV1_9_0Archive()
    archive.gradeData.gradeItems = [
      {
        name: "知識・技能",
        order: 0,
        dataSources: [
          {
            type: "project_total",
            name: "試験合計",
            weight: 100,
            order: 0,
            examName: "1学期中間",
            subtotalName: null,
            cropRegionLabel: null,
          },
        ],
      },
    ]
    archive.gradeData.gradeOverrides = []
    archive.boundariesData.boundarySets = []

    const { data } = transformGradeToLatest(archive)

    expect(data.gradeDataSources[0].type).toBe("exam_total")
  })

  it("観点を解決できない制約ルールは無効化して取り込ませる", () => {
    const archive = buildV1_9_0Archive()
    archive.gradeData.gradeItems = [
      { name: "知識・技能", order: 0, dataSources: [] },
    ]
    archive.gradeData.gradeConstraints = [
      {
        name: "観点と評定の整合",
        kind: "consistency",
        targetGradeItemName: "知識・技能",
        viewpointGradeItemNames: ["知識・技能", "存在しない観点"],
        expression: "",
        color: "#fecaca",
        message: "観点と評定が合いません",
        enabled: true,
        order: 0,
      },
    ]
    archive.gradeData.gradeOverrides = []
    archive.boundariesData.boundarySets = []

    const { data, warnings } = transformGradeToLatest(archive)

    // 集計対象が減った状態で有効のまま通すと、別物のルールとして判定が動く
    expect(data.gradeConstraints[0].enabled).toBe(false)
    expect(data.gradeConstraints[0].disabledReason).toContain("集計対象の観点")
    expect(
      warnings.some((warning) => warning.includes("観点と評定の整合"))
    ).toBe(true)
  })

  it("同名の評価項目を名前でしか指せないセルは破棄して警告する", () => {
    const archive = buildV1_9_0Archive()
    archive.gradeData.gradeItems = [
      { name: "評定", order: 0, dataSources: [] },
      { name: "評定", order: 1, dataSources: [] },
    ]
    archive.gradeData.gradeOverrides = [
      { studentNumber: "S001", gradeItemName: "評定", overrideLabel: "4" },
    ]
    archive.boundariesData.boundarySets = []

    const { data, warnings } = transformGradeToLatest(archive)

    expect(data.gradeOverrides).toHaveLength(0)
    expect(warnings.some((warning) => warning.includes("同名の評価項目"))).toBe(
      true
    )
  })
})
