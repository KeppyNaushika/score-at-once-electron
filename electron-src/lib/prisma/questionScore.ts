/**
 * 採点行（QuestionScore）の読み取りと、シリアライズ後の形への境界コンバータ。
 *
 * 採点の書き込みは `questionScoreWrite.ts`、覚え書きは `questionScoreComment.ts` にある。
 */

import type { QuestionScore } from "@prisma/client"

import type { Serialized } from "@/types/prismaExtensions"
import {
  type ScoringStatus,
  toScoringStatus,
} from "@/types/scoringStatus.types"

import prisma from "./client"
import { PUBLIC_USER_OMIT } from "./publicUser"
import { serializePrisma } from "./serializePrisma"

/**
 * 採点行を「シリアライズ後の形」へ倒す境界コンバータ。
 *
 * `partialScore`（Decimal）を number へ、`status`（DB 上は String 列）を
 * `ScoringStatus` へ絞る。**この2点の補正を行うのはここ1箇所**で、
 * 型の側の相棒は `SerializedQuestionScore`（types/prismaExtensions.ts）。
 * 同梱したリレーションは落とさずそのまま持つ（射影しない）。
 */
export const toSerializedQuestionScore = <
  Row extends Omit<QuestionScore, "status"> & { status: string },
>(
  questionScore: Row
): Serialized<Row> & { status: ScoringStatus } => ({
  ...serializePrisma(questionScore),
  status: toScoringStatus(questionScore.status),
})

/**
 * 試験の採点データを取得
 *
 * 行を作るのはこの関数なので、Decimal→number と判定の絞り込みもここで済ませる
 * （`toSerializedQuestionScore`）。呼ぶ側（出力・PDF・返却差分・確定リゾルバ）は
 * `SerializedQuestionScore` として受け取れる。
 *
 * @param examId 試験ID
 * @param userId 採点者のユーザーID（指定時はそのユーザーの採点データのみ取得）
 */
export const getQuestionScoresForExam = async (
  examId: string,
  userId?: string
) => {
  try {
    const scores = await prisma.questionScore.findMany({
      where: {
        cropRegion: {
          examPage: {
            examId,
          },
        },
        // userIdが指定されている場合、そのユーザーの採点データのみ取得
        ...(userId && { userId: userId }),
      },
      include: {
        examStudent: { include: { student: true } },
        cropRegion: {
          include: {
            examPage: true,
          },
        },
        user: { omit: PUBLIC_USER_OMIT },
      },
      orderBy: [
        { examStudent: { student: { lastName: "asc" } } },
        { examStudent: { student: { firstName: "asc" } } },
        { cropRegion: { orderIndex: "asc" } },
      ],
    })

    return scores.map(toSerializedQuestionScore)
  } catch (error) {
    console.error("Failed to get question scores for exam:", error)
    throw error
  }
}

/**
 * その設問の採点行を取る（採点者を問わない）。
 *
 * **採点画面が読む単位。** 採点は「その設問のそのマス」に書くので、書き込みで古くなるのも
 * この単位になる。試験ぶんをまとめて1つのキーに載せていた頃は、1マス採点するたびに
 * **試験ぜんぶの採点行**を取り直していた。
 *
 * `getQuestionScoresForExam` と違い**リレーションを同梱しない**。呼ぶのは採点画面で、
 * 受験者も設問も画面が既に持っている（同梱すると1行あたり4段の木が付いてくる）。
 *
 * 採点者で絞らないのは、絞るのが画面の仕事だから。07 は自分の採点だけを出すが、
 * 誰の採点かで別のキーにすると、同じ行が採点者の数だけキャッシュに載る。
 */
export const getQuestionScoresByCropRegion = async (cropRegionId: string) => {
  const scores = await prisma.questionScore.findMany({
    where: { cropRegionId },
    orderBy: { id: "asc" },
  })
  return scores.map(toSerializedQuestionScore)
}
