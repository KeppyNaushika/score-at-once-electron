/**
 * 採点結果の競合検出モジュール
 */

import type {
  FileOverviewData,
  IdIntegrationConfig,
  ScoringConflict,
  ScoringConflictData,
} from "../../../../src/types/examArchive.types"
import prisma from "../../prisma/client"
import type { ExtractedArchiveData } from "../exam-archive/archiveExtractor"

/**
 * 採点結果の競合を検出
 *
 * 既存DBにある採点結果と、インポートデータの採点結果を比較し、
 * **同じ生徒×設問×採点者**で異なる採点がある場合に競合として検出する。
 *
 * 採点者まで見るのは、採点行が採点者ごとに1行だから。別の教員が同じマスに付けた点は
 * 競合ではなく、並んで増える別の行である（取り込みも3つ組で行を引く）。
 *
 * @param importData - 展開されたアーカイブデータ
 * @param studentIdMapping - 生徒IDのマッピング（インポートID → 既存ID）
 * @param cropRegionIdMapping - CropRegion IDのマッピング（インポートID → 既存ID）
 * @param userIdMapping - 採点者IDのマッピング（インポートID → 既存ID）
 * @returns 採点競合データ
 */
export async function detectScoringConflicts(
  importData: ExtractedArchiveData,
  studentIdMapping: Record<string, string>,
  cropRegionIdMapping: Record<string, string>,
  userIdMapping: Record<string, string>
): Promise<ScoringConflictData> {
  const conflicts: ScoringConflict[] = []
  let newCount = 0
  let unchangedCount = 0

  // マッピングされた既存のCropRegion IDリスト
  const existingCropRegionIds = Object.values(cropRegionIdMapping)
  if (existingCropRegionIds.length === 0) {
    // 全て新規試験の場合、競合なし
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
      examStudent: { include: { student: true } },
    },
  })

  // 既存スコアをキー（examStudentId + cropRegionId + userId）でインデックス化。
  // 同じ3つ組の行が複数あるときは、取り込みと同じく updatedAt のいちばん新しい行を見る
  const existingScoreMap = new Map<string, (typeof existingScores)[0]>()
  for (const score of existingScores) {
    const key = `${score.examStudentId}:${score.cropRegionId}:${score.userId}`
    const already = existingScoreMap.get(key)
    if (!already || already.updatedAt < score.updatedAt) {
      existingScoreMap.set(key, score)
    }
  }

  // CropRegionのラベル・配点を取得（試験の同定にも使う）
  const cropRegions = await prisma.cropRegion.findMany({
    where: { id: { in: existingCropRegionIds } },
    include: { examPage: true },
  })
  const cropRegionMap = new Map(
    cropRegions.map((cropRegion) => [cropRegion.id, cropRegion])
  )
  const existingExamId = cropRegions[0]?.examPage.examId

  // 採点行は受験者に紐づくので、アーカイブ側の受験者→生徒を引けるようにする
  const importStudentIdByExamStudentId = new Map(
    importData.examData.examStudents.map((examStudent) => [
      examStudent.id,
      examStudent.studentId,
    ])
  )

  // 既存DBの受験者を生徒IDで引けるようにする（氏名表示もここから取る）
  const existingExamStudents = existingExamId
    ? await prisma.examStudent.findMany({
        where: {
          examId: existingExamId,
          studentId: { in: Object.values(studentIdMapping) },
        },
        include: { student: true },
      })
    : []
  const existingExamStudentByStudentId = new Map(
    existingExamStudents.map((examStudent) => [
      examStudent.studentId,
      examStudent,
    ])
  )

  // インポートデータの各QuestionScoreについて競合をチェック
  for (const importScore of importData.scoresData.questionScores) {
    const importStudentId = importStudentIdByExamStudentId.get(
      importScore.examStudentId
    )
    const mappedStudentId = importStudentId
      ? studentIdMapping[importStudentId]
      : null
    const mappedCropRegionId = cropRegionIdMapping[importScore.cropRegionId]
    const existingExamStudent = mappedStudentId
      ? existingExamStudentByStudentId.get(mappedStudentId)
      : undefined

    // 採点者が解決できないものは新規として数える。取り込みでは取り込んだ人へ倒すが、
    // ここは最終確認に見せる件数で、当たらなかった＝置き換えは起きないと言えれば足りる
    const mappedUserId = userIdMapping[importScore.userId]

    if (
      !mappedStudentId ||
      !mappedCropRegionId ||
      !existingExamStudent ||
      !mappedUserId
    ) {
      // マッピングがない場合は新規
      newCount++
      continue
    }

    const key = `${existingExamStudent.id}:${mappedCropRegionId}:${mappedUserId}`
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
      const { student } = existingExamStudent
      const cropRegion = cropRegionMap.get(mappedCropRegionId)

      conflicts.push({
        importScoreId: importScore.id,
        existingScoreId: existingScore.id,
        studentName: `${student.lastName}${student.firstName}`,
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
  // 試験IDが一致しない場合、競合なし。
  // 「別の試験として取り込む」を選んだ場合も同じで、採点は全て新しい試験の側に入る
  // （既存の試験の採点とは同じ設問を指さないので、比べる相手がいない）。
  if (
    !preMatchResult.exam?.isIdMatch ||
    integrationConfig.exam === "separate"
  ) {
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

  // CropRegionマッピングを構築（試験ID一致時はID一致でマッピング）
  const cropRegionIdMapping: Record<string, string> = {}
  const existingCropRegions = await prisma.cropRegion.findMany({
    where: {
      examPage: {
        examId: preMatchResult.exam.existingExamId!,
      },
    },
  })
  const existingCropRegionIds = new Set(
    existingCropRegions.map((cropRegion) => cropRegion.id)
  )

  for (const region of importData.examData.cropRegions) {
    if (existingCropRegionIds.has(region.id)) {
      cropRegionIdMapping[region.id] = region.id
    }
  }

  // 採点者マッピングを構築（生徒と同じ手順。既定は利用者名一致、決定があれば上書き）
  const userIdMapping: Record<string, string> = {}
  const userPreMatch = preMatchResult.user
  if (userPreMatch) {
    for (const match of userPreMatch.byId) {
      userIdMapping[match.importId] = match.existingId
    }
    if (integrationConfig.user.strategy !== "all_new") {
      for (const match of userPreMatch.byName ?? []) {
        if (!userIdMapping[match.importId]) {
          userIdMapping[match.importId] = match.existingId
        }
      }
    }
    for (const decision of integrationConfig.user.decisions) {
      if (decision.decisionType === "same_person" && decision.existingId) {
        userIdMapping[decision.importId] = decision.existingId
      } else {
        delete userIdMapping[decision.importId]
      }
    }
  }

  // 競合を検出
  return detectScoringConflicts(
    importData,
    studentIdMapping,
    cropRegionIdMapping,
    userIdMapping
  )
}
