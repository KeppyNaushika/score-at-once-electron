/**
 * 成績算出の文脈（素点行列と、推定に必要な付随データ）を DB から組み立てる。
 *
 * **成績算出が DB を読むのはここだけ。** 問い合わせは `gradeCalculationReads` の口と
 * include だけを使う（成績算出のロックがそこから読むテーブルを導くため）。
 */

import { computeMaxScoreFromPayload } from "@/lib/shared/gradeDataSourceMaxScore"

import {
  toAbsentMethod,
  toEstimationMode,
} from "../../../../src/types/grade.types"
import prisma from "../../prisma/client"
import { toSerializedQuestionScore } from "../../prisma/questionScore"
import { toSerializedScoreDecision } from "../../prisma/scoreDecision"
import { findExamStudentScores } from "./examScoreCalculator"
import type { DataSourceInfo, ExamDataCache } from "./gradeCalculatorTypes"
import { gradeCalculationReads } from "./gradeCalculatorTypes"
import { getRawScore } from "./rawScoreCalculator"
import type { RawScoreCell, RawScoreRow } from "./rawScoreMatrix"
import { RawScoreMatrix } from "./rawScoreMatrix"
import { resolveEffectiveScores } from "./scoreResolution"

/**
 * 素点行列と推定に必要な付随データを構築する。
 * calculateGrades のパス1と computeSourceFits が共有する（素点組み立ての単一実装＝SSOT）。
 * @returns 構築した文脈。Grade が存在しない場合は null。
 */
export async function buildGradeCalcContext(gradeId: string) {
  // 1. Grade + リレーションを取得
  const grade = await prisma.grade.findUnique({
    where: { id: gradeId },
    include: gradeCalculationReads.grade,
  })

  if (!grade) return null

  // 2. 成績の対象者一覧を取得。
  //
  // 上書き・確定値・除外設定は対象者の子として同じクエリで引く。以前は Grade 単位で
  // 別々に引いて `${studentId}:${gradeItemId}` の文字列キーで突き合わせており、
  // 名簿に居ない生徒の設定も一緒に読み込んでいた（#962 §3.3）。
  const gradeStudents = await prisma.gradeStudent.findMany({
    where: { gradeId },
    include: gradeCalculationReads.gradeStudent,
    orderBy: [{ customOrder: "asc" }, { createdAt: "asc" }],
  })

  const classroomIds = grade.gradeClassrooms.map(
    (gradeClassroom) => gradeClassroom.classroomId
  )

  // 3. 全DataSourceから使用される試験試験IDを収集
  const allDataSources = grade.gradeItems.flatMap(
    (gradeItem) => gradeItem.dataSources
  )
  const examIds = [
    ...new Set(
      allDataSources
        .filter(
          (dataSource) =>
            (dataSource.type === "exam_total" ||
              dataSource.type === "subtotal" ||
              dataSource.type === "crop_region") &&
            dataSource.examId
        )
        .map((dataSource) => dataSource.examId!)
    ),
  ]

  // 4. 試験のスコアデータを事前取得
  //
  // 起点は ExamStudent（その試験の受験者）で、採点行はその子として引く。
  // 「試験から外した生徒の採点行」は受験者が居ないので構造的に集まらない
  // （以前は CropRegion 起点で引いており、外したはずの生徒の得点が
  //  成績算出でだけ算入されていた）。受験状態も同じ行から取れるので、
  //  見込→欠測の判定に別途 status のプリロードを持たない。
  const examDataCache = new Map<string, ExamDataCache>()

  for (const examId of examIds) {
    const [examStudentRows, examPages] = await Promise.all([
      prisma.examStudent.findMany({
        where: { examId },
        include: gradeCalculationReads.examStudent,
      }),
      prisma.examPage.findMany({
        where: { examId: examId },
        include: gradeCalculationReads.examPage,
      }),
    ])
    const cropRegions = examPages.flatMap((examPage) => examPage.cropRegions)

    examDataCache.set(examId, {
      examStudents: examStudentRows.map((examStudentRow) => {
        // 受験者×設問ごとに有効スコア1件へ解決（確定 > 提案合意 > 競合）
        const { resolved: resolvedScores } = resolveEffectiveScores(
          examStudentRow.questionScores.map(toSerializedQuestionScore),
          examStudentRow.scoreDecisions.map(toSerializedScoreDecision)
        )
        return {
          examStudentId: examStudentRow.id,
          studentId: examStudentRow.studentId,
          status: examStudentRow.status,
          questionScores: resolvedScores.map((resolvedScore) => ({
            examStudentId: resolvedScore.examStudentId,
            cropRegionId: resolvedScore.cropRegionId,
            status: resolvedScore.status,
            partialScore: resolvedScore.partialScore,
          })),
        }
      }),
      cropRegions: cropRegions.map((cropRegion) => ({
        id: cropRegion.id,
        type: cropRegion.type,
        points: cropRegion.points,
      })),
    })
  }

  // 満点は元データ（設問配点 / 評価項目満点）からライブ算出する。
  // GradeDataSource.maxScore 列のスナップショットは使わない（元データ追従）。
  // 元データは行に同梱済みなので同期算出で足りる。
  const liveMaxScoreMap = new Map(
    allDataSources.map((dataSource) => [
      dataSource.id,
      computeMaxScoreFromPayload(dataSource),
    ])
  )

  // DataSource情報をまとめる（推定で使用）
  const dataSourceInfos: DataSourceInfo[] = allDataSources.map((dataSource) => {
    const sourceIds = dataSource.estimationSources.map(
      (estimationSource) => estimationSource.sourceDataSourceId
    )
    return {
      id: dataSource.id,
      name: dataSource.name,
      maxScore: liveMaxScoreMap.get(dataSource.id) ?? 0,
      absentMethod: toAbsentMethod(dataSource.absentMethod),
      absentRatio: Number(dataSource.absentRatio ?? 1),
      absentOffset: Number(dataSource.absentOffset ?? 0),
      estimationMode: toEstimationMode(dataSource.estimationMode),
      estimationSourceIds: sourceIds,
    }
  })

  // データソース id → 実体。素点行列のセルへ列の実体を同梱するために引く
  const dataSourceInfoById = new Map(
    dataSourceInfos.map((dataSourceInfo) => [dataSourceInfo.id, dataSourceInfo])
  )

  // === パス1: 全対象者 × 全DataSourceの rawScore を収集して素点行列を組む ===
  const rawScoreRows: RawScoreRow[] = []

  for (const gradeStudent of gradeStudents) {
    const cells: RawScoreCell[] = []
    for (const dataSource of allDataSources) {
      let raw = getRawScore(gradeStudent.studentId, dataSource, examDataCache)

      // 見込→欠測対応: treatExpectedAsMissing が true かつ
      // その試験の ExamStudent.status === "expected" → null扱い
      if (
        raw !== null &&
        dataSource.treatExpectedAsMissing &&
        dataSource.examId
      ) {
        const examStudentScores = findExamStudentScores(
          gradeStudent.studentId,
          dataSource.examId,
          examDataCache
        )
        if (examStudentScores?.status === "expected") {
          raw = null
        }
      }

      const dataSourceInfo = dataSourceInfoById.get(dataSource.id)
      if (dataSourceInfo)
        cells.push({ dataSource: dataSourceInfo, rawScore: raw })
    }
    rawScoreRows.push({ gradeStudent, cells })
  }

  return {
    grade,
    classroomIds,
    liveMaxScoreMap,
    dataSourceInfos,
    rawScoreMatrix: new RawScoreMatrix(rawScoreRows),
    allDataSources,
  }
}
