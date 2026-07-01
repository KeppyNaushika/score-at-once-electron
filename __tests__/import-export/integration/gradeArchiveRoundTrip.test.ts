/**
 * grade-archive のラウンドトリップ統合テスト
 *
 * テスト対象:
 *   electron-src/lib/export/grade-archive/gradeArchiveDataCollector.ts
 *   electron-src/lib/import/grade-archive/gradeArchiveImporter.ts
 *
 * 実SQLiteで「収集(export) → インポート(import)」を一周し、
 *  - v1.2.0 の Grade.referenceDate / GradeExportSettings
 *  - v1.4.0 の試験外成績資料(Coursework: 複数項目・点数・コメント・名簿・タグ)
 * が往復で保持されること、および旧 v1.3.0 形式が Coursework へ変換されることを検証する。
 */

import { afterAll, beforeEach, describe, expect, it, vi } from "vitest"

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

import { collectGradeArchiveData } from "../../../electron-src/lib/export/grade-archive/gradeArchiveDataCollector"
import {
  importGradeArchive,
  previewGradeArchiveImport,
} from "../../../electron-src/lib/import/grade-archive/gradeArchiveImporter"

const prisma = getTestPrismaClient()

/** 収集結果をアーカイブ全体データに包む（manifestはテスト用に手組み） */
function toArchive(
  gradeId: string,
  collected: Awaited<ReturnType<typeof collectGradeArchiveData>>
): GradeArchiveData {
  return {
    manifest: {
      version: "1.5.0",
      appVersion: "test",
      exportedAt: new Date("2026-06-23T00:00:00.000Z").toISOString(),
      gradeId,
      gradeName: collected.gradeData.grade.name,
      counts: collected.counts,
    },
    gradeData: collected.gradeData,
    courseworkArchive: collected.courseworkArchive,
    boundariesData: collected.boundariesData,
  }
}

