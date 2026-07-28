/**
 * v1.20.0 → v1.21.0 変換器
 *
 * 主な変更点:
 * - 採点層を Student 直結から ExamStudent（試験の受験者）経由へ配線変更。
 *   `studentAnswerImages` / `questionScores` / `scoreDecisions` /
 *   `compoundAnswerScores` / `returnSnapshots` の `studentId` を `examStudentId` にする。
 * - `ReturnSnapshot.examId` は ExamStudent が持つため削除する。
 *
 * これまでの「新規フィールドをデフォルト値で埋める」型ではなく、アーカイブ内の
 * `examStudents` を引いて studentId → examStudentId を解決する型の変換器である。
 *
 * 受験者として登録されていない生徒の採点行（孤児）は解決できない。これは DB 側の
 * マイグレーションと同じく**破棄**し、件数を警告に載せる。孤児は「本来存在しないはず
 * だったもの」であり、復元すべき正本の姿は削除確認ダイアログが約束したとおりの状態
 * （生徒を試験から外せば採点も消える）である。
 */

import type {
  ExamArchiveData,
  ExamArchiveVersion,
  ExamTransformResult,
  ExamVersionTransformer,
} from "../../../../src/types/examArchive.types"

/** 旧行から studentId を取り出す（`in` と typeof の型ガードで、`as` を使わない） */
const legacyStudentIdOf = (row: object): string | null =>
  "studentId" in row && typeof row.studentId === "string" ? row.studentId : null

/**
 * studentId / examId（ReturnSnapshot のみが持つ）を落とした残りを返す。
 * これらは ExamStudent が持つので、付け替え後の行には残さない。
 */
const withoutLegacyKeys = (row: object): Record<string, unknown> =>
  Object.fromEntries(
    Object.entries(row).filter(
      ([key]) => key !== "studentId" && key !== "examId"
    )
  )

/**
 * studentId で引ける旧レコードから examStudentId 付きの新レコードを作る。
 *
 * 入力は「到達時点の実形状」（旧キー）、返り値は最新版の行型。同じ配列の別バージョンの
 * 姿であり TypeScript では両立を表現できないため、**この 1 行だけ**が版の境界になる。
 * ここを型で追えないぶん、変換結果は examTransformerChain.test.ts で固定している。
 *
 * 既に examStudentId を持つ行はそのまま通す（冪等）。版数を過少申告するアーカイブが
 * 届いても、変換済みの採点行を孤児として全部捨てないため
 * （transformers/index.ts の「引き下げ先以降の変換器は可能な限り冪等に」に従う）。
 */
const rekey = <T>(
  rows: readonly object[] | undefined,
  examStudentIdByStudentId: Map<string, string>
): { rekeyed: T[]; dropped: number } => {
  const rekeyed: T[] = []
  let dropped = 0
  for (const row of rows ?? []) {
    // 変換済みの行は触らない（旧キーが無いだけで孤児ではない）
    if ("examStudentId" in row) {
      rekeyed.push(row as T)
      continue
    }
    const studentId = legacyStudentIdOf(row)
    const examStudentId = studentId
      ? examStudentIdByStudentId.get(studentId)
      : undefined
    if (!examStudentId) {
      dropped++
      continue
    }
    rekeyed.push({ ...withoutLegacyKeys(row), examStudentId } as T)
  }
  return { rekeyed, dropped }
}

type ExamDataOf = ExamArchiveData["examData"]
type ScoresDataOf = ExamArchiveData["scoresData"]

export class V1_20_0_to_V1_21_0_Transformer implements ExamVersionTransformer {
  readonly fromVersion: ExamArchiveVersion = "1.20.0"
  readonly toVersion: ExamArchiveVersion = "1.21.0"

  transform(data: ExamArchiveData): ExamTransformResult {
    // アーカイブ内の受験者一覧から studentId → examStudentId を引けるようにする。
    // examStudents は 1.0.0 から同梱されており、(examId, studentId) は一意。
    const examStudentIdByStudentId = new Map<string, string>()
    for (const examStudent of data.examData.examStudents ?? []) {
      examStudentIdByStudentId.set(examStudent.studentId, examStudent.id)
    }

    const answerImages = rekey<
      NonNullable<ExamDataOf["studentAnswerImages"]>[number]
    >(data.examData.studentAnswerImages, examStudentIdByStudentId)
    const compoundScores = rekey<
      NonNullable<ExamDataOf["compoundAnswerScores"]>[number]
    >(data.examData.compoundAnswerScores, examStudentIdByStudentId)
    const questionScores = rekey<ScoresDataOf["questionScores"][number]>(
      data.scoresData.questionScores,
      examStudentIdByStudentId
    )
    const scoreDecisions = rekey<
      NonNullable<ScoresDataOf["scoreDecisions"]>[number]
    >(data.scoresData.scoreDecisions, examStudentIdByStudentId)
    // ReturnSnapshot は examId も持っていたが、ExamStudent 経由で辿れるので落とす
    const returnSnapshots = rekey<
      NonNullable<ScoresDataOf["returnSnapshots"]>[number]
    >(data.scoresData.returnSnapshots, examStudentIdByStudentId)

    // 破棄された採点行に紐づく手書き注釈も道連れにする（親を失った注釈は復元できない）
    const survivingQuestionScoreIds = new Set(
      questionScores.rekeyed.map((questionScore) => questionScore.id)
    )
    const drawingAnnotations = (
      data.scoresData.drawingAnnotations ?? []
    ).filter((annotation) =>
      survivingQuestionScoreIds.has(annotation.questionScoreId)
    )
    const droppedAnnotations =
      (data.scoresData.drawingAnnotations ?? []).length -
      drawingAnnotations.length

    const droppedTotal =
      answerImages.dropped +
      compoundScores.dropped +
      questionScores.dropped +
      scoreDecisions.dropped +
      returnSnapshots.dropped

    // 採点データが1行も無いアーカイブでは実質何も起きないので黙って通す
    const rekeyedTotal =
      answerImages.rekeyed.length +
      compoundScores.rekeyed.length +
      questionScores.rekeyed.length +
      scoreDecisions.rekeyed.length +
      returnSnapshots.rekeyed.length

    const warnings: string[] = []
    if (rekeyedTotal > 0) {
      warnings.push(
        `1.20.0→1.21.0: 採点データ ${rekeyedTotal} 件を受験者（ExamStudent）経由へ付け替えました。`
      )
    }
    if (droppedTotal > 0) {
      warnings.push(
        `1.20.0→1.21.0: 受験者として登録されていない生徒の採点データ ${droppedTotal} 件を破棄しました` +
          `（答案 ${answerImages.dropped} / 採点 ${questionScores.dropped} / 確定 ${scoreDecisions.dropped} /` +
          ` 複合回答 ${compoundScores.dropped} / 返却版 ${returnSnapshots.dropped}` +
          `${droppedAnnotations > 0 ? ` / 手書き注釈 ${droppedAnnotations}` : ""}）。`
      )
    }

    return {
      data: {
        ...data,
        manifest: { ...data.manifest, version: this.toVersion },
        examData: {
          ...data.examData,
          studentAnswerImages: answerImages.rekeyed,
          compoundAnswerScores: compoundScores.rekeyed,
        },
        scoresData: {
          ...data.scoresData,
          questionScores: questionScores.rekeyed,
          drawingAnnotations,
          scoreDecisions: scoreDecisions.rekeyed,
          returnSnapshots: returnSnapshots.rekeyed,
        },
      },
      warnings,
    }
  }
}
