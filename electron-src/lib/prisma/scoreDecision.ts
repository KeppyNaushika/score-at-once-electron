import type { ScoreDecision } from "@prisma/client"
import { Prisma } from "@prisma/client"

import type { Serialized } from "@/types/prismaExtensions"
import {
  isStatusCompatibleWithScoringMethod,
  toScoringMethod,
} from "@/types/rubric.types"
import {
  type ScoringStatus,
  toScoringStatus,
} from "@/types/scoringStatus.types"

import { recordAuditLog } from "./auditLog"
import {
  resolveExamScopeByCropRegion,
  resolveScoreCellTargets,
} from "./auditScope"
import prisma from "./client"
import { assertCropRegionsInSameExam } from "./examScopeGuard"
import { PUBLIC_USER_OMIT } from "./publicUser"
import { serializePrisma } from "./serializePrisma"

/**
 * 確定行を「シリアライズ後の形」へ倒す境界コンバータ。
 *
 * `score`（Decimal）を number へ、`verdict`（DB 上は String 列）を `ScoringStatus` へ
 * 絞る。型の側の相棒は `SerializedScoreDecision`（types/prismaExtensions.ts）。
 * 同梱したリレーションは落とさずそのまま持つ（射影しない）。
 */
export const toSerializedScoreDecision = <
  Row extends Omit<ScoreDecision, "verdict"> & { verdict: string },
>(
  scoreDecision: Row
): Serialized<Row> & { verdict: ScoringStatus } => ({
  ...serializePrisma(scoreDecision),
  verdict: toScoringStatus(scoreDecision.verdict),
})

/** verdict コードを日本語表示に変換（監査ログ差分用） */
const verdictLabel = (verdict: string | null | undefined): string => {
  switch (verdict) {
    case "correct":
      return "正解"
    case "incorrect":
      return "不正解"
    case "partial":
      return "部分点"
    case "pending":
      return "保留"
    case "no_answer":
      return "無答"
    case "double_mark":
      return "複数マーク"
    case "evaluated":
      return "類型評価"
    default:
      return verdict ?? "（なし）"
  }
}

/**
 * 確定1件の内容。**確定は「このセルの結果はこれだ」を一度に決める1つの操作**なので、
 * 省略できる項目は無い（`Required`）。コメントを空にするときは `null` を明示する
 * — 省略が「消す」を意味する形にしない（Prisma の流儀は逆で、
 * 2人目がそちらの流儀で書くと消えてしまう）。
 *
 * 土台は Prisma の入力型で、**DB と書き込みが決める列（id / createdAt / updatedAt /
 * decidedAt）を外し、Decimal（score）と union（verdict）だけを注入する**。
 */
export type UpsertScoreDecisionData = Required<
  Omit<
    Prisma.ScoreDecisionUncheckedCreateInput,
    | "id"
    | "createdAt"
    | "updatedAt"
    | "decidedAt"
    | "verdict"
    | "score"
    | "scaleLevelId"
  >
> & {
  verdict: ScoringStatus
  /** 確定点。verdict 自体が点を決める（正解など）ときは null */
  score: number | null
  /**
   * 確定した類型（docs/vlm-grading-design.md §4-8-5）。verdict が `evaluated` のときだけ値を持ち、
   * そのとき score は null（点は類型の点数から読む）。ほかの verdict では null
   */
  scaleLevelId: string | null
}

/**
 * 試験単位の確定権限チェック。
 *
 * 試験に UserExam が登録されている場合は OWNER のみ確定できる。
 * UserExam が1件も無い試験（旧データ）は制限しない
 * — createExam / アーカイブインポートは作成者を必ず OWNER として登録するため、
 * 新規試験でこのフォールバックに入ることはない。
 */
export const canDecideExamScores = async (
  examId: string,
  userId: string
): Promise<{ allowed: boolean; reason?: string }> => {
  const members = await prisma.userExam.findMany({
    where: { examId },
  })

  // メンバー管理なしの旧データは制限しない
  if (members.length === 0) return { allowed: true }

  const currentMember = members.find((member) => member.userId === userId)
  if (currentMember?.role === "OWNER") return { allowed: true }

  return {
    allowed: false,
    reason: "採点結果の確定は試験の所有者（OWNER）のみが行えます",
  }
}

/**
 * 確定の判定・類型が設問の採点方式に合うかを確かめ、書く類型を返す
 * （docs/vlm-grading-design.md §4-8-5）。
 *
 * 類型評価の設問では正解・不正解・部分点を確定できず、点の設問では類型評価を確定できない。
 * `evaluated` は設問が今使っている類型評価の類型を要する（07 の類型の書き込み
 * `scaleLevelScoreWrite.ts` と同じ確かめ方）。ほかの判定では類型を書かない。
 */
const resolveDecidedScaleLevel = async (
  decisionData: UpsertScoreDecisionData
) => {
  const cropRegion = await prisma.cropRegion.findUnique({
    where: { id: decisionData.cropRegionId },
  })
  if (!cropRegion) throw new Error("採点領域が見つかりません")

  const scoringMethod = toScoringMethod(cropRegion.scoringMethod)
  if (
    !isStatusCompatibleWithScoringMethod(scoringMethod, decisionData.verdict)
  ) {
    throw new Error(
      scoringMethod === "scale"
        ? "類型評価の設問は、類型を選んで確定してください"
        : "この設問は類型評価ではないため、類型では確定できません"
    )
  }

  if (decisionData.verdict !== "evaluated") return null

  if (decisionData.scaleLevelId === null) {
    throw new Error("確定する類型を選んでください")
  }
  const scaleLevel = await prisma.scoreScaleLevel.findUnique({
    where: { id: decisionData.scaleLevelId },
  })
  if (!scaleLevel) throw new Error("類型が見つかりません")
  if (scaleLevel.scaleId !== cropRegion.scoreScaleId) {
    throw new Error("この設問の類型評価の類型ではありません")
  }
  return scaleLevel
}

