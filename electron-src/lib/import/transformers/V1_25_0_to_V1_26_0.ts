/**
 * v1.25.0 → v1.26.0 変換器
 *
 * QuestionScore.comment（その採点者がその点にした理由の覚え書き）を追加した。
 *
 * 確定（ScoreDecision.comment）は前から書けたが、確定は1セル1行なので
 * 「誰が、なぜその点を付けたか」は書けない。部分点の理由はその採点者のもので、
 * 粒度は (受験者, 設問, 採点者) ＝ QuestionScore と一致する。
 *
 * 列は NULL を持たない（DrawingAnnotation.text と同じ形）ので、旧アーカイブの
 * 採点行には空文字を補う。**警告は出さない** — 旧版は覚え書きを書ける画面が
 * 無かったので、失われた覚え書きというものが存在しない。
 *
 * 既に文字列が入っている行はそのまま残すので冪等。
 */

import type {
  ArchiveScoresData,
  ExamArchiveData,
  ExamArchiveVersion,
  ExamTransformResult,
  ExamVersionTransformer,
} from "../../../../src/types/examArchive.types"

type ArchiveQuestionScore = ArchiveScoresData["questionScores"][number]

/**
 * 覚え書きを補う。引数の型で `comment` を「文字列か、まだ無いか」として名乗ることで、
 * 旧形式の行も現行形式の行も同じ関数へ渡せる（`as` は要らない）。
 */
const fillComment = (
  questionScore: Omit<ArchiveQuestionScore, "comment"> & { comment?: unknown }
): ArchiveQuestionScore => ({
  ...questionScore,
  comment:
    typeof questionScore.comment === "string" ? questionScore.comment : "",
})

export class V1_25_0_to_V1_26_0_Transformer implements ExamVersionTransformer {
  readonly fromVersion: ExamArchiveVersion = "1.25.0"
  readonly toVersion: ExamArchiveVersion = "1.26.0"

  transform(data: ExamArchiveData): ExamTransformResult {
    return {
      data: {
        ...data,
        manifest: { ...data.manifest, version: this.toVersion },
        scoresData: {
          ...data.scoresData,
          questionScores: data.scoresData.questionScores.map(fillComment),
        },
      },
      warnings: [],
    }
  }
}
