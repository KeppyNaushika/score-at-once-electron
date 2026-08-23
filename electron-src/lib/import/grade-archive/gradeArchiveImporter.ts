/**
 * 成績算出アーカイブのインポート
 *
 * v1.13.0 の .grade はテーブルごとの平坦なセクションで、各行は Prisma の行そのまま。
 * 取り込みは「アーカイブ内の uuid → 取り込み先の実 id」の対応を作りながら行を写す。
 *
 * 外部参照（アーカイブに含まれない実体）の解決:
 *   生徒・学級 = uuid 一次 → 学籍番号 / 学級名 二次（full レコードを carry しているので効く）
 *   試験       = uuid 一次 → ユーザー指定のマッピング → 試験名
 *   小計・領域 = uuid 一次 → 当該試験内の名前・ラベル
 *   資料       = 内包する courseworkArchive の取り込み結果から解決
 *
 * 生徒・学級は uuid・名前のどちらでも当たらなければ**作る**（.exam / .coursework と同じ）。
 * 学級所属も復元するので、対象生徒と、その紐づけ先の学級が取り込み先に増える。
 * 学籍番号・学級名が既存と衝突する場合はサフィックスで退避する。
 * 試験・小計・採点領域はアーカイブに含まれないので作れない。解決できなかった参照は
 * その行ごと落とし、必ず warning で伝える。
 */

import type { Prisma } from "@prisma/client"

import type {
  ArchiveGradeExamRef,
  GradeArchiveImportOptions,
  GradeArchiveImportPreview,
} from "../../../../src/types/gradeArchive.types"
import { recordAuditLog } from "../../prisma/auditLog"
import prisma from "../../prisma/client"
import { writeConstraintConfig } from "../../prisma/gradeConstraint"
import { buildEstimationSourceRows } from "../../prisma/gradeDataSource"
import { importCourseworkData } from "../coursework-archive/dataCreator"
import {
  resolveClassrooms,
  resolveStudents,
  resolveTags,
  restoreMemberships,
} from "../coursework-archive/idRemapper"
import { transformGradeToLatest } from "../grade-transformers"
import type { AnyGradeArchiveData } from "../grade-transformers/types"
import {
  describeAmbiguity,
  describeClassroom,
  pickOldest,
} from "../humanKeyMatching"

/** アーカイブ内 uuid → 取り込み先の実 id */
type IdMap = Map<string, string>

/**
 * インポート前のプレビュー（照合結果）
 */