/** 設問（採点領域）から試験を引いて確定権限をチェックする */
const canDecideScore = async (
  cropRegionId: string,
  userId: string
): Promise<{ allowed: boolean; reason?: string }> => {
  const cropRegion = await prisma.cropRegion.findUnique({
    where: { id: cropRegionId },
    include: { examPage: true },
  })
  if (!cropRegion) {
    return { allowed: false, reason: "採点領域が見つかりません" }
  }

  return canDecideExamScores(cropRegion.examPage.examId, userId)
}

/**
 * 確定スコアをupsertする（生徒×設問ごとに1行）。
 *
 * 削除・再作成はしない — LWW同期でセカンダリUNIQUEにより単一行へ収束させるため、
 * 同一セルの確定は常に既存行のin-place更新で表現する。
 */
export const upsertScoreDecision = async (
  decisionData: UpsertScoreDecisionData
) => {
  const permission = await canDecideScore(
    decisionData.cropRegionId,
    decisionData.decidedByUserId
  )
  if (!permission.allowed) {
    throw new Error(permission.reason ?? "権限がありません")
  }

  const scaleLevel = await resolveDecidedScaleLevel(decisionData)

  // 類型評価の点は類型の点数から読むので、確定点は書かない
  const score =
    scaleLevel === null && decisionData.score !== null
      ? new Prisma.Decimal(decisionData.score)
      : null

  // 採点領域と受験者が同じ試験のものであること（FK は片方ずつしか見ない）
  await assertCropRegionsInSameExam([
    {
      cropRegionId: decisionData.cropRegionId,
      examStudentId: decisionData.examStudentId,
    },
  ])

  // 差分記録用に変更前の確定を取得
  const previous = await prisma.scoreDecision.findUnique({
    where: {
      cropRegionId_examStudentId: {
        cropRegionId: decisionData.cropRegionId,
        examStudentId: decisionData.examStudentId,
      },
    },
    include: { scaleLevel: true },
  })

  // 作成でも更新でも同じ内容を書く。確定は毎回セルの結果全体を決め直す操作なので、
  // 「触った列だけ」ではなく受け取った内容がそのまま行になる
  const decidedColumns = {
    verdict: decisionData.verdict,
    score,
    scaleLevelId: scaleLevel?.id ?? null,
    comment: decisionData.comment,
    decidedByUserId: decisionData.decidedByUserId,
    decidedAt: new Date(),
  }

  const decision = await prisma.scoreDecision.upsert({
    where: {
      cropRegionId_examStudentId: {
        cropRegionId: decisionData.cropRegionId,
        examStudentId: decisionData.examStudentId,
      },
    },
    create: {
      cropRegionId: decisionData.cropRegionId,
      examStudentId: decisionData.examStudentId,
      ...decidedColumns,
    },
    update: decidedColumns,
    include: {
      decidedBy: { omit: PUBLIC_USER_OMIT },
      scaleLevel: true,
    },
  })

  // 監査ログ: 採点確定（OWNERによる確定。提案連打は記録しない）
  const scope = await resolveExamScopeByCropRegion(decisionData.cropRegionId)
  const targets = await resolveScoreCellTargets(
    decisionData.cropRegionId,
    decisionData.examStudentId
  )
  const studentLabel = targets.find(
    (target) => target.targetType === "Student"
  )?.targetLabel
  const prevScore = previous?.score != null ? Number(previous.score) : null
  const newScore = score != null ? Number(score) : null
  await recordAuditLog({
    action: "exam.score.decide",
    userId: decisionData.decidedByUserId,
    entityType: "ScoreDecision",
    entityId: decision.id,
    scopeId: scope.scopeId,
    scopeLabel: scope.scopeLabel,
    summary: studentLabel
      ? `「${studentLabel}」の採点を確定しました`
      : "採点を確定しました",
    changes: [
      {
        field: "verdict",
        label: "判定",
        before: previous ? verdictLabel(previous.verdict) : null,
        after: verdictLabel(decisionData.verdict),
      },
      { field: "score", label: "得点", before: prevScore, after: newScore },
      // 類型は類型評価の確定（前か後のどちらか）にだけ記録する。点の設問に空の差分を並べない
      ...(previous?.scaleLevel || scaleLevel
        ? [
            {
              field: "scaleLevel",
              label: "類型",
              before: previous?.scaleLevel?.label ?? null,
              after: scaleLevel?.label ?? null,
            },
          ]
        : []),
    ],
    targets,
  })

  return decision
}

/**
 * 試験の全確定スコアを取得する。
 *
 * 行を作るのはこの関数なので、Decimal→number と判定の絞り込みもここで済ませる
 * （`toSerializedScoreDecision`）。
 */
export const getScoreDecisionsForExam = async (examId: string) => {
  const decisions = await prisma.scoreDecision.findMany({
    where: {
      cropRegion: {
        examPage: { examId },
      },
    },
    include: {
      decidedBy: { omit: PUBLIC_USER_OMIT },
      // 類型評価の点は確定した類型の点数から引く
      scaleLevel: true,
    },
  })
  return decisions.map(toSerializedScoreDecision)
}
