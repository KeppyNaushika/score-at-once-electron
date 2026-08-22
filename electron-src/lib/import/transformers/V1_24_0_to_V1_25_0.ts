/**
 * v1.24.0 → v1.25.0 変換器
 *
 * ScoreDecision.sourceQuestionScoreId（採用元の提案）を廃止した。
 *
 * 確定は「このセルの結果はこれだ」を決める操作で、誰の採点結果を採用したのかは
 * そもそも決まらない。2人が同じ「正答」を付けていたら、どちらを採ったのか・
 * 両方なのかは記録のしようがない。保存すべきは採点結果であって由来ではないので、
 * 列ごと落とした。確定は verdict / score / comment / decidedByUserId で完結する。
 *
 * 旧アーカイブの確定行から採用元を読み捨てる。採用元に紐づけて印刷していた
 * 手書き注釈は、取り込み後はそのセルの注釈をすべて表示する。
 *
 * キーが無い現行形式に対しては無変更で冪等。
 */

import type {
  ArchiveScoresData,
  ExamArchiveData,
  ExamArchiveVersion,
  ExamTransformResult,
  ExamVersionTransformer,
} from "../../../../src/types/examArchive.types"

type ArchiveScoreDecision = NonNullable<
  ArchiveScoresData["scoreDecisions"]
>[number]

/**
 * 旧キーを落とす。引数の型で旧キーを optional として名乗ることで、
 * 現行形式（旧キーの無い型）の行もそのまま渡せる。`as` は要らない。
 */
const dropSourceQuestionScoreId = (
  scoreDecision: ArchiveScoreDecision & { sourceQuestionScoreId?: unknown }
): { scoreDecision: ArchiveScoreDecision; hadSource: boolean } => {
  const { sourceQuestionScoreId, ...rest } = scoreDecision
  return {
    scoreDecision: rest,
    hadSource: typeof sourceQuestionScoreId === "string",
  }
}

export class V1_24_0_to_V1_25_0_Transformer implements ExamVersionTransformer {
  readonly fromVersion: ExamArchiveVersion = "1.24.0"
  readonly toVersion: ExamArchiveVersion = "1.25.0"

  transform(data: ExamArchiveData): ExamTransformResult {
    const warnings: string[] = []
    const { scoreDecisions } = data.scoresData

    // 確定セクションを持たない旧アーカイブ（v1.13.0 未満）は無いままにする
    // （空配列を足すと「確定を1件も持たないアーカイブ」と区別がつかなくなる）
    const stripped = scoreDecisions?.map(dropSourceQuestionScoreId)
    const sourcedCount = (stripped ?? []).filter(
      (result) => result.hadSource
    ).length

    if (sourcedCount > 0) {
      warnings.push(
        `1.24.0→1.25.0: 確定${sourcedCount}件が採用元の採点データを指していましたが、採用元は保持しません。確定の判定・得点はそのまま取り込み、手書きの採点マークはそのセルのものをすべて表示します。`
      )
    }

    return {
      data: {
        ...data,
        manifest: { ...data.manifest, version: this.toVersion },
        scoresData: {
          ...data.scoresData,
          scoreDecisions: stripped?.map((result) => result.scoreDecision),
        },
      },
      warnings,
    }
  }
}
