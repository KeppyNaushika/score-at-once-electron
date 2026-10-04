/**
 * 旧形式の成績算出アーカイブ（.grade）取り込みの統合テスト
 *
 * テスト対象:
 *   electron-src/lib/import/grade-archive/gradeArchiveImporter.ts
 *
 * 実SQLiteへ取り込み、
 *  - v1.2.0 の Grade.referenceDate / GradeExportSettings
 *  - v1.4.0 の試験外成績資料(Coursework: 複数項目・点数・コメント・名簿・タグ)
 * が取り込みで保持されること、および旧 v1.3.0 形式が Coursework へ変換されることを検証する。
 *
 * 取り込むアーカイブは2種類ある:
 *  - 旧書き出しで作った固定ファイル（__tests__/fixtures/legacy-archives/grade-*.grade）。
 *    書き出しが無くなったので、書き出しがあった頃に作って固定した。各テストの冒頭に
 *    どんな成績算出を書き出したものかを書いてある。成績算出の外にある実体（生徒・学級・
 *    試験・小計・資料・比較先の成績算出・利用者）が「書き出したパソコンに既にある」状態が
 *    要るテストは、固定ファイルの JSON から同じ id の行を作って用意する
 *  - v1.12.0 以前の形をテスト内で手組みしたもの（toLegacyArchive は固定ファイルの中身を
 *    旧形式へ落とす。v1.3.0 / v1.4.0 はリテラルで組む）
 */

import { afterAll, beforeEach, describe, expect, it, vi } from "vitest"

import type { LegacyGradeArchiveData } from "../../../electron-src/lib/import/grade-transformers/legacyShape"
import type { GradeArchiveData } from "../../../src/types/gradeArchive.types"
import {
  cleanupTestDatabase,
  disconnectTestPrisma,
  getTestPrismaClient,
} from "../../helpers/testPrismaClient"

vi.mock("../../../electron-src/lib/prisma/client", () => {
  return {
    default: getTestPrismaClient(),
    getPrismaClient: () => getTestPrismaClient(),
  }
})

import {
  importGradeArchive,
  previewGradeArchiveImport,
} from "../../../electron-src/lib/import/grade-archive/gradeArchiveImporter"
import {
  readLegacyGradeArchive,
  seedCourseworkSections,
} from "../../helpers/legacyArchiveFixtures"

const prisma = getTestPrismaClient()

/**
 * 固定ファイルの生徒・学級・学級所属を、同じ id のまま DB に作る
 * （＝書き出したパソコンに生徒・学級が既にある状態）
 */
async function seedRosterFromArchive(archive: GradeArchiveData) {
  await prisma.student.createMany({ data: archive.studentsData })
  await prisma.classroom.createMany({ data: archive.classesData })
  await prisma.studentClassroomMembership.createMany({
    data: archive.membershipsData,
  })
}

/**
 * 固定ファイルの中身を v1.12.0 以前の射影形式へ落とす（旧アーカイブの再現用）。
 * 変換器の逆向きで、旧形式の読込互換を検証するテストだけが使う。
 */
function toLegacyArchive(archive: GradeArchiveData): LegacyGradeArchiveData {
  const gradeItemNameById = new Map(
    archive.gradeItems.map((gradeItem) => [gradeItem.id, gradeItem.name])
  )
  const studentNumberByGradeStudentId = new Map(
    archive.gradeStudents.map((gradeStudent) => [
      gradeStudent.id,
      archive.studentsData.find(
        (student) => student.id === gradeStudent.studentId
      )!.studentNumber,
    ])
  )
  const legacyCell = (cell: {
    gradeStudentId: string
    gradeItemId: string
  }) => ({
    studentNumber: studentNumberByGradeStudentId.get(cell.gradeStudentId)!,
    gradeItemId: cell.gradeItemId,
    gradeItemName: gradeItemNameById.get(cell.gradeItemId)!,
  })

  return {
    manifest: {
      version: "1.12.0",
      appVersion: "test",
      exportedAt: new Date("2026-06-23T00:00:00.000Z").toISOString(),
      gradeId: archive.manifest.gradeId,
      gradeName: archive.grades[0]?.name ?? "",
      counts: archive.manifest.counts,
    },
    gradeData: {
      grade: {
        name: archive.grades[0].name,
        description: archive.grades[0].description,
        referenceDate: archive.grades[0].referenceDate,
      },
      // 旧形式は設定をまるごと JSON で持っていた。変換器（1.14.0→1.15.0）が列へ
      // 割り直すところまでを、この取り込みで通す
      exportSettings: archive.gradeIndividualReportSettings[0]
        ? {
            settingsJson: toLegacySettingsJson(
              archive.gradeIndividualReportSettings[0]
            ),
          }
        : null,
      gradeItems: archive.gradeItems.map((gradeItem) => ({
        id: gradeItem.id,
        name: gradeItem.name,
        order: gradeItem.order,
        dataSources: archive.gradeDataSources
          .filter((dataSource) => dataSource.gradeItemId === gradeItem.id)
          .map((dataSource) => ({
            id: dataSource.id,
            type: dataSource.type,
            name: dataSource.name,
            weight: Number(dataSource.weight),
            order: dataSource.order,
            examName:
              archive.examRefs.find(
                (examRef) => examRef.id === dataSource.examId
              )?.examName ?? null,
            subtotalName:
              archive.subtotalRefs.find(
                (subtotalRef) => subtotalRef.id === dataSource.subtotalId
              )?.name ?? null,
            cropRegionLabel:
              archive.cropRegionRefs.find(
                (cropRegionRef) => cropRegionRef.id === dataSource.cropRegionId
              )?.label ?? null,
            absentMethod: dataSource.absentMethod,
            absentRatio: Number(dataSource.absentRatio),
            absentOffset: Number(dataSource.absentOffset),
            treatExpectedAsMissing: dataSource.treatExpectedAsMissing,
            estimationMode: dataSource.estimationMode,
            estimationSourceIds: archive.gradeDataSourceEstimationSources
              .filter(
                (estimationSource) =>
                  estimationSource.dataSourceId === dataSource.id
              )
              .map((estimationSource) => estimationSource.sourceDataSourceId),
            examId: dataSource.examId,
            subtotalId: dataSource.subtotalId,
            cropRegionId: dataSource.cropRegionId,
            courseworkId: dataSource.courseworkId,
            courseworkItemId: dataSource.courseworkItemId,
          })),
      })),
      classroomRefs: archive.gradeClassrooms.map((gradeClassroom) => ({
        id: gradeClassroom.classroomId,
        name: archive.classesData.find(
          (classroom) => classroom.id === gradeClassroom.classroomId
        )!.name,
      })),
      examRefs: archive.examRefs.map((examRef) => ({
        id: examRef.id,
        examName: examRef.examName,
        examDate: examRef.referenceDate,
        dataSourceName:
          archive.gradeDataSources.find(
            (dataSource) => dataSource.examId === examRef.id
          )?.name ?? "",
      })),
      studentRefs: archive.gradeStudents.map((gradeStudent) => ({
        id: gradeStudent.studentId,
        studentNumber: studentNumberByGradeStudentId.get(gradeStudent.id)!,
        classroomName: null,
        customOrder: gradeStudent.customOrder,
      })),
      gradeItemExclusions: archive.gradeItemExclusions.map(legacyCell),
      gradeOverrides: archive.gradeOverrides.map((override) => ({
        ...legacyCell(override),
        overrideLabel: override.overrideLabel,
      })),
      gradeFrozenScores: archive.gradeFrozenScores.map((frozenScore) => ({
        ...legacyCell(frozenScore),
        weightedScore:
          frozenScore.weightedScore === null
            ? null
            : Number(frozenScore.weightedScore),
        weightedMaxScore: Number(frozenScore.weightedMaxScore),
        percentage:
          frozenScore.percentage === null
            ? null
            : Number(frozenScore.percentage),
        gradeLabel: frozenScore.gradeLabel,
        frozenAt: frozenScore.frozenAt,
      })),
      gradeConstraints: archive.gradeConstraints.map((constraint) => ({
        name: constraint.name,
        kind: constraint.kind,
        targetGradeItemId: constraint.targetGradeItemId,
        targetGradeItemName: constraint.targetGradeItemId
          ? (gradeItemNameById.get(constraint.targetGradeItemId) ?? null)
          : null,
        aggregate: constraint.aggregate,
        tolerance: Number(constraint.tolerance),
        viewpointGradeItemIds: archive.gradeConstraintViewpoints
          .filter((viewpoint) => viewpoint.constraintId === constraint.id)
          .map((viewpoint) => viewpoint.gradeItemId),
        viewpointGradeItemNames: archive.gradeConstraintViewpoints
          .filter((viewpoint) => viewpoint.constraintId === constraint.id)
          .map((viewpoint) => gradeItemNameById.get(viewpoint.gradeItemId)!),
        labelValues: Object.fromEntries(
          archive.gradeConstraintLabelValues
            .filter((labelValue) => labelValue.constraintId === constraint.id)
            .map((labelValue) => [labelValue.label, Number(labelValue.value)])
        ),
        exclusionLabels: archive.gradeConstraintExclusionLabels
          .filter(
            (exclusionLabel) => exclusionLabel.constraintId === constraint.id
          )
          .map((exclusionLabel) => exclusionLabel.label),
        expression: constraint.expression,
        color: constraint.color,
        message: constraint.message,
        enabled: constraint.enabled,
        order: constraint.order,
      })),
    },
    courseworkArchive: archive.courseworkArchive,
    boundariesData: {
      // 旧形式は評価項目ごとの入れ子。境界を持つ項目だけを載せる
      boundarySets: archive.gradeItems
        .map((gradeItem) => ({
          gradeItemId: gradeItem.id,
          gradeItemName: gradeItemNameById.get(gradeItem.id)!,
          boundaries: archive.gradeItemBoundaries
            .filter((boundary) => boundary.gradeItemId === gradeItem.id)
            .map((boundary) => ({
              label: boundary.label,
              minPercentage: Number(boundary.minPercentage),
              order: boundary.order,
            })),
        }))
        .filter((boundarySet) => boundarySet.boundaries.length > 0),
    },
  }
}

