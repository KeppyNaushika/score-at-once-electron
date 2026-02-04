/**
 * 採点結果の競合検出モジュール
 */

import type {
  FileOverviewData,
  IdIntegrationConfig,
  ScoringConflict,
  ScoringConflictData,
} from "../../../../types/projectArchive.types"
import prisma from "../../prisma/client"
import type { ExtractedArchiveData } from "../project-archive/archiveExtractor"

/**
 * 採点結果の競合を検出
 *
 * 既存DBにある採点結果と、インポートデータの採点結果を比較し、
 * 同じ生徒×設問で異なる採点がある場合に競合として検出する。
 *
 * @param importData - 展開されたアーカイブデータ
 * @param studentIdMapping - 生徒IDのマッピング（インポートID → 既存ID）
 * @param cropRegionIdMapping - CropRegion IDのマッピング（インポートID → 既存ID）
 * @returns 採点競合データ
 */
export async function detectScoringConflicts(
  importData: ExtractedArchiveData,
  studentIdMapping: Record<string, string>,
  cropRegionIdMapping: Record<string, string>
): Promise<ScoringConflictData> {
  const conflicts: ScoringConflict[] = []
  let newCount = 0
  let unchangedCount = 0

  // マッピングされた既存のCropRegion IDリスト
  const existingCropRegionIds = Object.values(cropRegionIdMapping)
  if (existingCropRegionIds.length === 0) {
    // 全て新規プロジェクトの場合、競合なし
    return {
      conflictCount: 0,
      newCount: importData.scoresData.questionScores.length,
      unchangedCount: 0,
      conflicts: [],
    }
  }

  // 既存のQuestionScoreを取得（関連するCropRegionのみ）
  const existingScores = await prisma.questionScore.findMany({
    where: {
      cropRegionId: { in: existingCropRegionIds },
    },
    include: {
      cropRegion: true,
      student: true,
    },
  })

  // 既存スコアをキー（studentId + cropRegionId）でインデックス化
  const existingScoreMap = new Map<string, (typeof existingScores)[0]>()
  for (const score of existingScores) {
    const key = `${score.studentId}:${score.cropRegionId}`
    existingScoreMap.set(key, score)
  }

  // CropRegionのラベル・配点を取得
  const cropRegions = await prisma.cropRegion.findMany({
    where: { id: { in: existingCropRegionIds } },
  })
  const cropRegionMap = new Map(cropRegions.map((r) => [r.id, r]))

  // 生徒情報を取得
  const studentIds = Object.values(studentIdMapping)
  const students = await prisma.student.findMany({
    where: { id: { in: studentIds } },
  })
  const studentMap = new Map(students.map((s) => [s.id, s]))

  // インポートデータの各QuestionScoreについて競合をチェック
  for (const importScore of importData.scoresData.questionScores) {
    const mappedStudentId = importScore.studentId
      ? studentIdMapping[importScore.studentId]
      : null
    const mappedCropRegionId = cropRegionIdMapping[importScore.cropRegionId]

    if (!mappedStudentId || !mappedCropRegionId) {
      // マッピングがない場合は新規
      newCount++
      continue
    }

    const key = `${mappedStudentId}:${mappedCropRegionId}`
    const existingScore = existingScoreMap.get(key)

    if (!existingScore) {
      // 既存に存在しない場合は新規
      newCount++
      continue
    }

    // 既存と値を比較
    const importPartialScore = importScore.partialScore
      ? parseFloat(importScore.partialScore)
      : null
    const existingPartialScore = existingScore.partialScore
      ? Number(existingScore.partialScore)
      : null

    const isIdentical =
      importScore.status === existingScore.status &&
      importPartialScore === existingPartialScore

    if (isIdentical) {
      // データが同一 — 変更なし
      unchangedCount++
    } else {
      // データが異なる — 競合として記録
      const student = studentMap.get(mappedStudentId)
      const cropRegion = cropRegionMap.get(mappedCropRegionId)

      conflicts.push({
        importScoreId: importScore.id,
        existingScoreId: existingScore.id,
        studentName: student
          ? `${student.lastName}${student.firstName}`
          : "不明",
        studentId: mappedStudentId,
        questionLabel: cropRegion?.label ?? "不明",
        cropRegionId: mappedCropRegionId,
        importScore: {
          status: importScore.status,
          partialScore: importPartialScore,
          updatedAt: importScore.updatedAt,
        },
        existingScore: {
          status: existingScore.status,
          partialScore: existingPartialScore,
          updatedAt: existingScore.updatedAt.toISOString(),
        },
        maxPoints: cropRegion?.points ?? null,
      })
    }
  }

  return {
    conflictCount: conflicts.length,
    newCount,
    unchangedCount,
    conflicts,
  }
}