export async function previewGradeArchiveImport(
  rawData: AnyGradeArchiveData
): Promise<GradeArchiveImportPreview> {
  // 旧バージョンを現行（平坦なセクション）へ正規化してから照合する。
  // 変換で失われるデータの警告は取り込み前に見せる必要があるので捨てない。
  const { data, warnings } = transformGradeToLatest(rawData)
  const courseworkArchive = data.courseworkArchive

  // Classroom照合（uuid一次・学級名二次）。当たらなければ取り込みで新規作成される。
  // 学級名は unique ではないので、名前で引くと複数当たりうる。どれを採るかは
  // humanKeyMatching の決まり（いちばん古い行・数と相手を必ず伝える）に従う。
  // 取り込み本体（resolveClassrooms）と同じ選び方をしないと、プレビューで
  // 「見つかった」と出た学級が実際には別の学級へ結び付く。
  const classroomMatches: { found: boolean; name: string }[] = []
  for (const classroom of data.classesData) {
    const matchedById = await prisma.classroom.findUnique({
      where: { id: classroom.id },
    })
    if (matchedById) {
      classroomMatches.push({ found: true, name: classroom.name })
      continue
    }
    const matchedByName = await prisma.classroom.findMany({
      where: { name: classroom.name },
    })
    const chosen = pickOldest(matchedByName)
    if (chosen) {
      const ambiguity = describeAmbiguity(
        `学級名「${classroom.name}」`,
        matchedByName.length,
        describeClassroom(chosen)
      )
      if (ambiguity) warnings.push(ambiguity)
    }
    classroomMatches.push({ found: Boolean(chosen), name: classroom.name })
  }
  const classroomCreateCount = classroomMatches.filter(
    (classroomMatch) => !classroomMatch.found
  ).length

  // Exam照合（uuid一次・試験名二次）
  const examMatches = await Promise.all(
    data.examRefs.map(async (examRef) => {
      const byId = await prisma.exam.findUnique({
        where: { id: examRef.id },
      })
      const exams = byId
        ? [byId]
        : await prisma.exam.findMany({
            where: { examName: examRef.examName },
          })
      return {
        examName: examRef.examName,
        found: exams.length > 0,
        examId: exams[0]?.id ?? null,
      }
    })
  )

  // 埋め込み資料の照合候補
  const cwPreviewItems = courseworkArchive.courseworks.map((coursework) => ({
    id: coursework.id,
    name: coursework.name,
    itemCount: courseworkArchive.courseworkItems.filter(
      (item) => item.courseworkId === coursework.id
    ).length,
    studentCount: courseworkArchive.courseworkStudents.filter(
      (courseworkStudent) => courseworkStudent.courseworkId === coursework.id
    ).length,
  }))

  // Student照合（uuid一次・学籍番号二次）。import 本体と同じ順序で数えないと
  // 「見つかりません」の件数が実際の取り込み結果とずれる。
  const uniqueStudentReferences = new Map<
    string,
    { id: string; studentNumber: string; hasName: boolean }
  >()
  for (const student of [
    ...courseworkArchive.studentsData,
    ...data.studentsData,
  ]) {
    // 学籍番号で名寄せする（同じ生徒が資料側と成績側の両方に現れる）。
    // 氏名を持つ側を優先して残す（旧 .grade の成績側は氏名を持たないが、
    // 内包資料側は持っているため、同じ生徒でも作成可否が変わる）
    const existing = uniqueStudentReferences.get(student.studentNumber)
    const hasName = Boolean(student.lastName || student.firstName)
    if (!existing || (!existing.hasName && hasName)) {
      uniqueStudentReferences.set(student.studentNumber, {
        id: student.id,
        studentNumber: student.studentNumber,
        hasName,
      })
    }
  }
  const existingStudents = await prisma.student.findMany({})
  const existingStudentIds = new Set(
    existingStudents.map((student) => student.id)
  )
  const existingNumberSet = new Set(
    existingStudents.map((student) => student.studentNumber)
  )
  const unmatchedStudents = [...uniqueStudentReferences.values()].filter(
    (studentReference) =>
      !existingStudentIds.has(studentReference.id) &&
      !existingNumberSet.has(studentReference.studentNumber)
  )
  // 既存に当たらなかった生徒は、氏名を持っていれば作成され、持っていなければ
  // 作れずに落ちる（旧アーカイブは氏名を持ち出していない）
  const studentCreateCount = unmatchedStudents.filter(
    (studentReference) => studentReference.hasName
  ).length
  const studentSkipCount = unmatchedStudents.length - studentCreateCount

  // 埋め込み資料のマッチング候補（uuid一次・名前二次）を算出
  const courseworkMatches = await Promise.all(
    cwPreviewItems.map(async (courseworkPreview) => {
      // uuid 完全一致（同一PC由来）
      const uuidMatch = await prisma.coursework.findUnique({
        where: { id: courseworkPreview.id },
      })
      // 名前一致候補（名前は非ユニークなので複数あり得る。uuid一致は除外）
      const nameCandidates = (
        await prisma.coursework.findMany({
          where: { name: courseworkPreview.name },
        })
      ).filter((coursework) => coursework.id !== uuidMatch?.id)
      return {
        archiveId: courseworkPreview.id,
        name: courseworkPreview.name,
        itemCount: courseworkPreview.itemCount,
        studentCount: courseworkPreview.studentCount,
        uuidMatch: uuidMatch ?? null,
        nameCandidates,
      }
    })
  )

  return {
    manifest: data.manifest,
    classroomMatches,
    classroomCreateCount,
    examMatches,
    studentMatchCount: uniqueStudentReferences.size - unmatchedStudents.length,
    studentCreateCount,
    studentSkipCount,
    courseworkMatches,
    warnings,
  }
}

/**
 * 参照している試験を uuid 一次・マッピング・試験名の順で解決する。
 * 解決できなければマップに入れない（そのデータソースは参照なしで取り込む）。
 */