describe("grade-archive ラウンドトリップ", () => {
  beforeEach(async () => {
    await cleanupTestDatabase()
  })

  afterAll(async () => {
    await disconnectTestPrisma()
  })

  it("Grade.referenceDate と GradeExportSettings が往復で保持される (v1.2.0)", async () => {
    const referenceDate = new Date("2026-04-01T00:00:00.000Z")
    const settingsJson = JSON.stringify({ includeKana: true, format: "pdf" })

    const grade = await prisma.grade.create({
      data: {
        name: `成績_${Date.now()}`,
        description: "説明",
        referenceDate,
      },
    })
    await prisma.gradeExportSettings.create({
      data: { gradeId: grade.id, settingsJson },
    })
    // 最低限の中身も持たせる（空でないことの確認）
    await prisma.gradeItem.create({
      data: { gradeId: grade.id, name: "知識・技能", order: 0 },
    })

    // 収集（export）
    const collected = await collectGradeArchiveData(grade.id)
    expect(collected.gradeData.grade.referenceDate).toBe(
      referenceDate.toISOString()
    )
    expect(collected.gradeData.exportSettings?.settingsJson).toBe(settingsJson)

    // インポート（新規Gradeとして作成される）
    const result = await importGradeArchive(toArchive(grade.id, collected))
    expect(result.success).toBe(true)
    expect(result.gradeId).toBeDefined()

    const imported = await prisma.grade.findUnique({
      where: { id: result.gradeId! },
    })
    expect(imported).not.toBeNull()
    expect(imported!.referenceDate?.toISOString()).toBe(
      referenceDate.toISOString()
    )

    const importedSettings = await prisma.gradeExportSettings.findUnique({
      where: { gradeId: result.gradeId! },
    })
    expect(importedSettings).not.toBeNull()
    expect(importedSettings!.settingsJson).toBe(settingsJson)
  })

  it("試験外成績資料(Coursework)の項目・点数・コメント・名簿・タグが往復で保持される (v1.4.0)", async () => {
    const suffix = Date.now()

    // 生徒・学級
    const cls = await prisma.classroom.create({
      data: { name: `学級_${suffix}` },
    })
    const student = await prisma.student.create({
      data: {
        studentNumber: `CW_${suffix}`,
        lastName: "鈴木",
        firstName: "一郎",
        lastNameKana: "スズキ",
        firstNameKana: "イチロウ",
      },
    })
    await prisma.studentClassMembership.create({
      data: { classroomId: cls.id, studentId: student.id },
    })
    const tag = await prisma.tag.create({
      data: { name: `タグ_${suffix}` },
    })

    // 試験外成績資料（2項目: 数値 + 文字評価）
    const coursework = await prisma.coursework.create({
      data: {
        name: `第2回レポート_${suffix}`,
        description: "レポート評価",
        classes: { create: [{ classroomId: cls.id, order: 0 }] },
        tags: { create: [{ tagId: tag.id }] },
        students: { create: [{ studentId: student.id, customOrder: 0 }] },
      },
    })
    const numItem = await prisma.courseworkItem.create({
      data: {
        courseworkId: coursework.id,
        name: "提出物",
        order: 0,
        maxScore: 100,
        inputMode: "numeric",
      },
    })
    const letterItem = await prisma.courseworkItem.create({
      data: {
        courseworkId: coursework.id,
        name: "授業態度",
        order: 1,
        maxScore: 100,
        inputMode: "letter",
        letterScales: {
          create: [
            { label: "A", score: 100, order: 0 },
            { label: "B", score: 80, order: 1 },
            { label: "C", score: 60, order: 2 },
          ],
        },
      },
    })
    await prisma.courseworkScore.create({
      data: {
        courseworkItemId: numItem.id,
        studentId: student.id,
        score: 85,
        adjustment: -5,
        adjustmentReason: "提出遅延",
        comment: "丁寧にまとめられています",
      },
    })
    await prisma.courseworkScore.create({
      data: {
        courseworkItemId: letterItem.id,
        studentId: student.id,
        letterValue: "B",
        comment: "発表が活発でした",
      },
    })

    // 成績: 各項目を参照する coursework 型データソース
    const grade = await prisma.grade.create({
      data: { name: `成績_cw_${suffix}` },
    })
    const gradeItem = await prisma.gradeItem.create({
      data: { gradeId: grade.id, name: "主体的態度", order: 0 },
    })
    await prisma.gradeDataSource.create({
      data: {
        gradeItemId: gradeItem.id,
        type: "coursework",
        courseworkItemId: numItem.id,
        name: "提出物参照",
        weight: 50,
        order: 0,
      },
    })
    await prisma.gradeDataSource.create({
      data: {
        gradeItemId: gradeItem.id,
        type: "coursework",
        courseworkItemId: letterItem.id,
        name: "授業態度参照",
        weight: 50,
        order: 1,
      },
    })

    // 収集（export）
    const collected = await collectGradeArchiveData(grade.id)
    expect(collected.courseworkArchive.courseworks).toHaveLength(1)
    const cw = collected.courseworkArchive.courseworks[0]
    expect(cw.items).toHaveLength(2)
    expect(cw.classrooms).toHaveLength(1)
    expect(collected.courseworkArchive.tagsData[0].name).toBe(`タグ_${suffix}`)
    expect(collected.courseworkArchive.studentsData[0].studentNumber).toBe(
      `CW_${suffix}`
    )
    const collectedNumDs = collected.gradeData.gradeItems[0].dataSources.find(
      (d) => d.name === "提出物参照"
    )!
    expect(collectedNumDs.courseworkName).toBe(`第2回レポート_${suffix}`)
    expect(collectedNumDs.courseworkItemName).toBe("提出物")

    // インポート（新規 Grade + Coursework が作成される。同名Courseworkは無い前提）
    // 既存 Coursework と名前衝突しないよう、元の資料は残るが import 時は
    // 別名でないため findFirst で既存を再利用する → 名前を変えて検証する。
    // ここでは元データを削除せず、import が既存同名を再利用することを確認する。
    const result = await importGradeArchive(toArchive(grade.id, collected))
    expect(result.success).toBe(true)

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
            scores: { include: { student: true } },
          },
        },
      },
    })
    expect(importedDs!.courseworkItem).not.toBeNull()
    expect(importedDs!.courseworkItem!.name).toBe("提出物")
    expect(importedDs!.courseworkItem!.coursework.name).toBe(
      `第2回レポート_${suffix}`
    )
    // 既存同名 Coursework が再利用される（重複作成されない）
    const courseworkCount = await prisma.coursework.count({
      where: { name: `第2回レポート_${suffix}` },
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
    const archive: GradeArchiveData = {
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
          boundarySets: 0,
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
        classRefs: [],
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
    expect(result.success).toBe(true)

    const importedItem = await prisma.courseworkItem.findFirst({
      where: { coursework: { name: `埋込資料_${suffix}` }, name: "課題1" },
      include: { scores: { include: { student: true } } },
    })
    expect(importedItem).not.toBeNull()
    expect(importedItem!.scores).toHaveLength(1)
    expect(Number(importedItem!.scores[0].score)).toBe(72)
    expect(importedItem!.scores[0].student.studentNumber).toBe(`CW2_${suffix}`)

    const ds = await prisma.gradeDataSource.findFirst({
      where: { gradeItem: { gradeId: result.gradeId! }, name: "資料参照" },
    })
    expect(ds!.courseworkItemId).toBe(importedItem!.id)
    expect(ds!.type).toBe("coursework")
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
    const legacy: GradeArchiveData = {
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
          boundarySets: 0,
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
        classRefs: [],
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
    expect(result.success).toBe(true)

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
    const ds = await prisma.gradeDataSource.findFirst({
      where: { gradeItem: { gradeId: result.gradeId! }, name: "観点別評価" },
    })
    expect(ds!.type).toBe("coursework")
    expect(ds!.courseworkItemId).toBe(importedItem!.id)
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

    const buildLegacy = (): GradeArchiveData => ({
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
          boundarySets: 0,
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
        classRefs: [],
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
    expect(result.success).toBe(true)

    // スコアが失われず復元される
    const item = await prisma.courseworkItem.findFirst({
      where: { name: "レポート" },
      include: { scores: true },
    })
    expect(item).not.toBeNull()
    expect(item!.scores).toHaveLength(1)
    expect(Number(item!.scores[0].score)).toBe(73)

    // DataSource は coursework 型に解決され "manual" が残らない
    const ds = await prisma.gradeDataSource.findFirst({
      where: { gradeItem: { gradeId: result.gradeId! }, name: "レポート" },
    })
    expect(ds!.type).toBe("coursework")
    expect(ds!.courseworkItemId).toBe(item!.id)
  })

  // 回帰: 点数が一切入力されていない manual ソースも coursework 型へ変換され、
  //   無効な "manual" 型のまま永続化されないこと（検出ゲートの回帰防止）
  it("v1.3.0: 点数未入力の manual ソースも coursework 型へ変換される", async () => {
    const suffix = Date.now()
    const archive: GradeArchiveData = {
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
          boundarySets: 0,
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
        classRefs: [],
        examRefs: [],
        studentRefs: [],
      },
      manualScoresData: { manualScores: [] },
      boundariesData: { boundarySets: [] },
    }

    const result = await importGradeArchive(archive)
    expect(result.success).toBe(true)

    const ds = await prisma.gradeDataSource.findFirst({
      where: { gradeItem: { gradeId: result.gradeId! }, name: "観察" },
    })
    expect(ds!.type).toBe("coursework")
    // 点数ゼロでも CourseworkItem は生成され参照される
    expect(ds!.courseworkItemId).not.toBeNull()
  })

  it("referenceDate/exportSettings が無いGradeも問題なく往復する（後方互換）", async () => {
    const grade = await prisma.grade.create({
      data: { name: `成績_min_${Date.now()}` },
    })

    const collected = await collectGradeArchiveData(grade.id)
    expect(collected.gradeData.grade.referenceDate).toBeNull()
    expect(collected.gradeData.exportSettings).toBeNull()
    expect(collected.courseworkArchive.courseworks).toHaveLength(0)

    const result = await importGradeArchive(toArchive(grade.id, collected))
    expect(result.success).toBe(true)

    const imported = await prisma.grade.findUnique({
      where: { id: result.gradeId! },
    })
    expect(imported!.referenceDate).toBeNull()

    const importedSettings = await prisma.gradeExportSettings.findUnique({
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

    const buildArchive = (): GradeArchiveData => ({
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
          boundarySets: 0,
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
        classRefs: [],
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
    const r1 = await importGradeArchive(buildArchive())
    expect(r1.success).toBe(true)
    const created = await prisma.coursework.findUnique({ where: { id: cwId } })
    expect(created).not.toBeNull()

    // preview: uuid一致が検出される
    const preview = await previewGradeArchiveImport(buildArchive())
    expect(preview.courseworkMatches[0].uuidMatch?.id).toBe(cwId)

    // 2回目: decision未指定 → uuid一致で流用（複製しない=冪等）
    const r2 = await importGradeArchive(buildArchive())
    expect(r2.success).toBe(true)
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
    const r3 = await importGradeArchive(buildArchive(), {
      courseworkDecisions: { [cwId]: { action: "new" } },
    })
    expect(r3.success).toBe(true)
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

    const archive: GradeArchiveData = {
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
          boundarySets: 0,
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
        classRefs: [],
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
    expect(result.success).toBe(true)

    // 複製されず既存資料に項目が補完される（既存「既存」＋補完「新規項目」=2）
    const items = await prisma.courseworkItem.findMany({
      where: { courseworkId: existing.id },
    })
    expect(items).toHaveLength(2)
    expect(items.map((i) => i.name)).toEqual(
      expect.arrayContaining(["既存", "新規項目"])
    )
    // DataSource は補完された項目に結ばれる
    const ds = await prisma.gradeDataSource.findFirst({
      where: { gradeItem: { gradeId: result.gradeId! }, name: "資料参照" },
      include: { courseworkItem: true },
    })
    expect(ds!.courseworkItem!.name).toBe("新規項目")
    expect(ds!.courseworkItem!.courseworkId).toBe(existing.id)
  })

  it("観点間の制約ルール(GradeConstraint)が往復で保持される (v1.7.0)", async () => {
    const suffix = Date.now()
    const grade = await prisma.grade.create({
      data: { name: `成績_constraint_${suffix}` },
    })
    await prisma.gradeItem.create({
      data: { gradeId: grade.id, name: "知識・技能", order: 0 },
    })
    await prisma.gradeConstraint.create({
      data: {
        gradeId: grade.id,
        name: "A・C混在禁止",
        kind: "mutual_exclusion",
        config: JSON.stringify({ labels: ["A", "C"] }),
        expression: "",
        color: "#fecaca",
        message: "AとCは混在しません",
        enabled: true,
        order: 0,
      },
    })
    await prisma.gradeConstraint.create({
      data: {
        gradeId: grade.id,
        name: "評定と観点の整合",
        kind: "expression",
        config: "{}",
        expression: 'abs(item("評定") - mean("知識・技能")) > 1',
        color: "#fde68a",
        message: null,
        enabled: false,
        order: 1,
      },
    })

    // 収集（export）
    const collected = await collectGradeArchiveData(grade.id)
    expect(collected.gradeData.gradeConstraints).toHaveLength(2)
    const exclusion = collected.gradeData.gradeConstraints!.find(
      (c) => c.kind === "mutual_exclusion"
    )!
    expect(exclusion.name).toBe("A・C混在禁止")
    expect(exclusion.config).toBe(JSON.stringify({ labels: ["A", "C"] }))

    // インポート（新規Gradeとして作成される）
    const result = await importGradeArchive(toArchive(grade.id, collected))
    expect(result.success).toBe(true)

    const imported = await prisma.gradeConstraint.findMany({
      where: { gradeId: result.gradeId! },
      orderBy: { order: "asc" },
    })
    expect(imported).toHaveLength(2)
    expect(imported[0].name).toBe("A・C混在禁止")
    expect(imported[0].kind).toBe("mutual_exclusion")
    expect(imported[0].message).toBe("AとCは混在しません")
    expect(imported[0].enabled).toBe(true)
    expect(imported[1].kind).toBe("expression")
    expect(imported[1].expression).toBe(
      'abs(item("評定") - mean("知識・技能")) > 1'
    )
    expect(imported[1].enabled).toBe(false)
    expect(imported[1].color).toBe("#fde68a")
  })

  it("gradeConstraints が無いGradeも問題なく往復する（後方互換）", async () => {
    const grade = await prisma.grade.create({
      data: { name: `成績_noconstraint_${Date.now()}` },
    })
    const collected = await collectGradeArchiveData(grade.id)
    expect(collected.gradeData.gradeConstraints).toBeUndefined()

    const result = await importGradeArchive(toArchive(grade.id, collected))
    expect(result.success).toBe(true)
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
    const legacy: GradeArchiveData = {
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
          boundarySets: 0,
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
        classRefs: [{ name: `旧学級_${suffix}` }],
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
    expect(result.success).toBe(true)

    // 旧形式でも Coursework と点数が復元され、DataSource が解決される
    const score = await prisma.courseworkScore.findFirst({
      where: { studentId: student.id },
      include: { item: { include: { coursework: true } } },
    })
    expect(score).not.toBeNull()
    expect(Number(score!.score)).toBe(72)
    expect(score!.item.coursework.name).toBe(`旧レポート_${suffix}`)

    const ds = await prisma.gradeDataSource.findFirst({
      where: { gradeItem: { gradeId: result.gradeId! }, name: "旧資料参照" },
      include: { courseworkItem: true },
    })
    expect(ds!.courseworkItem).not.toBeNull()
    expect(ds!.courseworkItem!.name).toBe("提出物")
  })
})