/**
 * ユーザーの判断に基づいて採点結果の競合を検出
 *
 * id_integrationステップでユーザーが「同じ人」と判断した生徒を含めて
 * 採点競合を検出する。
 *
 * @param importData - 展開されたアーカイブデータ
 * @param preMatchResult - 事前照合結果
 * @param integrationConfig - ユーザーのID統合設定
 * @returns 採点競合データ
 */
export async function detectScoringConflictsWithUserDecisions(
  importData: ExtractedArchiveData,
  preMatchResult: FileOverviewData,
  integrationConfig: IdIntegrationConfig
): Promise<ScoringConflictData> {
  // プロジェクトIDが一致しない場合、競合なし
  if (!preMatchResult.project?.isIdMatch) {
    return {
      conflictCount: 0,
      newCount: importData.scoresData.questionScores.length,
      unchangedCount: 0,
      conflicts: [],
    }
  }

  // 生徒IDマッピングを構築（ユーザーの判断を反映）
  const studentIdMapping: Record<string, string> = {}

  // 1. ID一致の生徒（自動でマッピング）
  for (const match of preMatchResult.student.byId) {
    studentIdMapping[match.importId] = match.existingId
  }

  // 2. ユーザーが「同じ人」と判断した生徒
  const studentConfig = integrationConfig.student

  // strategyに基づくデフォルトマッピング
  if (studentConfig.strategy === "by_student_number") {
    // 学籍番号一致のものをマッピング
    for (const match of preMatchResult.student.byStudentNumber ?? []) {
      if (!studentIdMapping[match.importId]) {
        studentIdMapping[match.importId] = match.existingId
      }
    }
  } else if (studentConfig.strategy === "by_name") {
    // byStudentNumberのマッチも含める（学籍番号一致はより確実な照合）
    for (const match of preMatchResult.student.byStudentNumber ?? []) {
      if (!studentIdMapping[match.importId]) {
        studentIdMapping[match.importId] = match.existingId
      }
    }
    // 氏名一致のものをマッピング
    for (const match of preMatchResult.student.byName ?? []) {
      if (!studentIdMapping[match.importId]) {
        studentIdMapping[match.importId] = match.existingId
      }
    }
  }

  // 3. 個別のdecisionsでオーバーライド
  for (const decision of studentConfig.decisions) {
    if (decision.decisionType === "same_person" && decision.existingId) {
      studentIdMapping[decision.importId] = decision.existingId
    } else if (
      decision.decisionType === "create_new" ||
      decision.decisionType === "skip"
    ) {
      // 「新規作成」または「スキップ」の場合、マッピングから削除
      delete studentIdMapping[decision.importId]
    }
  }

  // CropRegionマッピングを構築（プロジェクトID一致時はID一致でマッピング）
  const cropRegionIdMapping: Record<string, string> = {}
  const existingCropRegions = await prisma.cropRegion.findMany({
    where: {
      projectPage: {
        projectId: preMatchResult.project.existingProjectId!,
      },
    },
  })
  const existingCropRegionIds = new Set(existingCropRegions.map((r) => r.id))

  for (const region of importData.projectData.cropRegions) {
    if (existingCropRegionIds.has(region.id)) {
      cropRegionIdMapping[region.id] = region.id
    }
  }

  // 競合を検出
  return detectScoringConflicts(
    importData,
    studentIdMapping,
    cropRegionIdMapping
  )
}