async function resolveExams(
  tx: Prisma.TransactionClient,
  examRefs: ArchiveGradeExamRef[],
  examMapping: Record<string, string> | undefined,
  warnings: string[]
): Promise<IdMap> {
  const map: IdMap = new Map()
  for (const examRef of examRefs) {
    const byId = await tx.exam.findUnique({
      where: { id: examRef.id },
    })
    if (byId) {
      map.set(examRef.id, byId.id)
      continue
    }
    const mapped = examMapping?.[examRef.examName]
    if (mapped) {
      map.set(examRef.id, mapped)
      continue
    }
    // 試験名は unique でないため、同名が複数あれば取り違えうる。
    // ユーザーがウィザードで指定していない場合の最後の手段として先頭を採る
    const byName = await tx.exam.findFirst({
      where: { examName: examRef.examName },
    })
    if (byName) {
      map.set(examRef.id, byName.id)
      continue
    }
    warnings.push(
      `試験「${examRef.examName}」が見つからないため、参照しているデータソースの試験参照を外しました`
    )
  }
  return map
}

/**
 * 実際のインポート実行
 */
export async function importGradeArchive(
  rawData: AnyGradeArchiveData,
  options: GradeArchiveImportOptions = {}
): Promise<{
  gradeId: string
  /** 取り込み時の警告（点数スキップ・参照先未検出など） */
  warnings: string[]
}> {
  const { examMapping, courseworkDecisions = {} } = options
  // 旧バージョン（1.3.0 manual / 1.4.0 名前ベース / 1.12.0 射影形式）を現行へ正規化
  const { data, warnings: transformWarnings } = transformGradeToLatest(rawData)
  const warnings: string[] = [...transformWarnings]

  const archiveGrade = data.grades[0]
  if (!archiveGrade) {
    throw new Error("アーカイブに成績が含まれていません")
  }

  const result = await prisma.$transaction(
    async (tx: Prisma.TransactionClient) => {
      // ── 1. 内包する試験外成績資料の復元（coursework モジュールへ委譲） ──
      // 成績の生徒解決より先に走らせる。旧 .grade は生徒の氏名を持たないため
      // 成績側だけでは生徒を作れないが、内包資料は氏名を持っている。先に資料を
      // 取り込んでおけば、成績側は作られた生徒へ学籍番号で当たれる
      // （逆順だと、生徒は DB に居るのに成績の名簿だけ空という結果になる）。
      // 単体の .coursework と同じく未一致は作る。ここだけ lookup のみにすると、
      // 同じ資料が単体では点数まで復元されるのに .grade 経由だと空になる
      const courseworkResult = await importCourseworkData(
        tx,
        data.courseworkArchive,
        {
          allowCreate: true,
          studentMatching: "studentNumber",
          courseworkDecisions,
        }
      )
      warnings.push(...courseworkResult.warnings)

      // ── 2. 外部参照の解決 ──────────────────────────────────
      // 生徒・学級は uuid 一次 → 学籍番号 / 学級名 二次で既存を探し、
      // どちらにも当たらなければ作る（.exam / .coursework と同じ挙動）。
      const studentResolution = await resolveStudents(tx, data.studentsData, {
        method: "studentNumber",
        allowCreate: true,
      })
      warnings.push(...studentResolution.warnings)
      const classroomResolution = await resolveClassrooms(
        tx,
        data.classesData,
        { allowCreate: true }
      )
      warnings.push(...classroomResolution.warnings)
      // 学級所属を戻すのは「この取り込みで新規作成した生徒」だけ。既存生徒にも
      // 適用すると、取り込み先で別学級へ異動済みの生徒に旧学級の在籍行が復活し、
      // 取り込みと無関係な試験の学級別集計・受験日スナップショットまで変わる
      await restoreMemberships(
        tx,
        data.membershipsData,
        studentResolution.map,
        classroomResolution.map,
        studentResolution.createdIds
      )
      const examIdMap = await resolveExams(
        tx,
        data.examRefs,
        examMapping,
        warnings
      )

      // 小計・採点領域は uuid 一次、当該試験内の名前・ラベル二次。
      // 名前は試験の中でも一意ではない（小計名の `@@unique` は 2026-08-23 に外した）ので、
      // 名前で当たったのが複数なら、いちばん古い行を採って件数を伝える
      const subtotalIdMap: IdMap = new Map()
      for (const subtotalRef of data.subtotalRefs) {
        const byId = await tx.subtotal.findUnique({
          where: { id: subtotalRef.id },
        })
        if (byId) {
          subtotalIdMap.set(subtotalRef.id, byId.id)
          continue
        }
        const examId = examIdMap.get(subtotalRef.examId)
        if (!examId) continue
        const sameNameSubtotals = await tx.subtotal.findMany({
          where: {
            name: subtotalRef.name,
            subtotalGroup: { examSubtotalGroups: { some: { examId } } },
          },
        })
        const byName = pickOldest(sameNameSubtotals)
        if (!byName) continue
        subtotalIdMap.set(subtotalRef.id, byName.id)
        const ambiguity = describeAmbiguity(
          `小計「${subtotalRef.name}」`,
          sameNameSubtotals.length,
          `作成 ${byName.createdAt.toISOString().slice(0, 10)}`
        )
        if (ambiguity) warnings.push(ambiguity)
      }

      const cropRegionIdMap: IdMap = new Map()
      for (const cropRegionRef of data.cropRegionRefs) {
        const byId = await tx.cropRegion.findUnique({
          where: { id: cropRegionRef.id },
        })
        if (byId) {
          cropRegionIdMap.set(cropRegionRef.id, byId.id)
          continue
        }
        const examId = examIdMap.get(cropRegionRef.examId)
        if (!examId) continue
        const byLabel = await tx.cropRegion.findFirst({
          where: { label: cropRegionRef.label, examPage: { examId } },
        })
        if (byLabel) cropRegionIdMap.set(cropRegionRef.id, byLabel.id)
      }

      // 資料そのものの参照（coursework_total 型）は資料を直接引いて解決する。
      // 評価項目経由でしか作らないと、評価項目が0件の資料への参照が
      // 取り込み先に実在していても解決できず「参照なし」で作られてしまう。
      const courseworkItemIdMap = courseworkResult.itemIdMap
      /** アーカイブ資料uuid → 実 Coursework.id（coursework_total 型の参照解決用） */
      const courseworkIdMap: IdMap = new Map()
      for (const archiveCoursework of data.courseworkArchive.courseworks) {
        const byId = await tx.coursework.findUnique({
          where: { id: archiveCoursework.id },
        })
        if (byId) {
          courseworkIdMap.set(archiveCoursework.id, byId.id)
          continue
        }
        const byName = await tx.coursework.findFirst({
          where: { name: archiveCoursework.name },
        })
        if (byName) courseworkIdMap.set(archiveCoursework.id, byName.id)
      }
      // 評価項目から親を辿れるものは、そちらの結果を優先する
      // （ユーザーがウィザードで別の資料へ寄せた場合に追従する）
      for (const [archiveItemId, actualItemId] of courseworkItemIdMap) {
        const archiveItem = data.courseworkArchive.courseworkItems.find(
          (item) => item.id === archiveItemId
        )
        if (!archiveItem) continue
        const actualItem = await tx.courseworkItem.findUnique({
          where: { id: actualItemId },
        })
        if (actualItem) {
          courseworkIdMap.set(archiveItem.courseworkId, actualItem.courseworkId)
        }
      }

      // ── 3. 成績本体を写す（アーカイブ uuid → 新 id の対応を作りながら） ──
      const grade = await tx.grade.create({
        data: {
          name: archiveGrade.name,
          description: archiveGrade.description,
          referenceDate: archiveGrade.referenceDate
            ? new Date(archiveGrade.referenceDate)
            : null,
        },
      })

      for (const reportSettings of data.gradeIndividualReportSettings) {
        const {
          id: _id,
          gradeId: _gradeId,
          createdAt: _createdAt,
          updatedAt: _updatedAt,
          ...values
        } = reportSettings
        await tx.gradeIndividualReportSettings.create({
          data: { gradeId: grade.id, ...values },
        })
      }

      // タグは成績の外にある共有物なので、既存を uuid → 名前で当て、無ければ作る
      // （資料アーカイブと同じ resolveTags を使う）。中間テーブルは常に新規作成した
      // 成績に対して作るので、@@unique(gradeId, tagId) の衝突は起きない
      const tagMap = await resolveTags(tx, data.tagsData)
      for (const gradeTag of data.gradeTags) {
        const tagId = tagMap.get(gradeTag.tagId)
        if (!tagId) continue
        await tx.gradeTag.create({ data: { gradeId: grade.id, tagId } })
      }

      for (const gradeClassroom of data.gradeClassrooms) {
        const classroomId = classroomResolution.map.get(
          gradeClassroom.classroomId
        )
        if (!classroomId) continue
        await tx.gradeClassroom.create({
          data: {
            gradeId: grade.id,
            classroomId,
            order: gradeClassroom.order,
          },
        })
      }

      const gradeStudentIdMap: IdMap = new Map()
      // アーカイブの別々の生徒が取り込み先の同じ生徒へ解決することがある
      // （片方が uuid で、もう片方が学籍番号で当たる場合）。@@unique(gradeId, studentId)
      // があるので素直に作ると2回目で落ちて取り込み全体がロールバックする。
      // 先に作った対象者へ寄せ、寄せたことを伝える
      const gradeStudentIdByStudentId = new Map<string, string>()
      let mergedGradeStudents = 0
      for (const archiveGradeStudent of data.gradeStudents) {
        const studentId = studentResolution.map.get(
          archiveGradeStudent.studentId
        )
        if (!studentId) continue
        const alreadyCreated = gradeStudentIdByStudentId.get(studentId)
        if (alreadyCreated) {
          gradeStudentIdMap.set(archiveGradeStudent.id, alreadyCreated)
          mergedGradeStudents++
          continue
        }
        const created = await tx.gradeStudent.create({
          data: {
            gradeId: grade.id,
            studentId,
            customOrder: archiveGradeStudent.customOrder,
          },
        })
        gradeStudentIdMap.set(archiveGradeStudent.id, created.id)
        gradeStudentIdByStudentId.set(studentId, created.id)
      }
      if (mergedGradeStudents > 0) {
        warnings.push(
          `アーカイブの対象生徒${mergedGradeStudents}名が取り込み先の同じ生徒に一致したため、1名にまとめました`
        )
      }

      const gradeItemIdMap: IdMap = new Map()
      for (const archiveGradeItem of data.gradeItems) {
        const created = await tx.gradeItem.create({
          data: {
            gradeId: grade.id,
            name: archiveGradeItem.name,
            order: archiveGradeItem.order,
          },
        })
        gradeItemIdMap.set(archiveGradeItem.id, created.id)
      }

      const dataSourceIdMap: IdMap = new Map()
      for (const archiveDataSource of data.gradeDataSources) {
        const gradeItemId = gradeItemIdMap.get(archiveDataSource.gradeItemId)
        if (!gradeItemId) continue
        const created = await tx.gradeDataSource.create({
          data: {
            gradeItemId,
            type: archiveDataSource.type,
            examId: archiveDataSource.examId
              ? (examIdMap.get(archiveDataSource.examId) ?? null)
              : null,
            subtotalId: archiveDataSource.subtotalId
              ? (subtotalIdMap.get(archiveDataSource.subtotalId) ?? null)
              : null,
            cropRegionId: archiveDataSource.cropRegionId
              ? (cropRegionIdMap.get(archiveDataSource.cropRegionId) ?? null)
              : null,
            courseworkItemId: archiveDataSource.courseworkItemId
              ? (courseworkItemIdMap.get(archiveDataSource.courseworkItemId) ??
                null)
              : null,
            courseworkId: archiveDataSource.courseworkId
              ? (courseworkIdMap.get(archiveDataSource.courseworkId) ?? null)
              : null,
            name: archiveDataSource.name,
            weight: archiveDataSource.weight,
            order: archiveDataSource.order,
            absentMethod: archiveDataSource.absentMethod,
            absentRatio: archiveDataSource.absentRatio,
            absentOffset: archiveDataSource.absentOffset,
            treatExpectedAsMissing: archiveDataSource.treatExpectedAsMissing,
            estimationMode: archiveDataSource.estimationMode,
          },
        })
        dataSourceIdMap.set(archiveDataSource.id, created.id)
      }

      // 推定の参照は全データソース作成後に張る（同一成績内の前方参照があるため）
      const estimationSourceIdsByDataSource = new Map<string, string[]>()
      let droppedEstimationSources = 0
      for (const estimationSource of data.gradeDataSourceEstimationSources) {
        const dataSourceId = dataSourceIdMap.get(estimationSource.dataSourceId)
        const sourceDataSourceId = dataSourceIdMap.get(
          estimationSource.sourceDataSourceId
        )
        if (!dataSourceId || !sourceDataSourceId) {
          droppedEstimationSources++
          continue
        }
        const existing = estimationSourceIdsByDataSource.get(dataSourceId)
        if (existing) existing.push(sourceDataSourceId)
        else
          estimationSourceIdsByDataSource.set(dataSourceId, [
            sourceDataSourceId,
          ])
      }
      if (droppedEstimationSources > 0) {
        warnings.push(
          `欠損推定の参照${droppedEstimationSources}件を解決できなかったため取り込みませんでした。` +
            `該当データソースの推定設定を確認してください。`
        )
      }
      for (const [
        dataSourceId,
        sourceDataSourceIds,
      ] of estimationSourceIdsByDataSource) {
        await tx.gradeDataSource.update({
          where: { id: dataSourceId },
          data: {
            estimationSources: {
              create: buildEstimationSourceRows(
                dataSourceId,
                sourceDataSourceIds
              ),
            },
          },
        })
      }

      // ── 4. 成績境界 ──────────────────────────────────────
      const boundaryRows = data.gradeItemBoundaries.flatMap(
        (archiveBoundary) => {
          const gradeItemId = gradeItemIdMap.get(archiveBoundary.gradeItemId)
          if (!gradeItemId) return []
          return [
            {
              gradeItemId,
              label: archiveBoundary.label,
              minPercentage: archiveBoundary.minPercentage,
              order: archiveBoundary.order,
            },
          ]
        }
      )
      if (boundaryRows.length > 0) {
        await tx.gradeItemBoundary.createMany({ data: boundaryRows })
      }

      // ── 5. セル3種 ──────────────────────────────────────
      // 名簿に載らなかった生徒（照合できなかった生徒）のセルは作らない。
      // 作れてしまうと、どの画面にも出ない孤児が復活する（#962）
      let droppedCells = 0
      const resolveCell = (archiveCell: {
        gradeStudentId: string
        gradeItemId: string
      }): { gradeStudentId: string; gradeItemId: string } | null => {
        const gradeStudentId = gradeStudentIdMap.get(archiveCell.gradeStudentId)
        const gradeItemId = gradeItemIdMap.get(archiveCell.gradeItemId)
        if (!gradeStudentId || !gradeItemId) {
          droppedCells++
          return null
        }
        return { gradeStudentId, gradeItemId }
      }

      for (const archiveOverride of data.gradeOverrides) {
        const cell = resolveCell(archiveOverride)
        if (!cell) continue
        await tx.gradeOverride.create({
          data: { ...cell, overrideLabel: archiveOverride.overrideLabel },
        })
      }

      for (const archiveFrozenScore of data.gradeFrozenScores) {
        const cell = resolveCell(archiveFrozenScore)
        if (!cell) continue
        // 確定操作者は取り込み先に同じ User が居る保証が無い。
        // 居なければ null（操作者不明）にして値そのものは残す
        const frozenByUserId = archiveFrozenScore.frozenByUserId
          ? ((
              await tx.user.findUnique({
                where: { id: archiveFrozenScore.frozenByUserId },
              })
            )?.id ?? null)
          : null
        await tx.gradeFrozenScore.create({
          data: {
            ...cell,
            weightedScore: archiveFrozenScore.weightedScore,
            weightedMaxScore: archiveFrozenScore.weightedMaxScore,
            percentage: archiveFrozenScore.percentage,
            gradeLabel: archiveFrozenScore.gradeLabel,
            frozenByUserId,
            frozenAt: new Date(archiveFrozenScore.frozenAt),
          },
        })
      }

      for (const archiveExclusion of data.gradeItemExclusions) {
        const cell = resolveCell(archiveExclusion)
        if (!cell) continue
        await tx.gradeItemExclusion.create({ data: cell })
      }

      if (droppedCells > 0) {
        warnings.push(
          `対象生徒または評価項目を解決できない上書き・確定値・除外設定 ${droppedCells}件を取り込みませんでした`
        )
      }

      // ── 6. 観点間の制約ルール ─────────────────────────────
      // 参照を1つでも失うと判定の意味が変わる（集計対象が減れば平均が動き、
      // 空になれば「比較先以外の全項目」という別の設定に化ける）。
      // 黙って別物として動かさず、無効化して再設定を促す。
      for (const archiveConstraint of data.gradeConstraints) {
        const targetGradeItemId = archiveConstraint.targetGradeItemId
          ? (gradeItemIdMap.get(archiveConstraint.targetGradeItemId) ?? null)
          : null
        const lostTarget =
          archiveConstraint.targetGradeItemId !== null &&
          targetGradeItemId === null

        const archiveViewpoints = data.gradeConstraintViewpoints
          .filter(
            (viewpoint) => viewpoint.constraintId === archiveConstraint.id
          )
          .sort((left, right) => left.order - right.order)
        const resolvedViewpointIds = archiveViewpoints.flatMap((viewpoint) => {
          const gradeItemId = gradeItemIdMap.get(viewpoint.gradeItemId)
          return gradeItemId ? [gradeItemId] : []
        })
        const lostViewpoint =
          resolvedViewpointIds.length !== archiveViewpoints.length

        const brokenReason = lostTarget
          ? "取り込み時に比較先の評価項目を解決できなかったため無効化しました。再設定してください。"
          : lostViewpoint
            ? "取り込み時に集計対象の観点を解決できなかったため無効化しました。再設定してください。"
            : archiveConstraint.disabledReason
        if (lostTarget || lostViewpoint) {
          warnings.push(
            `制約ルール「${archiveConstraint.name}」: ${brokenReason}`
          )
        }

        const createdConstraint = await tx.gradeConstraint.create({
          data: {
            gradeId: grade.id,
            name: archiveConstraint.name,
            kind: archiveConstraint.kind,
            targetGradeItemId,
            aggregate: archiveConstraint.aggregate,
            tolerance: archiveConstraint.tolerance,
            expression: archiveConstraint.expression,
            color: archiveConstraint.color,
            // 診断は disabledReason へ。message は教員が書いた違反の説明で、
            // 結果表のツールチップに出るため汚さない。
            message: archiveConstraint.message,
            disabledReason: brokenReason,
            enabled: archiveConstraint.enabled && !brokenReason,
            order: archiveConstraint.order,
          },
        })

        // 設定リレーションのidは親idから決定論的に作るため本体作成後に書く
        await writeConstraintConfig(tx, createdConstraint.id, {
          viewpointGradeItemIds: resolvedViewpointIds,
          labelValues: Object.fromEntries(
            data.gradeConstraintLabelValues
              .filter(
                (labelValue) => labelValue.constraintId === archiveConstraint.id
              )
              .sort((left, right) => left.order - right.order)
              // Decimal は文字列のまま渡す（tolerance と同じ扱い）。
              // number へ倒すと有効桁16桁を超える値が丸まる
              .map((labelValue) => [labelValue.label, labelValue.value])
          ),
          exclusionLabels: data.gradeConstraintExclusionLabels
            .filter(
              (exclusionLabel) =>
                exclusionLabel.constraintId === archiveConstraint.id
            )
            .sort((left, right) => left.order - right.order)
            .map((exclusionLabel) => exclusionLabel.label),
        })
      }

      return { gradeId: grade.id }
    }
  )

  if (warnings.length > 0) {
    console.warn("Grade archive import warnings:", warnings)
  }

  // 監査ログ: 成績インポート
  await recordAuditLog({
    action: "grade.import",
    entityType: "Grade",
    entityId: result.gradeId,
    scopeId: result.gradeId,
    scopeLabel: archiveGrade.name,
    target: archiveGrade.name,
  })

  // 警告は呼び出し側（UI）へ返して通知する
  return { ...result, warnings }
}