/** 現行の設定の行を、旧形式（1.14.0 以前）の JSON へ畳み直す */
function toLegacySettingsJson(
  reportSettings: GradeArchiveData["gradeIndividualReportSettings"][number]
): string {
  return JSON.stringify({
    reportOptions: {
      title: reportSettings.title,
      showItemGrades: reportSettings.showItemGrades,
      itemGradeColumns: {
        score: reportSettings.itemGradeColumnScore,
        percentage: reportSettings.itemGradeColumnPercentage,
        gradeLabel: reportSettings.itemGradeColumnGradeLabel,
      },
      itemGradeFontSize: reportSettings.itemGradeFontSize,
      itemGradeTableColumns: reportSettings.itemGradeTableColumns,
      showSourceBreakdown: reportSettings.showSourceBreakdown,
      sourceBreakdownColumns: {
        score: reportSettings.sourceBreakdownColumnScore,
        weight: reportSettings.sourceBreakdownColumnWeight,
        comment: reportSettings.sourceBreakdownColumnComment,
      },
      sourceBreakdownFontSize: reportSettings.sourceBreakdownFontSize,
      sourceBreakdownTableColumns: reportSettings.sourceBreakdownTableColumns,
      dataSourceLabel: reportSettings.dataSourceLabel,
      showCommentSection: reportSettings.showCommentSection,
      showSignatureSection: reportSettings.showSignatureSection,
      footer: {
        left: reportSettings.footerLeft,
        center: reportSettings.footerCenter,
        right: reportSettings.footerRight,
      },
    },
  })
}

