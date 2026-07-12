/**
 * 成績算出エンジン
 * GradeItem × DataSource ベースで観点別・総合成績を算出
 * 欠測時の代替スコア推定（average / regression / zero）に対応
 */

import type {
  AbsentMethod,
  GradeCalculationResult,
  GradeItemResult,
  SourceScoreResult,
  StudentGradeResult,
} from "../../../../src/types/grade.types"
import {
  toGradeBoundaryTargetType,
  toGradeDataSourceType,
} from "../../../../src/types/grade.types"
import prisma from "../../prisma/client"
import { computeLiveMaxScore } from "../../prisma/gradeDataSource"
import {
  applyAdjustmentAndClamp,
  estimateAbsentScore,
} from "./absentEstimation"
import type { DataSourceInfo, ExamDataCache } from "./gradeCalculatorTypes"
import { determineGradeLabel } from "./gradeLabel"
import { getRawScore } from "./rawScoreCalculator"
import { resolveEffectiveScores } from "./scoreResolution"

/**
 * 成績を算出する
 */
export async function calculateGrades(gradeId: string): Promise<{
  success: boolean
  result?: GradeCalculationResult
  error?: string
}> {
  try {
    // 1. Grade + リレーションを取得
    const grade = await prisma.grade.findUnique({
      where: { id: gradeId },
      include: {
        gradeClassrooms: {
          include: { classroom: true },
          orderBy: { order: "asc" },
        },
        gradeItems: {
          include: {
            dataSources: {
              include: {
                exam: true,
                subtotal: true,
                cropRegion: true,
                courseworkItem: {
                  include: {
                    scores: true,
                    letterScales: { orderBy: { order: "asc" } },
                  },
                },
                coursework: {
                  include: {
                    items: {
                      include: {
                        scores: true,
                        letterScales: { orderBy: { order: "asc" } },
                      },
                    },
                  },
                },
              },
              orderBy: { order: "asc" },
            },
          },
          orderBy: { order: "asc" },
        },
        boundarySets: {
          include: { boundaries: { orderBy: { order: "asc" } } },
        },
      },
    })

    if (!grade) {
      return { success: false, error: "Grade exam not found" }
    }

    // 2. 試験の登録生徒一覧を取得
    const examStudents = await prisma.gradeStudent.findMany({
      where: { gradeId },
      include: {
        student: {
          include: {
            memberships: {
              include: { classroom: { select: { id: true, name: true } } },
            },
          },
        },
      },
      orderBy: [{ customOrder: "asc" }, { createdAt: "asc" }],
    })

    const classroomIds = grade.gradeClassrooms.map(
      (gradeClassroom) => gradeClassroom.classroomId
    )

    // 3. 上書きデータを取得
    const overrides = await prisma.gradeOverride.findMany({
      where: { gradeId },
    })
    const overrideMap = new Map<string, string>()
    for (const override of overrides) {
      const key = `${override.studentId}:${override.targetType}:${override.gradeItemId ?? "__overall__"}`
      overrideMap.set(key, override.overrideLabel)
    }

    // 3.5. 除外データを取得
    const exclusions = await prisma.gradeItemExclusion.findMany({
      where: { gradeId },
    })
    const exclusionSet = new Set(
      exclusions.map(
        (exclusion) => `${exclusion.studentId}:${exclusion.gradeItemId}`
      )
    )

    // 4. 全DataSourceから使用される試験試験IDを収集
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

    // 5. 試験試験のスコアデータを事前取得
    const examDataCache = new Map<string, ExamDataCache>()

    for (const examId of examIds) {
      const [questionScores, scoreDecisions, examPages] = await Promise.all([
        prisma.questionScore.findMany({
          where: { cropRegion: { examPage: { examId: examId } } },
          select: {
            id: true,
            studentId: true,
            cropRegionId: true,
            status: true,
            partialScore: true,
            updatedAt: true,
          },
        }),
        prisma.scoreDecision.findMany({
          where: { cropRegion: { examPage: { examId: examId } } },
          select: {
            studentId: true,
            cropRegionId: true,
            verdict: true,
            score: true,
            decidedAt: true,
            sourceQuestionScoreId: true,
          },
        }),
        prisma.examPage.findMany({
          where: { examId: examId },
          include: { cropRegions: true },
        }),
      ])
      const cropRegions = examPages.flatMap((examPage) => examPage.cropRegions)
      // 生徒×設問ごとに有効スコア1件へ解決（確定 > 提案合意 > 競合）
      const { resolved: resolvedScores } = resolveEffectiveScores(
        questionScores,
        scoreDecisions
      )
      examDataCache.set(examId, {
        questionScores: resolvedScores.map((resolvedScore) => ({
          studentId: resolvedScore.studentId,
          cropRegionId: resolvedScore.cropRegionId,
          status: resolvedScore.status,
          partialScore: resolvedScore.partialScore,
        })),
        cropRegions: cropRegions.map((cropRegion) => ({
          id: cropRegion.id,
          type: cropRegion.type,
          points: cropRegion.points,
        })),
      })
    }

    // 5.5. 見込→欠測対応: examIdごとのExamStudent状態をプリロード
    // Map<examId, Map<studentId, status>>
    const examExamStudentStatusMap = new Map<string, Map<string, string>>()
    for (const examId of examIds) {
      const examStudentStatuses = await prisma.examStudent.findMany({
        where: { examId: examId },
        select: { studentId: true, status: true },
      })
      const statusMap = new Map<string, string>()
      for (const examStudent of examStudentStatuses) {
        statusMap.set(examStudent.studentId, examStudent.status)
      }
      examExamStudentStatusMap.set(examId, statusMap)
    }

    // 満点は元データ（設問配点 / 評価項目満点）からライブ算出する。
    // GradeDataSource.maxScore 列のスナップショットは使わない（元データ追従）。
    // 生徒ループの外で1ソース1回だけ算出してマップ化する。
    const liveMaxScoreMap = new Map<string, number>()
    for (const dataSource of allDataSources) {
      liveMaxScoreMap.set(dataSource.id, await computeLiveMaxScore(dataSource))
    }

    // DataSource情報をまとめる（推定で使用）
    const dataSourceInfos: DataSourceInfo[] = allDataSources.map(
      (dataSource) => {
        let sourceIds: string[] = []
        if (typeof dataSource.estimationSourceIds === "string") {
          try {
            sourceIds = JSON.parse(dataSource.estimationSourceIds)
          } catch {
            sourceIds = []
          }
        }
        return {
          id: dataSource.id,
          maxScore: liveMaxScoreMap.get(dataSource.id) ?? 0,
          absentMethod: (dataSource.absentMethod ?? "null") as AbsentMethod,
          absentRatio: Number(dataSource.absentRatio ?? 1),
          absentOffset: Number(dataSource.absentOffset ?? 0),
          estimationMode: dataSource.estimationMode ?? "all",
          estimationSourceIds: sourceIds,
        }
      }
    )

    // === パス1: 全生徒 × 全DataSourceの rawScore を収集 ===
    // Map<studentId, Map<dataSourceId, number | null>>
    const rawScoreMap = new Map<string, Map<string, number | null>>()

    for (const examStudent of examStudents) {
      const studentScores = new Map<string, number | null>()
      for (const dataSource of allDataSources) {
        let raw = await getRawScore(
          examStudent.student.id,
          dataSource,
          examDataCache
        )

        // 見込→欠測対応: treatExpectedAsMissing が true かつ
        // 試験試験の ExamStudent.status === "expected" → null扱い
        if (
          raw !== null &&
          dataSource.treatExpectedAsMissing &&
          dataSource.examId
        ) {
          const statusMap = examExamStudentStatusMap.get(dataSource.examId)
          if (statusMap?.get(examStudent.student.id) === "expected") {
            raw = null
          }
        }

        studentScores.set(dataSource.id, raw)
      }
      rawScoreMap.set(examStudent.student.id, studentScores)
    }

    // === パス2: 推定 + 重み付け ===
    const students: StudentGradeResult[] = []

    for (const examStudent of examStudents) {
      const student = examStudent.student
      const membership = student.memberships.find((membership) =>
        classroomIds.includes(membership.classroomId)
      )
      const gradeItemResults: GradeItemResult[] = []

      for (const gradeItem of grade.gradeItems) {
        // 除外チェック
        if (exclusionSet.has(`${student.id}:${gradeItem.id}`)) {
          gradeItemResults.push({
            gradeItemId: gradeItem.id,
            gradeItemName: gradeItem.name,
            isExcluded: true,
            isAllMissing: false,
            sourceScores: [],
            weightedScore: null,
            weightedMaxScore: 0,
            percentage: null,
            gradeLabel: null,
            originalGradeLabel: null,
            overrideGradeLabel: null,
          })
          continue
        }

        const sourceScores: SourceScoreResult[] = []

        for (const dataSource of gradeItem.dataSources) {
          // 満点は元データからライブ算出した値を使う（maxScore列は使わない）
          const maxScore = liveMaxScoreMap.get(dataSource.id) ?? 0
          const weight = Number(dataSource.weight)
          const absentMethod = (dataSource.absentMethod ??
            "null") as AbsentMethod
          const absentRatio = Number(dataSource.absentRatio ?? 1)
          const absentOffset = Number(dataSource.absentOffset ?? 0)

          const dataSourceInfo = dataSourceInfos.find(
            (sourceInfo) => sourceInfo.id === dataSource.id
          )

          const studentScores = rawScoreMap.get(student.id)
          let rawScore = studentScores?.get(dataSource.id) ?? null
          let isEstimated = false

          // rawScoreがnullかつ推定設定がある場合、代替スコアを算出
          if (rawScore === null && absentMethod !== "null") {
            // ソース選択対応: estimationMode === "selected" の場合、指定IDのみ使用
            const sourcesToUse =
              dataSourceInfo?.estimationMode === "selected"
                ? dataSourceInfos.filter((sourceInfo) =>
                    dataSourceInfo.estimationSourceIds.includes(sourceInfo.id)
                  )
                : dataSourceInfos

            const estimated = estimateAbsentScore(
              absentMethod,
              student.id,
              dataSource.id,
              maxScore,
              rawScoreMap,
              sourcesToUse
            )
            if (estimated !== null) {
              // 調整 + クランプ
              rawScore = applyAdjustmentAndClamp(
                estimated,
                absentRatio,
                absentOffset,
                maxScore
              )
              isEstimated = true
            }
          }

          const weightedScore =
            rawScore !== null && maxScore > 0
              ? (rawScore / maxScore) * weight
              : null

          // coursework型: 入力された評価記号・加減点・コメントを結果に添付
          const courseworkScore =
            dataSource.type === "coursework"
              ? dataSource.courseworkItem?.scores.find(
                  (score) => score.studentId === student.id
                )
              : undefined

          sourceScores.push({
            dataSourceId: dataSource.id,
            dataSourceName: dataSource.name,
            type: toGradeDataSourceType(dataSource.type),
            rawScore,
            maxScore,
            weight,
            weightedScore,
            isEstimated,
            letterValue: courseworkScore?.letterValue ?? null,
            adjustment:
              courseworkScore?.adjustment !== null &&
              courseworkScore?.adjustment !== undefined
                ? Number(courseworkScore.adjustment)
                : null,
            adjustmentReason: courseworkScore?.adjustmentReason ?? null,
            comment: courseworkScore?.comment ?? null,
          })
        }

        // GradeItemの重み付け合計（欠点以外のみ分母に含める）
        const nonNullSources = sourceScores.filter(
          (sourceScore) => sourceScore.weightedScore !== null
        )

        let weightedMax: number
        let weightedScore: number | null

        let isAllMissing = false

        if (nonNullSources.length > 0) {
          weightedMax = nonNullSources.reduce(
            (sum, sourceScore) => sum + sourceScore.weight,
            0
          )
          weightedScore = nonNullSources.reduce(
            (sum, sourceScore) => sum + sourceScore.weightedScore!,
            0
          )
        } else if (sourceScores.length > 0) {
          // 全スコアがnull → 換算合計0点として扱う
          weightedMax = sourceScores.reduce(
            (sum, sourceScore) => sum + sourceScore.weight,
            0
          )
          weightedScore = 0
          isAllMissing = true
        } else {
          weightedMax = 0
          weightedScore = null
        }

        const percentage =
          weightedScore !== null && weightedMax > 0
            ? (weightedScore / weightedMax) * 100
            : null

        // 境界セットからラベルを決定
        const boundarySet = grade.boundarySets.find(
          (boundarySet) =>
            boundarySet.targetType === "grade_item" &&
            boundarySet.gradeItemId === gradeItem.id
        )
        const originalGradeLabel = determineGradeLabel(
          percentage,
          boundarySet?.boundaries ?? []
        )
        const itemOverrideKey = `${student.id}:grade_item:${gradeItem.id}`
        const overrideGradeLabel = overrideMap.get(itemOverrideKey) ?? null

        gradeItemResults.push({
          gradeItemId: gradeItem.id,
          gradeItemName: gradeItem.name,
          isExcluded: false,
          isAllMissing,
          sourceScores,
          weightedScore,
          weightedMaxScore: weightedMax,
          percentage,
          gradeLabel: overrideGradeLabel ?? originalGradeLabel,
          originalGradeLabel,
          overrideGradeLabel,
        })
      }

      // 総合スコア（除外・欠点のGradeItemは分母・分子から除外）
      const includedResults = gradeItemResults.filter(
        (gradeItemResult) => !gradeItemResult.isExcluded
      )
      const nonNullItems = includedResults.filter(
        (gradeItemResult) => gradeItemResult.weightedScore !== null
      )
      const overallMaxScore = nonNullItems.reduce(
        (sum, gradeItemResult) => sum + gradeItemResult.weightedMaxScore,
        0
      )
      const overallScore =
        nonNullItems.length > 0
          ? nonNullItems.reduce(
              (sum, gradeItemResult) => sum + gradeItemResult.weightedScore!,
              0
            )
          : null
      const overallPercentage =
        overallScore !== null && overallMaxScore > 0
          ? (overallScore / overallMaxScore) * 100
          : null

      const overallBoundarySet = grade.boundarySets.find(
        (boundarySet) => boundarySet.targetType === "overall"
      )
      const originalOverallGradeLabel = determineGradeLabel(
        overallPercentage,
        overallBoundarySet?.boundaries ?? []
      )
      const overallOverrideKey = `${student.id}:overall:__overall__`
      const overrideOverallGradeLabel =
        overrideMap.get(overallOverrideKey) ?? null

      students.push({
        studentId: student.id,
        studentNumber: student.studentNumber,
        lastName: student.lastName,
        firstName: student.firstName,
        attendanceNumber: membership?.attendanceNumber ?? null,
        className: membership?.classroom.name ?? null,
        gradeItemResults,
        overallScore,
        overallMaxScore,
        overallPercentage,
        overallGradeLabel:
          overrideOverallGradeLabel ?? originalOverallGradeLabel,
        originalOverallGradeLabel,
        overrideOverallGradeLabel,
      })
    }

    return {
      success: true,
      result: {
        gradeId: grade.id,
        gradeName: grade.name,
        classNames: grade.gradeClassrooms.map(
          (gradeClassroom) => gradeClassroom.classroom.name
        ),
        gradeItems: grade.gradeItems.map((gradeItem) => ({
          id: gradeItem.id,
          name: gradeItem.name,
          order: gradeItem.order,
        })),
        students,
        boundarySets: grade.boundarySets.map((boundarySet) => ({
          targetType: toGradeBoundaryTargetType(boundarySet.targetType),
          gradeItemId: boundarySet.gradeItemId,
          boundaries: [...boundarySet.boundaries]
            .sort(
              (boundaryA, boundaryB) =>
                Number(boundaryB.minPercentage) -
                Number(boundaryA.minPercentage)
            )
            .map((boundary) => ({
              label: boundary.label,
              minPercentage: Number(boundary.minPercentage),
            })),
        })),
      },
    }
  } catch (error) {
    console.error("Error calculating grades:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}
