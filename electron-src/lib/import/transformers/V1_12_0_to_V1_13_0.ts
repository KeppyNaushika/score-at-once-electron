/**
 * v1.12.0 → v1.13.0 変換器
 *
 * 主な変更点:
 * - ScoreDecision 追加（OWNERによる確定スコア。生徒×設問ごとに高々1件）
 * - QuestionScore.status の "proposed" / "final" 廃止
 *
 * 変換ロジックはDBマイグレーション（20260611135650_add_score_decision）と同一:
 * 1. 生徒×設問ごとに最新の final 行から ScoreDecision を生成
 *    （IDは final 行のIDを流用 — 決定的変換のため）
 * 2. final 行の描画注釈を同じ採点者の既存提案行へ移動（あれば）
 * 3. 同じ採点者の提案行がある final 行は削除、無ければ判定のみの提案行へ変換
 * 4. proposed は partial / pending へ変換
 *
 * 実際のインポートフロー（archiveExtractor）からは convertScoresDataToV1_13 を
 * 直接利用する（フィールド単位の互換処理パターンに合わせるため）。
 */

import type { ArchiveScoresData } from "../../../../src/types/examArchive.types"
import type {
  ArchiveData,
  ArchiveVersion,
  TransformResult,
  VersionTransformer,
} from "./types"

type ArchiveQuestionScore = ArchiveScoresData["questionScores"][number]

const cellKey = (s: ArchiveQuestionScore): string =>
  `${s.studentId} ${s.cropRegionId}`

/** updatedAt 降順 → id 降順で最新の行を選ぶ（決定的） */
const pickLatest = (rows: ArchiveQuestionScore[]): ArchiveQuestionScore =>
  rows.reduce((latest, current) => {
    if (current.updatedAt !== latest.updatedAt) {
      return current.updatedAt > latest.updatedAt ? current : latest
    }
    return current.id > latest.id ? current : latest
  })

/**
 * scores.json を v1.13.0 形式へ正規化する。
 *
 * - scoreDecisions が無ければ final 行から導出して補完
 * - status の "final" / "proposed" を浄化
 *
 * v1.13.0 アーカイブ（final/proposed 行なし・scoreDecisions あり）には無変更で冪等。
 */
export function convertScoresDataToV1_13(scoresData: ArchiveScoresData): {
  scoresData: ArchiveScoresData
  warnings: string[]
} {
  const warnings: string[] = []
  const questionScores = scoresData.questionScores ?? []
  const drawingAnnotations = scoresData.drawingAnnotations ?? []
  const existingDecisions = scoresData.scoreDecisions ?? []

  const finals = questionScores.filter((s) => s.status === "final")
  if (finals.length === 0 && scoresData.scoreDecisions) {
    // 既にv1.13.0形式
    const hasProposed = questionScores.some((s) => s.status === "proposed")
    if (!hasProposed) return { scoresData, warnings }
  }

  // 1) 生徒×設問ごとに最新の final 行から確定を生成
  const finalsByCell = new Map<string, ArchiveQuestionScore[]>()
  for (const f of finals) {
    const key = cellKey(f)
    const group = finalsByCell.get(key)
    if (group) {
      group.push(f)
    } else {
      finalsByCell.set(key, [f])
    }
  }

  const decidedCells = new Set(
    existingDecisions.map((d) => `${d.studentId} ${d.cropRegionId}`)
  )
  const scoreDecisions = [...existingDecisions]
  for (const group of finalsByCell.values()) {
    const latest = pickLatest(group)
    if (decidedCells.has(cellKey(latest))) continue
    scoreDecisions.push({
      id: latest.id,
      cropRegionId: latest.cropRegionId,
      studentId: latest.studentId,
      verdict: latest.partialScore === null ? "correct" : "partial",
      score: latest.partialScore,
      comment: null,
      decidedByUserId: latest.userId,
      decidedAt: latest.updatedAt,
      sourceQuestionScoreId: null,
      createdAt: latest.createdAt,
      updatedAt: latest.updatedAt,
    })
  }

  // 2) final 行の注釈を同じ採点者の既存提案行へ移動
  const proposalByCellUser = new Map<string, ArchiveQuestionScore>()
  for (const s of questionScores) {
    if (s.status === "final") continue
    const key = `${cellKey(s)} ${s.userId}`
    const existing = proposalByCellUser.get(key)
    if (!existing || pickLatest([existing, s]) === s) {
      proposalByCellUser.set(key, s)
    }
  }

  const finalIdToProposalId = new Map<string, string>()
  const finalIdsToDelete = new Set<string>()
  for (const f of finals) {
    const proposal = proposalByCellUser.get(`${cellKey(f)} ${f.userId}`)
    if (proposal) {
      finalIdToProposalId.set(f.id, proposal.id)
      finalIdsToDelete.add(f.id) // 3) 提案行がある final 行は削除
    }
  }

  const movedAnnotations = drawingAnnotations.map((a) => {
    const newId = finalIdToProposalId.get(a.questionScoreId)
    return newId ? { ...a, questionScoreId: newId } : a
  })

  // 3-4) final 行の削除・変換、proposed の浄化
  const cleanedScores = questionScores
    .filter((s) => !finalIdsToDelete.has(s.id))
    .map((s) => {
      if (s.status === "final") {
        return {
          ...s,
          status: s.partialScore === null ? "correct" : "partial",
        }
      }
      if (s.status === "proposed") {
        return {
          ...s,
          status: s.partialScore === null ? "pending" : "partial",
        }
      }
      return s
    })

  if (finals.length > 0) {
    warnings.push(
      `旧形式の final 採点 ${finals.length}件を確定（ScoreDecision）へ変換しました`
    )
  }

  return {
    scoresData: {
      ...scoresData,
      questionScores: cleanedScores,
      drawingAnnotations: movedAnnotations,
      scoreDecisions,
    },
    warnings,
  }
}

export class V1_12_0_to_V1_13_0_Transformer implements VersionTransformer {
  readonly fromVersion: ArchiveVersion = "1.12.0"
  readonly toVersion: ArchiveVersion = "1.13.0"

  transform(data: ArchiveData): TransformResult {
    const { scoresData, warnings } = convertScoresDataToV1_13(data.scoresData)
    return {
      data: {
        ...data,
        manifest: { ...data.manifest, version: this.toVersion },
        scoresData,
      },
      warnings: warnings.map((w) => `1.12.0→1.13.0: ${w}`),
    }
  }
}