describe("grade-archive 取り込み", () => {
  beforeEach(async () => {
    await cleanupTestDatabase()
  })

  afterAll(async () => {
    await disconnectTestPrisma()
  })

  it("Grade.referenceDate と個人成績通知書の設定が取り込みで保持される", async () => {
    // 固定ファイル: 成績「成績_通知書」（説明あり・基準日 2026-04-01）に、通知書の設定
    // （題名「通知票」・評価項目の評定を出さない・割合の列を出さない・文字14・
    // 資料の見出し「資料」・左フッター「左」）と評価項目1つを付けて書き出した
    const archive = await readLegacyGradeArchive("grade-report-settings.grade")

    // インポート（新規Gradeとして作成される）
    const result = await importGradeArchive(archive)
    expect(result.gradeId).toBeDefined()

    const imported = await prisma.grade.findUnique({
      where: { id: result.gradeId! },
    })
    expect(imported).not.toBeNull()
    expect(imported!.referenceDate?.toISOString()).toBe(
      "2026-04-01T00:00:00.000Z"
    )

    const importedSettings =
      await prisma.gradeIndividualReportSettings.findUnique({
        where: { gradeId: result.gradeId! },
      })
    expect(importedSettings).not.toBeNull()
    expect(importedSettings!.title).toBe("通知票")
    expect(importedSettings!.showItemGrades).toBe(false)
    expect(importedSettings!.itemGradeColumnPercentage).toBe(false)
    expect(importedSettings!.itemGradeFontSize).toBe(14)
    expect(importedSettings!.dataSourceLabel).toBe("資料")
    expect(importedSettings!.footerLeft).toBe("左")
    // 触っていない項目は既定のまま（旧アーカイブに無くても落ちない）
    expect(importedSettings!.itemGradeColumnScore).toBe(true)
  })

  it("成績のタグ(GradeTag)が取り込みで保持される (v1.16.0)", async () => {
    // 固定ファイル: 成績「タグ付き成績」にタグ「教科_国語」を1つ付けて書き出した
    const archive = await readLegacyGradeArchive("grade-tag.grade")
    // 中間テーブルの行と、タグの実体の両方が載っている（実体が無いと名前を復元できない）
    expect(archive.gradeTags).toHaveLength(1)
    expect(archive.tagsData).toHaveLength(1)
    // 書き出したパソコンを模す: タグはこの DB に既にある
    const tag = await prisma.tag.create({ data: archive.tagsData[0] })

    const result = await importGradeArchive(archive)
    const importedTags = await prisma.gradeTag.findMany({
      where: { gradeId: result.gradeId! },
      include: { tag: true },
    })
    // タグは成績の外にある共有物なので、既存タグへ寄る（作り直さない）
    expect(importedTags).toHaveLength(1)
    expect(importedTags[0].tagId).toBe(tag.id)
    expect(importedTags[0].tag.name).toBe("教科_国語")
    expect(await prisma.tag.count()).toBe(1)
  })

  it("比較(GradeComparison)が取り込みで保持される (v1.17.0)", async () => {
    // 固定ファイル: 成績「2学期」の評価項目「知識」「評定」。比較は2つで、知識→評定
    // （同じ成績算出）と、評定→別の成績算出「1学期」の「評定」（アーカイブに入らない）
    const archive = await readLegacyGradeArchive("grade-comparisons.grade")
    expect(archive.gradeComparisons).toHaveLength(2)
    // 同定情報を添えるのは、アーカイブに入らない成績算出の項目だけ
    expect(archive.comparedGradeItemRefs).toHaveLength(1)
    const [previousItemRef] = archive.comparedGradeItemRefs
    expect(previousItemRef.gradeName).toBe("1学期")

    // 書き出したパソコンを模す: 比較先の成績算出はこの DB に既にある
    await prisma.grade.create({
      data: { id: previousItemRef.gradeId, name: previousItemRef.gradeName },
    })
    const previousItem = await prisma.gradeItem.create({
      data: {
        id: previousItemRef.id,
        gradeId: previousItemRef.gradeId,
        name: previousItemRef.gradeItemName,
        order: 0,
      },
    })

    const result = await importGradeArchive(archive)
    const importedItems = await prisma.gradeItem.findMany({
      where: { gradeId: result.gradeId! },
      include: { comparisons: true },
    })
    const importedKnowledge = importedItems.find(
      (gradeItem) => gradeItem.name === "知識"
    )!
    const importedRating = importedItems.find(
      (gradeItem) => gradeItem.name === "評定"
    )!
    // 同じ成績算出の相手は、取り込んで作った項目へ付け替わる
    expect(
      importedKnowledge.comparisons.map(
        (comparison) => comparison.comparedGradeItemId
      )
    ).toEqual([importedRating.id])
    // 別の成績算出の相手は、既存の項目へ uuid で当たる
    expect(
      importedRating.comparisons.map(
        (comparison) => comparison.comparedGradeItemId
      )
    ).toEqual([previousItem.id])
  })

  it("比較先は uuid が当たらなければ成績算出名＋項目名で当て、当たらなければ落として伝える (v1.17.0)", async () => {
    // 固定ファイル: 成績「後期」の評価項目「評定」から、別の成績算出「前期」の「評定」への比較1つ
    const archive = await readLegacyGradeArchive(
      "grade-comparison-other-grade.grade"
    )
    const [previousItemRef] = archive.comparedGradeItemRefs
    const previousGrade = await prisma.grade.create({
      data: { name: previousItemRef.gradeName },
    })
    const previousItem = await prisma.gradeItem.create({
      data: {
        gradeId: previousGrade.id,
        name: previousItemRef.gradeItemName,
        order: 0,
      },
    })

    // 別の PC から持ってきた想定: 比較先の uuid は取り込み先に無い
    const byName: GradeArchiveData = {
      ...archive,
      gradeComparisons: [
        { ...archive.gradeComparisons[0], comparedGradeItemId: "other-pc-1" },
        {
          ...archive.gradeComparisons[0],
          id: "comparison-missing",
          comparedGradeItemId: "other-pc-2",
          order: 1,
        },
      ],
      comparedGradeItemRefs: [
        { ...previousItemRef, id: "other-pc-1" },
        {
          id: "other-pc-2",
          gradeId: "other-pc-grade",
          gradeName: "存在しない成績",
          gradeItemName: "評定",
        },
      ],
    }

    const result = await importGradeArchive(byName)
    const importedComparisons = await prisma.gradeComparison.findMany({
      where: { gradeItem: { gradeId: result.gradeId! } },
    })
    expect(
      importedComparisons.map((comparison) => comparison.comparedGradeItemId)
    ).toEqual([previousItem.id])
    expect(
      result.warnings.some((warning) => warning.includes("比較 1件"))
    ).toBe(true)
  })

  it("試験外成績資料(Coursework)の項目・点数・コメント・名簿・タグが取り込みで保持される (v1.4.0)", async () => {
    // 固定ファイル: 学級「学級_資料内包」・生徒「CW_101」・タグ「タグ_資料内包」を持つ資料
    // 「第2回レポート」（数値の「提出物」85点・調整-5、文字評価の「授業態度」A/B/C で B）と、
    // その2項目を参照する coursework 型データソース2つを持つ成績「成績_資料内包」
    const archive = await readLegacyGradeArchive(
      "grade-embedded-coursework.grade"
    )
    const embedded = archive.courseworkArchive
    expect(embedded.courseworks).toHaveLength(1)
    expect(embedded.courseworkItems).toHaveLength(2)
    expect(embedded.courseworkClassrooms).toHaveLength(1)
    // 参照先の資料・評価項目は内包する courseworkArchive の行として carry されている。
    // データソースの行は uuid だけを持つ（名前を二重に持たない）
    const archivedNumDs = archive.gradeDataSources.find(
      (dataSource) => dataSource.name === "提出物参照"
    )!
    const referencedItem = embedded.courseworkItems.find(
      (item) => item.id === archivedNumDs.courseworkItemId
    )!
    expect(referencedItem.name).toBe("提出物")

    // 書き出したパソコンを模す: 資料（と生徒・学級・タグ）はこの DB に既にある
    await seedCourseworkSections(embedded)

    // インポート（新規 Grade が作成され、資料は既存のものが uuid 一致で再利用される）
    const result = await importGradeArchive(archive)

    // import 後、coursework 型データソースが courseworkItem を正しく解決していること
    const importedDs = await prisma.gradeDataSource.findFirst({
      where: {
        gradeItem: { gradeId: result.gradeId! },
        name: "提出物参照",
      },
      include: {
        courseworkItem: {
          include: {
            coursework: true,
            scores: {
              include: { courseworkStudent: { include: { student: true } } },
            },
          },
        },
      },
    })
    expect(importedDs!.courseworkItem).not.toBeNull()
    expect(importedDs!.courseworkItem!.id).toBe(referencedItem.id)
    expect(importedDs!.courseworkItem!.name).toBe("提出物")
    expect(importedDs!.courseworkItem!.coursework.name).toBe("第2回レポート")
    // 既存同名 Coursework が再利用される（重複作成されない）
    const courseworkCount = await prisma.coursework.count({
      where: { name: "第2回レポート" },
    })
    expect(courseworkCount).toBe(1)
  })

  it("v1.4.0 で新規 Coursework が埋め込みから復元される（名前を変えて衝突回避）", async () => {
    const suffix = Date.now()
    await prisma.student.create({
      data: {
        studentNumber: `CW2_${suffix}`,
        lastName: "佐藤",
        firstName: "花子",
        lastNameKana: "サトウ",
        firstNameKana: "ハナコ",
      },
    })

    // アーカイブを手組み（DBには Coursework を作らず、埋め込みのみ）
    const archive: LegacyGradeArchiveData = {
      manifest: {
        version: "1.4.0",
        appVersion: "test",
        exportedAt: new Date().toISOString(),
        gradeId: "src",
        gradeName: `成績_embed_${suffix}`,
        counts: {
          gradeItems: 1,
          dataSources: 1,
          manualScores: 1,
          boundaries: 0,
          classrooms: 0,
          students: 1,
        },
      },
      gradeData: {
        grade: { name: `成績_embed_${suffix}`, description: null },
        gradeItems: [
          {
            name: "観点A",
            order: 0,
            dataSources: [
              {
                type: "coursework",
                name: "資料参照",
                maxScore: 100,
                weight: 100,
                order: 0,
                examName: null,
                subtotalName: null,
                cropRegionLabel: null,
                courseworkName: `埋込資料_${suffix}`,
                courseworkItemName: "課題1",
              },
            ],
          },
        ],
        classroomRefs: [],
        examRefs: [],
        studentRefs: [
          {
            studentNumber: `CW2_${suffix}`,
            classroomName: null,
            customOrder: 0,
          },
        ],
      },
      courseworks: [
        {
          id: `cw_embed_${suffix}`,
          name: `埋込資料_${suffix}`,
          description: "埋め込みテスト",
          date: null,
          classrooms: [],
          tags: [],
          students: [{ studentNumber: `CW2_${suffix}`, customOrder: 0 }],
          items: [
            {
              id: `cwi_embed_${suffix}`,
              name: "課題1",
              order: 0,
              maxScore: 100,
              inputMode: "numeric",
              letterScales: [],
              scores: [
                {
                  studentNumber: `CW2_${suffix}`,
                  score: 72,
                  letterValue: null,
                  adjustment: null,
                  adjustmentReason: null,
                  comment: "良好",
                },
              ],
            },
          ],
        },
      ],
      boundariesData: { boundarySets: [] },
    }

    const result = await importGradeArchive(archive)

    const importedItem = await prisma.courseworkItem.findFirst({
      where: { coursework: { name: `埋込資料_${suffix}` }, name: "課題1" },
      include: {
        scores: {
          include: { courseworkStudent: { include: { student: true } } },
        },
      },
    })
    expect(importedItem).not.toBeNull()
    expect(importedItem!.scores).toHaveLength(1)
    expect(Number(importedItem!.scores[0].score)).toBe(72)
    expect(
      importedItem!.scores[0].courseworkStudent.student.studentNumber
    ).toBe(`CW2_${suffix}`)

    const dataSource = await prisma.gradeDataSource.findFirst({
      where: { gradeItem: { gradeId: result.gradeId! }, name: "資料参照" },
    })
    expect(dataSource!.courseworkItemId).toBe(importedItem!.id)
    expect(dataSource!.type).toBe("coursework")
  })

  it("旧 v1.3.0 形式（manual + inputMode + letterScales）が Coursework へ変換される（後方互換）", async () => {
    const suffix = Date.now()
    await prisma.student.create({
      data: {
        studentNumber: `LEGACY_${suffix}`,
        lastName: "高橋",
        firstName: "次郎",
        lastNameKana: "タカハシ",
        firstNameKana: "ジロウ",
      },
    })

    // 旧 v1.3.0 アーカイブ JSON を手組み（courseworks 無し、manualScoresData あり）
    const legacy: LegacyGradeArchiveData = {
      manifest: {
        version: "1.3.0",
        appVersion: "test",
        exportedAt: new Date().toISOString(),
        gradeId: "legacy",
        gradeName: `成績_legacy_${suffix}`,
        counts: {
          gradeItems: 1,
          dataSources: 1,
          manualScores: 1,
          boundaries: 0,
          classrooms: 0,
          students: 1,
        },
      },
      gradeData: {
        grade: { name: `成績_legacy_${suffix}`, description: null },
        gradeItems: [
          {
            name: "授業態度",
            order: 0,
            dataSources: [
              {
                type: "manual",
                name: "観点別評価",
                maxScore: 100,
                weight: 100,
                order: 0,
                examName: null,
                subtotalName: null,
                cropRegionLabel: null,
                inputMode: "letter",
                letterScales: [
                  { label: "A", score: 100, order: 0 },
                  { label: "B", score: 80, order: 1 },
                  { label: "C", score: 60, order: 2 },
                ],
              },
            ],
          },
        ],
        classroomRefs: [],
        examRefs: [],
        studentRefs: [
          {
            studentNumber: `LEGACY_${suffix}`,
            classroomName: null,
            customOrder: 0,
          },
        ],
      },
      manualScoresData: {
        manualScores: [
          {
            gradeItemName: "授業態度",
            dataSourceName: "観点別評価",
            studentNumber: `LEGACY_${suffix}`,
            score: null,
            letterValue: "B",
            adjustment: -5,
            adjustmentReason: "提出遅延",
            comment: "発表が活発でした",
          },
        ],
      },
      boundariesData: { boundarySets: [] },
    }

    const result = await importGradeArchive(legacy)

    // manual DataSource → Coursework(1項目) へ変換されている
    const importedItem = await prisma.courseworkItem.findFirst({
      where: { coursework: { name: "観点別評価" }, name: "観点別評価" },
      include: {
        letterScales: { orderBy: { order: "asc" } },
        scores: true,
      },
    })
    expect(importedItem).not.toBeNull()
    expect(importedItem!.inputMode).toBe("letter")
    expect(importedItem!.letterScales).toHaveLength(3)
    expect(importedItem!.letterScales[0].label).toBe("A")
    expect(importedItem!.scores).toHaveLength(1)
    expect(importedItem!.scores[0].letterValue).toBe("B")
    expect(Number(importedItem!.scores[0].adjustment)).toBe(-5)
    expect(importedItem!.scores[0].comment).toBe("発表が活発でした")

    // GradeDataSource が coursework 型に変換され item を参照している
    const dataSource = await prisma.gradeDataSource.findFirst({
      where: { gradeItem: { gradeId: result.gradeId! }, name: "観点別評価" },
    })
    expect(dataSource!.type).toBe("coursework")
    expect(dataSource!.courseworkItemId).toBe(importedItem!.id)
  })

  // 回帰: 旧 v1.3.0 を preview→import の順に同一オブジェクトで処理しても
  //   変換が入力を破壊せず、スコアが失われないこと（in-place mutation 回帰の防止）
  it("v1.3.0: preview 実行後に同一オブジェクトを import してもスコアが保持される", async () => {
    const suffix = Date.now()
    await prisma.student.create({
      data: {
        studentNumber: `PV_${suffix}`,
        lastName: "山田",
        firstName: "太郎",
        lastNameKana: "ヤマダ",
        firstNameKana: "タロウ",
      },
    })

    const buildLegacy = (): LegacyGradeArchiveData => ({
      manifest: {
        version: "1.3.0",
        appVersion: "test",
        exportedAt: new Date("2026-06-23T00:00:00.000Z").toISOString(),
        gradeId: "legacy-pv",
        gradeName: `成績_pv_${suffix}`,
        counts: {
          gradeItems: 1,
          dataSources: 1,
          manualScores: 1,
          boundaries: 0,
          classrooms: 0,
          students: 1,
        },
      },
      gradeData: {
        grade: { name: `成績_pv_${suffix}`, description: null },
        gradeItems: [
          {
            name: "提出物",
            order: 0,
            dataSources: [
              {
                type: "manual",
                name: "レポート",
                maxScore: 100,
                weight: 100,
                order: 0,
                examName: null,
                subtotalName: null,
                cropRegionLabel: null,
              },
            ],
          },
        ],
        classroomRefs: [],
        examRefs: [],
        studentRefs: [
          {
            studentNumber: `PV_${suffix}`,
            classroomName: null,
            customOrder: 0,
          },
        ],
      },
      manualScoresData: {
        manualScores: [
          {
            gradeItemName: "提出物",
            dataSourceName: "レポート",
            studentNumber: `PV_${suffix}`,
            score: 73,
            letterValue: null,
            adjustment: null,
            adjustmentReason: null,
            comment: null,
          },
        ],
      },
      boundariesData: { boundarySets: [] },
    })

    // 同一オブジェクトを preview→import に渡す（IPC の実フローを再現）
    const archive = buildLegacy()
    const preview = await previewGradeArchiveImport(archive)
    // preview は入力を破壊しない（manual 型のまま）
    expect(archive.gradeData.gradeItems[0].dataSources[0].type).toBe("manual")
    expect(preview.courseworkMatches).toHaveLength(1)

    const result = await importGradeArchive(archive)

    // スコアが失われず復元される
    const item = await prisma.courseworkItem.findFirst({
      where: { name: "レポート" },
      include: { scores: true },
    })
    expect(item).not.toBeNull()
    expect(item!.scores).toHaveLength(1)
    expect(Number(item!.scores[0].score)).toBe(73)

    // DataSource は coursework 型に解決され "manual" が残らない
    const dataSource = await prisma.gradeDataSource.findFirst({
      where: { gradeItem: { gradeId: result.gradeId! }, name: "レポート" },
    })
    expect(dataSource!.type).toBe("coursework")
    expect(dataSource!.courseworkItemId).toBe(item!.id)
  })

  // 回帰: 点数が一切入力されていない manual ソースも coursework 型へ変換され、
  //   無効な "manual" 型のまま永続化されないこと（検出ゲートの回帰防止）
  it("v1.3.0: 点数未入力の manual ソースも coursework 型へ変換される", async () => {
    const suffix = Date.now()
    const archive: LegacyGradeArchiveData = {
      manifest: {
        version: "1.3.0",
        appVersion: "test",
        exportedAt: new Date("2026-06-23T00:00:00.000Z").toISOString(),
        gradeId: "legacy-empty",
        gradeName: `成績_empty_${suffix}`,
        counts: {
          gradeItems: 1,
          dataSources: 1,
          manualScores: 0,
          boundaries: 0,
          classrooms: 0,
          students: 0,
        },
      },
      gradeData: {
        grade: { name: `成績_empty_${suffix}`, description: null },
        gradeItems: [
          {
            name: "活動",
            order: 0,
            dataSources: [
              {
                type: "manual",
                name: "観察",
                maxScore: 50,
                weight: 100,
                order: 0,
                examName: null,
                subtotalName: null,
                cropRegionLabel: null,
              },
            ],
          },
        ],
        classroomRefs: [],
        examRefs: [],
        studentRefs: [],
      },
      manualScoresData: { manualScores: [] },
      boundariesData: { boundarySets: [] },
    }

    const result = await importGradeArchive(archive)

    const dataSource = await prisma.gradeDataSource.findFirst({
      where: { gradeItem: { gradeId: result.gradeId! }, name: "観察" },
    })
    expect(dataSource!.type).toBe("coursework")
    // 点数ゼロでも CourseworkItem は生成され参照される
    expect(dataSource!.courseworkItemId).not.toBeNull()
  })

  it("referenceDate/通知書の設定が無いGradeも問題なく取り込める（後方互換）", async () => {
    // 固定ファイル: 名前「成績_空」だけの成績算出（評価項目も名簿も無い）
    const archive = await readLegacyGradeArchive("grade-empty.grade")
    expect(archive.grades[0].referenceDate).toBeNull()
    expect(archive.gradeIndividualReportSettings).toHaveLength(0)
    expect(archive.courseworkArchive.courseworks).toHaveLength(0)

    const result = await importGradeArchive(archive)

    const imported = await prisma.grade.findUnique({
      where: { id: result.gradeId! },
    })
    expect(imported!.referenceDate).toBeNull()

    const importedSettings =
      await prisma.gradeIndividualReportSettings.findUnique({
        where: { gradeId: result.gradeId! },
      })
    expect(importedSettings).toBeNull()
  })

  it("v1.4.0: uuid一次照合で再インポートは冪等、明示的newで複製（ユーザー判断）", async () => {
    const suffix = Date.now()
    const cwId = `cw_uuid_${suffix}`
    const itemId = `cwi_uuid_${suffix}`
    const cwName = `uuid資料_${suffix}`
    await prisma.student.create({
      data: {
        studentNumber: `UU_${suffix}`,
        lastName: "鈴木",
        firstName: "一郎",
        lastNameKana: "スズキ",
        firstNameKana: "イチロウ",
      },
    })

    const buildArchive = (): LegacyGradeArchiveData => ({
      manifest: {
        version: "1.4.0",
        appVersion: "test",
        exportedAt: new Date().toISOString(),
        gradeId: "g",
        gradeName: `成績_${suffix}`,
        counts: {
          gradeItems: 1,
          dataSources: 1,
          manualScores: 1,
          boundaries: 0,
          classrooms: 0,
          students: 1,
        },
      },
      gradeData: {
        grade: { name: `成績_${suffix}`, description: null },
        gradeItems: [
          {
            name: "観点",
            order: 0,
            dataSources: [
              {
                type: "coursework",
                name: "資料参照",
                maxScore: 100,
                weight: 100,
                order: 0,
                examName: null,
                subtotalName: null,
                cropRegionLabel: null,
                courseworkId: cwId,
                courseworkItemId: itemId,
                courseworkName: cwName,
                courseworkItemName: "課題",
              },
            ],
          },
        ],
        classroomRefs: [],
        examRefs: [],
        studentRefs: [
          {
            studentNumber: `UU_${suffix}`,
            classroomName: null,
            customOrder: 0,
          },
        ],
      },
      courseworks: [
        {
          id: cwId,
          name: cwName,
          description: null,
          date: null,
          classrooms: [],
          tags: [],
          students: [{ studentNumber: `UU_${suffix}`, customOrder: 0 }],
          items: [
            {
              id: itemId,
              name: "課題",
              order: 0,
              maxScore: 100,
              inputMode: "numeric",
              letterScales: [],
              scores: [
                {
                  studentNumber: `UU_${suffix}`,
                  score: 80,
                  letterValue: null,
                  adjustment: null,
                  adjustmentReason: null,
                  comment: null,
                },
              ],
            },
          ],
        },
      ],
      boundariesData: { boundarySets: [] },
    })

    // 1回目: decision未指定 → 元uuidを保持して新規作成
    await importGradeArchive(buildArchive())
    const created = await prisma.coursework.findUnique({ where: { id: cwId } })
    expect(created).not.toBeNull()

    // preview: uuid一致が検出される
    const preview = await previewGradeArchiveImport(buildArchive())
    expect(preview.courseworkMatches[0].uuidMatch?.id).toBe(cwId)

    // 2回目: decision未指定 → uuid一致で流用（複製しない=冪等）
    const r2 = await importGradeArchive(buildArchive())
    const afterReuse = await prisma.coursework.findMany({
      where: { name: cwName },
    })
    expect(afterReuse).toHaveLength(1)
    // DataSource は既存項目(itemId)を uuid一次で解決して結ぶ
    const ds2 = await prisma.gradeDataSource.findFirst({
      where: { gradeItem: { gradeId: r2.gradeId! }, name: "資料参照" },
    })
    expect(ds2!.courseworkItemId).toBe(itemId)

    // 3回目: 明示的 new → ユーザー判断で別資料として複製（新uuid）
    await importGradeArchive(buildArchive(), {
      courseworkDecisions: { [cwId]: { action: "new" } },
    })
    const afterNew = await prisma.coursework.findMany({
      where: { name: cwName },
    })
    expect(afterNew).toHaveLength(2)
  })

  it("v1.4.0: reuse判断で既存資料に統合し、不足項目だけ補完する", async () => {
    const suffix = Date.now()
    await prisma.student.create({
      data: {
        studentNumber: `RE_${suffix}`,
        lastName: "田中",
        firstName: "花",
        lastNameKana: "タナカ",
        firstNameKana: "ハナ",
      },
    })
    // 既存資料（項目「既存」のみ）を用意
    const existing = await prisma.coursework.create({
      data: {
        name: `統合先_${suffix}`,
        items: { create: [{ name: "既存", order: 0, maxScore: 100 }] },
      },
      include: { items: true },
    })

    const archive: LegacyGradeArchiveData = {
      manifest: {
        version: "1.4.0",
        appVersion: "test",
        exportedAt: new Date().toISOString(),
        gradeId: "g",
        gradeName: `成績_re_${suffix}`,
        counts: {
          gradeItems: 1,
          dataSources: 1,
          manualScores: 1,
          boundaries: 0,
          classrooms: 0,
          students: 1,
        },
      },
      gradeData: {
        grade: { name: `成績_re_${suffix}`, description: null },
        gradeItems: [
          {
            name: "観点",
            order: 0,
            dataSources: [
              {
                type: "coursework",
                name: "資料参照",
                maxScore: 100,
                weight: 100,
                order: 0,
                examName: null,
                subtotalName: null,
                cropRegionLabel: null,
                courseworkId: `arch_cw_${suffix}`,
                courseworkItemId: `arch_item_${suffix}`,
                courseworkName: `統合先_${suffix}`,
                courseworkItemName: "新規項目",
              },
            ],
          },
        ],
        classroomRefs: [],
        examRefs: [],
        studentRefs: [
          {
            studentNumber: `RE_${suffix}`,
            classroomName: null,
            customOrder: 0,
          },
        ],
      },
      courseworks: [
        {
          id: `arch_cw_${suffix}`,
          name: `統合先_${suffix}`,
          description: null,
          date: null,
          classrooms: [],
          tags: [],
          students: [{ studentNumber: `RE_${suffix}`, customOrder: 0 }],
          items: [
            {
              id: `arch_item_${suffix}`,
              name: "新規項目",
              order: 1,
              maxScore: 50,
              inputMode: "numeric",
              letterScales: [],
              scores: [
                {
                  studentNumber: `RE_${suffix}`,
                  score: 40,
                  letterValue: null,
                  adjustment: null,
                  adjustmentReason: null,
                  comment: null,
                },
              ],
            },
          ],
        },
      ],
      boundariesData: { boundarySets: [] },
    }

    const result = await importGradeArchive(archive, {
      courseworkDecisions: {
        [`arch_cw_${suffix}`]: { action: "reuse", existingId: existing.id },
      },
    })

    // 複製されず既存資料に項目が補完される（既存「既存」＋補完「新規項目」=2）
    const items = await prisma.courseworkItem.findMany({
      where: { courseworkId: existing.id },
    })
    expect(items).toHaveLength(2)
    expect(items.map((i) => i.name)).toEqual(
      expect.arrayContaining(["既存", "新規項目"])
    )
    // DataSource は補完された項目に結ばれる
    const dataSource = await prisma.gradeDataSource.findFirst({
      where: { gradeItem: { gradeId: result.gradeId! }, name: "資料参照" },
      include: { courseworkItem: true },
    })
    expect(dataSource!.courseworkItem!.name).toBe("新規項目")
    expect(dataSource!.courseworkItem!.courseworkId).toBe(existing.id)
  })

  it("観点間の制約ルール(GradeConstraint)が取り込みで保持される (v1.7.0/v1.11.0)", async () => {
    // 固定ファイル: 成績「成績_制約」の評価項目「知識・技能」「評定」と、制約2つ。
    // 「A・C混在禁止」（混在禁止・ラベル A,C・有効）と「評定と観点の整合」（整合・比較先は評定・
    // 観点は知識・技能・合計・許容2・A=5,C=1・無効・色 #fde68a）
    const archive = await readLegacyGradeArchive("grade-constraints.grade")
    expect(archive.gradeConstraints).toHaveLength(2)
    const archivedHyotei = archive.gradeItems.find(
      (gradeItem) => gradeItem.name === "評定"
    )!

    // インポート（新規Gradeとして作成される）
    const result = await importGradeArchive(archive)

    const imported = await prisma.gradeConstraint.findMany({
      where: { gradeId: result.gradeId! },
      include: {
        viewpoints: { orderBy: { order: "asc" } },
        labelValues: { orderBy: { order: "asc" } },
        exclusionLabels: { orderBy: { order: "asc" } },
      },
      orderBy: { order: "asc" },
    })
    expect(imported).toHaveLength(2)
    expect(imported[0].name).toBe("A・C混在禁止")
    expect(imported[0].kind).toBe("mutual_exclusion")
    expect(imported[0].message).toBe("AとCは混在しません")
    expect(imported[0].enabled).toBe(true)
    expect(imported[0].exclusionLabels.map((label) => label.label)).toEqual([
      "A",
      "C",
    ])

    // 参照は取り込み先の評価項目を指す（元Gradeの項目idのままではない）
    const importedItems = await prisma.gradeItem.findMany({
      where: { gradeId: result.gradeId! },
    })
    const importedHyotei = importedItems.find(
      (gradeItem) => gradeItem.name === "評定"
    )!
    const importedKnowledge = importedItems.find(
      (gradeItem) => gradeItem.name === "知識・技能"
    )!
    expect(importedHyotei.id).not.toBe(archivedHyotei.id)
    expect(imported[1].kind).toBe("consistency")
    expect(imported[1].targetGradeItemId).toBe(importedHyotei.id)
    expect(
      imported[1].viewpoints.map((viewpoint) => viewpoint.gradeItemId)
    ).toEqual([importedKnowledge.id])
    expect(imported[1].aggregate).toBe("sum")
    expect(Number(imported[1].tolerance)).toBe(2)
    expect(
      imported[1].labelValues.map((labelValue) => [
        labelValue.label,
        Number(labelValue.value),
      ])
    ).toEqual([
      ["A", 5],
      ["C", 1],
    ])
    expect(imported[1].enabled).toBe(false)
    expect(imported[1].color).toBe("#fde68a")
  })

  it("成績値の確定(GradeFrozenScore)が取り込みで保持される (v1.9.0)", async () => {
    // 固定ファイル: 成績「成績_確定」の対象者1名（SF001）・評価項目「知識・技能」に、
    // 確定値（0.8/1・80%・A・確定日時 2026-07-20T09:00Z・確定操作者なし）
    const archive = await readLegacyGradeArchive("grade-frozen-score.grade")
    expect(archive.gradeFrozenScores).toHaveLength(1)
    // 書き出したパソコンを模す: 生徒はこの DB に既にある
    await seedRosterFromArchive(archive)
    const student = archive.studentsData[0]

    // インポート（新規Gradeとして作成される）
    const result = await importGradeArchive(archive)

    const imported = await prisma.gradeFrozenScore.findMany({
      where: { gradeStudent: { gradeId: result.gradeId! } },
    })
    expect(imported).toHaveLength(1)
    expect(Number(imported[0].percentage)).toBe(80)
    expect(Number(imported[0].weightedScore)).toBe(0.8)
    expect(Number(imported[0].weightedMaxScore)).toBe(1)
    expect(imported[0].gradeLabel).toBe("A")
    // 確定値は「その成績の対象者」にぶら下がる。人へは1段辿って確認する
    const importedGradeStudent = await prisma.gradeStudent.findUniqueOrThrow({
      where: { id: imported[0].gradeStudentId },
    })
    expect(importedGradeStudent.studentId).toBe(student.id)
    expect(new Date(imported[0].frozenAt).toISOString()).toBe(
      "2026-07-20T09:00:00.000Z"
    )
    // 確定操作者の居ない確定値は、取り込み先でも不明のまま
    expect(imported[0].frozenByUserId).toBeNull()
  })

  it("同名の評価項目があっても uuid 照合で取り違えない (v1.10.0)", async () => {
    // 評価項目名は unique ではない（GradeItem に (gradeId, name) 制約が無い）。
    // 名前だけで照合すると、境界・上書き・確定値が別の同名項目へ付いてしまう。
    // 固定ファイル: 成績「成績_同名」に同じ名前「評定」の評価項目を2つ（order 0, 1）。
    // 確定値・上書き「4」・境界「3」(50%) はすべて2つ目に付けて書き出した
    const archive = await readLegacyGradeArchive(
      "grade-duplicate-item-names.grade"
    )
    const secondItem = archive.gradeItems.find(
      (gradeItem) => gradeItem.order === 1
    )!
    // 参照は uuid を持ち出している
    expect(archive.gradeFrozenScores[0].gradeItemId).toBe(secondItem.id)
    await seedRosterFromArchive(archive)

    const result = await importGradeArchive(archive)

    // 取り込み先でも「2つ目」の評価項目に付いていること（1つ目へ寄らない）
    const importedItems = await prisma.gradeItem.findMany({
      where: { gradeId: result.gradeId! },
      orderBy: { order: "asc" },
    })
    expect(importedItems).toHaveLength(2)
    const importedSecondId = importedItems[1].id

    const frozen = await prisma.gradeFrozenScore.findMany({
      where: { gradeStudent: { gradeId: result.gradeId! } },
    })
    expect(frozen).toHaveLength(1)
    expect(frozen[0].gradeItemId).toBe(importedSecondId)

    const overrides = await prisma.gradeOverride.findMany({
      where: { gradeStudent: { gradeId: result.gradeId! } },
    })
    expect(overrides).toHaveLength(1)
    expect(overrides[0].gradeItemId).toBe(importedSecondId)

    const boundaries = await prisma.gradeItemBoundary.findMany({
      where: { gradeItem: { gradeId: result.gradeId! } },
    })
    expect(boundaries).toHaveLength(1)
    expect(boundaries[0].gradeItemId).toBe(importedSecondId)
  })

  it("uuid を持たない旧アーカイブで同名項目があれば、取り違えず警告して落とす", async () => {
    // 固定ファイル: 成績「成績_旧同名」の対象者1名（SL001）と、同じ名前「評定」の
    // 評価項目2つ（セルは無い）
    const archive = await readLegacyGradeArchive(
      "grade-duplicate-item-names-roster-only.grade"
    )
    // 旧形式は生徒を学籍番号で引くので、生徒はこの DB に既にある
    await seedRosterFromArchive(archive)

    const legacy = toLegacyArchive(archive)
    // uuid を持たない v1.9.0 以前のアーカイブを再現する
    legacy.gradeData.gradeItems = legacy.gradeData.gradeItems.map(
      (gradeItem) => ({ ...gradeItem, id: undefined })
    )
    legacy.gradeData.gradeOverrides = [
      {
        studentNumber: archive.studentsData[0].studentNumber,
        gradeItemName: "評定",
        overrideLabel: "4",
      },
    ]

    const result = await importGradeArchive(legacy)

    // どちらの項目か決められないので取り込まず、その旨を警告する
    const overrides = await prisma.gradeOverride.findMany({
      where: { gradeStudent: { gradeId: result.gradeId! } },
    })
    expect(overrides).toHaveLength(0)
    expect(
      result.warnings?.some((warning) => warning.includes("同名の評価項目"))
    ).toBe(true)
  })

  it("学籍番号・学級名・試験名が変わっても uuid で照合できる (v1.10.0)", async () => {
    // uuid 一次照合の核。名前や学籍番号は取り込み先で変わりうる（改姓・学級名変更・
    // 試験名の付け替え）が、同一PC由来なら uuid で確実に当たる。
    // 固定ファイル: 学級「旧学級」・生徒「OLD001」（その学級に在籍）・試験「旧試験」を参照する
    // 成績「成績_参照」。名簿の並びは3、データソースは旧試験の合計点
    const archive = await readLegacyGradeArchive("grade-external-refs.grade")
    const classroom = archive.classesData[0]
    const student = archive.studentsData[0]
    const [examRef] = archive.examRefs
    expect(archive.gradeStudents[0].studentId).toBe(student.id)
    expect(archive.gradeClassrooms[0].classroomId).toBe(classroom.id)
    expect(archive.gradeDataSources[0].examId).toBe(examRef.id)

    // 書き出したパソコンを模す: 生徒・学級・試験はこの DB に既にある
    await seedRosterFromArchive(archive)
    await prisma.exam.create({
      data: { id: examRef.id, examName: examRef.examName },
    })

    // 取り込み前に名前・学籍番号をすべて変える（名前照合なら全滅する状況）
    await prisma.student.update({
      where: { id: student.id },
      data: { studentNumber: "NEW001", lastName: "変更後" },
    })
    await prisma.classroom.update({
      where: { id: classroom.id },
      data: { name: "新学級" },
    })
    await prisma.exam.update({
      where: { id: examRef.id },
      data: { examName: "新試験" },
    })

    const result = await importGradeArchive(archive)

    // 学級・生徒・試験すべてが uuid で解決されている
    const importedClassrooms = await prisma.gradeClassroom.findMany({
      where: { gradeId: result.gradeId! },
    })
    expect(importedClassrooms).toHaveLength(1)
    expect(importedClassrooms[0].classroomId).toBe(classroom.id)

    const importedStudents = await prisma.gradeStudent.findMany({
      where: { gradeId: result.gradeId! },
    })
    expect(importedStudents).toHaveLength(1)
    expect(importedStudents[0].studentId).toBe(student.id)
    expect(importedStudents[0].customOrder).toBe(3)

    const importedDataSources = await prisma.gradeDataSource.findMany({
      where: { gradeItem: { gradeId: result.gradeId! } },
    })
    expect(importedDataSources).toHaveLength(1)
    expect(importedDataSources[0].examId).toBe(examRef.id)
  })

  it("uuid を持たない旧アーカイブは従来どおり学籍番号・名前で照合する", async () => {
    // 固定ファイル: 学級「学級L」と生徒「LG001」（学級所属なし）を名簿に持つ成績「成績_名簿」
    const archive = await readLegacyGradeArchive("grade-roster-classroom.grade")
    await seedRosterFromArchive(archive)

    const legacy = toLegacyArchive(archive)
    // v1.9.0 以前を再現: 外部参照から uuid を落とす
    legacy.gradeData.studentRefs = legacy.gradeData.studentRefs.map(
      (studentRef) => ({ ...studentRef, id: undefined })
    )
    legacy.gradeData.classroomRefs = legacy.gradeData.classroomRefs.map(
      (classroomRef) => ({ ...classroomRef, id: undefined })
    )

    const result = await importGradeArchive(legacy)

    const importedStudents = await prisma.gradeStudent.findMany({
      where: { gradeId: result.gradeId! },
    })
    expect(importedStudents).toHaveLength(1)
    expect(importedStudents[0].studentId).toBe(archive.studentsData[0].id)
    const importedClassrooms = await prisma.gradeClassroom.findMany({
      where: { gradeId: result.gradeId! },
    })
    expect(importedClassrooms).toHaveLength(1)
    expect(importedClassrooms[0].classroomId).toBe(archive.classesData[0].id)
  })

  it("同名の小計が別試験にあっても、参照先の試験の小計に紐づく (v1.10.0)", async () => {
    // 旧実装は subtotal.findMany({ where: { name } }) と試験で絞らずに検索し
    // 先頭を採っていたため、別試験の同名小計に紐づきうる状態だった。
    // 固定ファイル: 試験「対象試験」の小計「大問1」を参照するデータソース1つを持つ成績「成績_小計」
    const archive = await readLegacyGradeArchive("grade-subtotal-source.grade")
    const [examRef] = archive.examRefs
    const [subtotalRef] = archive.subtotalRefs
    expect(archive.gradeDataSources[0].subtotalId).toBe(subtotalRef.id)

    // どちらの試験にも同じ名前の小計を持つグループを付ける
    const makeSubtotal = async (
      exam: { id?: string; examName: string },
      groupName: string,
      subtotalId?: string
    ) => {
      const createdExam = await prisma.exam.create({ data: exam })
      const group = await prisma.subtotalGroup.create({
        data: { name: groupName },
      })
      await prisma.examSubtotalGroup.create({
        data: {
          examId: createdExam.id,
          subtotalGroupId: group.id,
        },
      })
      return prisma.subtotal.create({
        data: {
          id: subtotalId,
          subtotalGroupId: group.id,
          name: subtotalRef.name,
          order: 0,
        },
      })
    }
    // 無関係な試験の小計を先に作る（先頭採用なら誤ってこちらに当たる）
    const otherSubtotal = await makeSubtotal(
      { examName: "無関係試験" },
      "他グループ"
    )
    // 参照先の試験と小計は、書き出したパソコンと同じ id で作る
    const targetSubtotal = await makeSubtotal(
      { id: examRef.id, examName: examRef.examName },
      "対象グループ",
      subtotalRef.id
    )

    // uuid あり: 一次照合で対象の小計に当たる
    const withUuid = await importGradeArchive(archive)
    const uuidSources = await prisma.gradeDataSource.findMany({
      where: { gradeItem: { gradeId: withUuid.gradeId! } },
    })
    expect(uuidSources[0].subtotalId).toBe(targetSubtotal.id)

    // uuid なし（v1.9.0 以前）: 名前フォールバックでも試験で絞られ、
    // 無関係な試験の同名小計には当たらない
    const legacyArchive = toLegacyArchive(archive)
    legacyArchive.gradeData.gradeItems = legacyArchive.gradeData.gradeItems.map(
      (item) => ({
        ...item,
        dataSources: item.dataSources.map((dataSource) => ({
          ...dataSource,
          subtotalId: undefined,
        })),
      })
    )
    const legacy = await importGradeArchive(legacyArchive)
    const legacySources = await prisma.gradeDataSource.findMany({
      where: { gradeItem: { gradeId: legacy.gradeId! } },
    })
    expect(legacySources[0].subtotalId).toBe(targetSubtotal.id)
    expect(legacySources[0].subtotalId).not.toBe(otherSubtotal.id)
  })

  it("gradeFrozenScores が無いGradeも問題なく取り込める（後方互換）", async () => {
    // 固定ファイル: 名前「成績_空」だけの成績算出
    const archive = await readLegacyGradeArchive("grade-empty.grade")
    expect(archive.gradeFrozenScores).toHaveLength(0)

    const result = await importGradeArchive(archive)
    const imported = await prisma.gradeFrozenScore.findMany({
      where: { gradeStudent: { gradeId: result.gradeId! } },
    })
    expect(imported).toHaveLength(0)
  })

  it("アーカイブの名簿に無い対象者を指すセルは取り込まず警告する（#962 Phase C）", async () => {
    // セルは対象者（GradeStudent）を uuid で指す。その uuid が名簿セクションに
    // 無ければ、取り込み先で対象者を作れないのでセルも作ってはいけない
    // （作れてしまうと、どの画面にも出ない孤児が復活する）。
    // 固定ファイル: 評価項目「知識・技能」1つだけの成績「成績_孤児」（名簿は空）
    const archive = await readLegacyGradeArchive("grade-one-item.grade")
    expect(archive.gradeStudents).toHaveLength(0)

    const EPOCH = new Date(0).toISOString()
    // 名簿（gradeStudents）は空のまま、そこに載っていない対象者を指すセルを差し込む
    const cell = {
      gradeStudentId: "orphan-grade-student",
      gradeItemId: archive.gradeItems[0].id,
      createdAt: EPOCH,
      updatedAt: EPOCH,
    }
    archive.gradeOverrides = [{ id: "override-1", ...cell, overrideLabel: "A" }]
    archive.gradeFrozenScores = [
      {
        id: "frozen-1",
        ...cell,
        weightedScore: "0.8",
        weightedMaxScore: "1",
        percentage: "80",
        gradeLabel: "A",
        frozenByUserId: null,
        frozenAt: new Date("2026-07-20T09:00:00.000Z").toISOString(),
      },
    ]
    archive.gradeItemExclusions = [{ id: "exclusion-1", ...cell }]

    const result = await importGradeArchive(archive)

    const [overrides, frozenScores, itemExclusions] = await Promise.all([
      prisma.gradeOverride.count({
        where: { gradeStudent: { gradeId: result.gradeId! } },
      }),
      prisma.gradeFrozenScore.count({
        where: { gradeStudent: { gradeId: result.gradeId! } },
      }),
      prisma.gradeItemExclusion.count({
        where: { gradeStudent: { gradeId: result.gradeId! } },
      }),
    ])
    expect(overrides).toBe(0)
    expect(frozenScores).toBe(0)
    expect(itemExclusions).toBe(0)

    // 捨てたことは黙らずに伝える
    expect(
      result.warnings?.some((warning) =>
        warning.includes("上書き・確定値・除外設定 3件")
      )
    ).toBe(true)
  })

  it("取り込み先に居ない生徒・学級は作られ、学級所属も復元される (v1.13.0)", async () => {
    // 固定ファイル: 学級「新規学級」に出席番号7で在籍する生徒「SNEW001 新規 太郎」を名簿に持ち、
    // 評価項目「知識・技能」に上書き「A」を付けた成績「成績_新規」。
    // 取り込み先は空の DB（＝別PCへ持って行った状況）
    const archive = await readLegacyGradeArchive("grade-override.grade")

    const result = await importGradeArchive(archive)

    // 生徒・学級が作られ、学級所属（出席番号つき）まで戻る
    // 学籍番号は unique ではないので findFirst で引く（空の DB なので1件に決まる）
    const restoredStudent = await prisma.student.findFirstOrThrow({
      where: { studentNumber: "SNEW001" },
      include: { memberships: { include: { classroom: true } } },
    })
    expect(restoredStudent.lastName).toBe("新規")
    expect(restoredStudent.memberships).toHaveLength(1)
    expect(restoredStudent.memberships[0].classroom.name).toBe("新規学級")
    expect(restoredStudent.memberships[0].attendanceNumber).toBe(7)

    // 名簿と上書きも復元される（作られなければ両方落ちていた）
    const restoredOverrides = await prisma.gradeOverride.findMany({
      where: { gradeStudent: { gradeId: result.gradeId! } },
      include: { gradeStudent: true },
    })
    expect(restoredOverrides).toHaveLength(1)
    expect(restoredOverrides[0].gradeStudent.studentId).toBe(restoredStudent.id)
    expect(restoredOverrides[0].overrideLabel).toBe("A")
  })

  it("除外設定は取り込みで対象者・評価項目の対応を保つ (v1.13.0)", async () => {
    // 固定ファイル: 学級「行学級」に在籍する生徒「SROW001」を名簿に持ち、評価項目
    // 「知識・技能」の除外設定を1つ持つ成績「成績_除外」
    const archive = await readLegacyGradeArchive("grade-item-exclusion.grade")
    // 学級所属も carry されている（名簿の学級表示の裏付け）
    expect(archive.membershipsData).toHaveLength(1)
    await seedRosterFromArchive(archive)
    const student = archive.studentsData[0]

    const result = await importGradeArchive(archive)
    const importedExclusions = await prisma.gradeItemExclusion.findMany({
      where: { gradeStudent: { gradeId: result.gradeId! } },
      include: {
        gradeStudent: { include: { student: true } },
        gradeItem: true,
      },
    })
    expect(importedExclusions).toHaveLength(1)
    expect(importedExclusions[0].gradeStudent.student.id).toBe(student.id)
    expect(importedExclusions[0].gradeItem.name).toBe("知識・技能")
  })

  it("確定操作者は取り込み先に居れば残り、居なければ操作者不明になる (v1.13.0)", async () => {
    // 固定ファイル: 生徒「SFU001」の評価項目「知識・技能」に、利用者「teacher_frozen」が
    // 確定した確定値（80%・A）を持つ成績「成績_確定者」
    const archive = await readLegacyGradeArchive("grade-frozen-by-user.grade")
    const frozenByUserId = archive.gradeFrozenScores[0].frozenByUserId!
    expect(frozenByUserId).toBeTruthy()
    await seedRosterFromArchive(archive)
    // 書き出したパソコンを模す: 確定した利用者はこの DB に居る
    await prisma.user.create({
      data: {
        id: frozenByUserId,
        username: "teacher_frozen",
        name: "採点 教員",
      },
    })

    const kept = await importGradeArchive(archive)
    expect(
      (
        await prisma.gradeFrozenScore.findFirstOrThrow({
          where: { gradeStudent: { gradeId: kept.gradeId! } },
        })
      ).frozenByUserId
    ).toBe(frozenByUserId)

    // 取り込み先に居ない操作者は null（値そのものは残す）
    archive.gradeFrozenScores[0].frozenByUserId = "missing-user"
    const dropped = await importGradeArchive(archive)
    const restored = await prisma.gradeFrozenScore.findFirstOrThrow({
      where: { gradeStudent: { gradeId: dropped.gradeId! } },
    })
    expect(restored.frozenByUserId).toBeNull()
    expect(Number(restored.percentage)).toBe(80)
  })

  it("既存生徒の学級所属は書き換えない（異動先を旧学級で上書きしない）", async () => {
    // 固定ファイル: 学級「異動前の学級」に在籍する生徒「SMOVE001」を名簿に持つ成績「成績_異動」。
    // 学級所属（異動前の学級）も carry されている
    const archive = await readLegacyGradeArchive(
      "grade-classroom-membership.grade"
    )
    expect(archive.membershipsData).toHaveLength(1)
    const student = archive.studentsData[0]

    // 取り込み先では生徒も学級もあるが、生徒は別学級へ異動済み、という状況を作る
    await prisma.student.createMany({ data: archive.studentsData })
    await prisma.classroom.createMany({ data: archive.classesData })
    const newClassroom = await prisma.classroom.create({
      data: { name: "新学級" },
    })
    await prisma.studentClassroomMembership.create({
      data: { studentId: student.id, classroomId: newClassroom.id },
    })

    await importGradeArchive(archive)

    // 既存生徒なので学級所属は触らない。旧学級の在籍が復活してはいけない
    const memberships = await prisma.studentClassroomMembership.findMany({
      where: { studentId: student.id },
      include: { classroom: true },
    })
    expect(memberships).toHaveLength(1)
    expect(memberships[0].classroom.name).toBe("新学級")
  })

  it("アーカイブの別々の生徒が同じ既存生徒へ一致しても取り込みは失敗しない", async () => {
    // 固定ファイル: 生徒「SDUP001」1名だけを名簿に持つ成績「成績_一人」
    const archive = await readLegacyGradeArchive("grade-one-student.grade")
    await seedRosterFromArchive(archive)

    const EPOCH = new Date(0).toISOString()
    // uuid は違うが学籍番号が同じ、という2人目を差し込む（学籍番号の振り直しで起こる）
    archive.studentsData.push({
      ...archive.studentsData[0],
      id: "other-uuid",
    })
    archive.gradeStudents.push({
      id: "other-grade-student",
      gradeId: archive.grades[0].id,
      studentId: "other-uuid",
      customOrder: 1,
      createdAt: EPOCH,
      updatedAt: EPOCH,
    })

    const result = await importGradeArchive(archive)

    // unique 違反で全体がロールバックせず、1名にまとめたことを伝える
    expect(
      await prisma.gradeStudent.count({
        where: { gradeId: result.gradeId! },
      })
    ).toBe(1)
    expect(
      result.warnings?.some((warning) => warning.includes("1名にまとめました"))
    ).toBe(true)
  })

  it("旧アーカイブから作る学級の id は uuid になる（合成idを主キーにしない）", async () => {
    // 固定ファイル: 名前「成績_空」だけの成績算出
    const legacy = toLegacyArchive(
      await readLegacyGradeArchive("grade-empty.grade")
    )
    // v1.10.0 未満を再現: 学級参照から uuid を落とす
    legacy.gradeData.classroomRefs = [{ name: "合成id学級" }]

    await importGradeArchive(legacy)

    // 学級名は unique ではないので findFirst で引く（空の DB なので1件に決まる）
    const created = await prisma.classroom.findFirstOrThrow({
      where: { name: "合成id学級" },
    })
    expect(created.id).not.toContain("legacy-classroom:")
    expect(created.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    )
  })

  it("gradeConstraints が無いGradeも問題なく取り込める（後方互換）", async () => {
    // 固定ファイル: 名前「成績_空」だけの成績算出
    const archive = await readLegacyGradeArchive("grade-empty.grade")
    expect(archive.gradeConstraints).toHaveLength(0)

    const result = await importGradeArchive(archive)
    const imported = await prisma.gradeConstraint.findMany({
      where: { gradeId: result.gradeId! },
    })
    expect(imported).toHaveLength(0)
  })

  it("旧 v1.4.0（名前ベース courseworks 埋め込み）を後方互換で読み込める", async () => {
    const suffix = Date.now()
    // 旧形式は生徒・学級を既存前提で名前 lookup する
    const student = await prisma.student.create({
      data: {
        studentNumber: `LEGACY_${suffix}`,
        lastName: "高橋",
        firstName: "次郎",
        lastNameKana: "タカハシ",
        firstNameKana: "ジロウ",
      },
    })
    await prisma.classroom.create({ data: { name: `旧学級_${suffix}` } })

    const archiveItemId = "00000000-0000-4000-8000-000000000abc"
    // v1.4.0 形式の GradeArchiveData を手組み（courseworks は名前ベース配列）
    const legacy: LegacyGradeArchiveData = {
      manifest: {
        version: "1.4.0",
        appVersion: "test",
        exportedAt: new Date("2026-06-23T00:00:00.000Z").toISOString(),
        gradeId: "legacy-grade",
        gradeName: `旧成績_${suffix}`,
        counts: {
          gradeItems: 1,
          dataSources: 1,
          manualScores: 1,
          boundaries: 0,
          classrooms: 1,
          students: 1,
        },
      },
      gradeData: {
        grade: { name: `旧成績_${suffix}`, description: null },
        gradeItems: [
          {
            name: "主体的態度",
            order: 0,
            dataSources: [
              {
                type: "coursework",
                name: "旧資料参照",
                maxScore: 100,
                weight: 100,
                order: 0,
                examName: null,
                subtotalName: null,
                cropRegionLabel: null,
                courseworkItemId: archiveItemId,
                courseworkName: `旧レポート_${suffix}`,
                courseworkItemName: "提出物",
              },
            ],
          },
        ],
        classroomRefs: [{ name: `旧学級_${suffix}` }],
        examRefs: [],
        studentRefs: [
          {
            studentNumber: `LEGACY_${suffix}`,
            classroomName: `旧学級_${suffix}`,
            customOrder: 0,
          },
        ],
      },
      courseworks: [
        {
          id: "00000000-0000-4000-8000-0000000000cw",
          name: `旧レポート_${suffix}`,
          description: null,
          date: null,
          classrooms: [{ classroomName: `旧学級_${suffix}`, order: 0 }],
          tags: [],
          students: [{ studentNumber: `LEGACY_${suffix}`, customOrder: 0 }],
          items: [
            {
              id: archiveItemId,
              name: "提出物",
              order: 0,
              maxScore: 100,
              inputMode: "numeric",
              letterScales: [],
              scores: [
                {
                  studentNumber: `LEGACY_${suffix}`,
                  score: 72,
                  letterValue: null,
                  adjustment: null,
                  adjustmentReason: null,
                  comment: "旧形式のコメント",
                },
              ],
            },
          ],
        },
      ],
      boundariesData: { boundarySets: [] },
    }

    const result = await importGradeArchive(legacy)

    // 旧形式でも Coursework と点数が復元され、DataSource が解決される
    const score = await prisma.courseworkScore.findFirst({
      where: { courseworkStudent: { studentId: student.id } },
      include: { item: { include: { coursework: true } } },
    })
    expect(score).not.toBeNull()
    expect(Number(score!.score)).toBe(72)
    expect(score!.item.coursework.name).toBe(`旧レポート_${suffix}`)

    const dataSource = await prisma.gradeDataSource.findFirst({
      where: { gradeItem: { gradeId: result.gradeId! }, name: "旧資料参照" },
      include: { courseworkItem: true },
    })
    expect(dataSource!.courseworkItem).not.toBeNull()
    expect(dataSource!.courseworkItem!.name).toBe("提出物")
  })
})
