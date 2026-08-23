/**
 * 試験ステータス判定の共通ユーティリティ
 *
 * 試験一覧と詳細ページで統一されたステータス判定を提供
 */

import type { Exam, Tag } from "@prisma/client"

/**
 * 進捗計算 getExamProgress が読む最小入力形。
 * 一覧（fetch-exams-summary が返す軽量データ）と詳細（ExamForDetail）の双方がこれを満たすため、
 * 進捗計算は renderer の getExamProgress ただ1本に統合できる（main 側の二重実装を持たない）。
 * partialScore は IPC 越しに number へシリアライズ済み（null 判定のみに使用）。
 */
export interface ExamProgressSource {
  /** 模範解答ページ（件数のみ hasImages 判定に使用） */
  examPages: unknown[]
  /** 平坦化済み採点領域（type と採点状況、確定） */
  cropRegions?: {
    type: string
    /**
     * 採点者ごとの提案。**更新時刻まで持つ**のは「8. 採点確定」が済んだかを
     * 判定するため（{@link getExamProgress}）。確定より新しい提案が入っていたら、
     * 確定はもう一度見直す必要がある。
     */
    questionScores: {
      status: string
      examStudentId: string
      partialScore: number | null
      updatedAt: Date
    }[]
    /** この設問の確定（生徒×設問ごとに高々1件） */
    scoreDecisions: { examStudentId: string; decidedAt: Date }[]
  }[]
  /** 平坦化済み答案画像 */
  answerImages?: { examStudentId: string }[]
  examStudents: { id: string; status: string }[]
  examSubtotalGroups: { id: string }[]
}

// 詳細な試験進捗情報
interface ExamProgress {
  hasImages: boolean
  hasLayout: boolean
  hasRegionInfo: boolean
  hasSubtotalRegions: boolean
  hasSubtotalGroupSetting: boolean
  hasStudents: boolean
  hasAnswers: boolean
  hasScoring: boolean
  hasFinalizedScores: boolean
  /** まだ裁定が要るマスの数（食い違い＋確定より新しい提案） */
  pendingDecisionCount: number
  expectedScoringCount: number
  actualScoringCount: number
  questionAnswerCount: number
  answerSheetCount: number
}

/**
 * 試験の詳細進捗情報を計算
 */
export function getExamProgress(exam: ExamProgressSource): ExamProgress {
  // 入力形を信頼し、基本的な存在チェックのみ実施
  if (!exam) {
    return {
      hasImages: false,
      hasLayout: false,
      hasRegionInfo: false,
      hasSubtotalRegions: false,
      hasSubtotalGroupSetting: false,
      hasStudents: false,
      hasAnswers: false,
      hasScoring: false,
      // 採点行が無ければ食い違いも起きない（裁定すべきものが無い＝済み）
      hasFinalizedScores: true,
      pendingDecisionCount: 0,
      expectedScoringCount: 0,
      actualScoringCount: 0,
      questionAnswerCount: 0,
      answerSheetCount: 0,
    }
  }

  const hasImages = !!(exam.examPages && exam.examPages.length > 0)
  const hasLayout = !!(exam.cropRegions && exam.cropRegions.length > 0)
  const hasRegionInfo = hasLayout // 領域情報は領域が存在すれば設定済みとみなす

  // 小計点領域が存在するかチェック
  const hasSubtotalRegions =
    exam.cropRegions?.some((region) => region.type === "SUBTOTAL_SCORE") ||
    false

  // 小計点設定が完了しているかチェック（小計点領域がある場合のみ）
  const hasSubtotalGroupSetting = !!(
    !hasSubtotalRegions ||
    (exam.examSubtotalGroups && exam.examSubtotalGroups.length > 0)
  )

  const hasStudents = !!(exam.examStudents && exam.examStudents.length > 0)
  const hasAnswers = !!(exam.answerImages && exam.answerImages.length > 0)

  // 採点完了の精密な判定
  // QUESTION_ANSWER領域数 × 答案数 = 全採点すべき数
  const questionAnswerCount =
    exam.cropRegions?.filter((region) => region.type === "QUESTION_ANSWER")
      .length || 0

  /**
   * 採点の対象になる受験者（複数ページの答案でも1人1回のみ）。
   *
   * **答案画像があるかどうかだけで決める。在籍の状態は見ない。**
   *
   * 07 は答案が上がっていれば誰の答案でも採点させる（`getStudentAnswersByExamId`
   * は状態で絞らない）。ここで欠席を外すと、**採点できるのに数えない**マスが生まれ、
   * 概要が「確定 済み」と言う一方で 08 の画面は「要裁定」と言う食い違いになる。
   *
   * 「欠席」は答案を上げるときに飛ばした結果として付くもので、**採点できるか**の
   * 答えは画像の有無そのものである。状態が効くのは出力の側 —— 誰を出すか（09 の
   * 生徒選択）と、平均や分布に混ぜるか（箱ひげ図・R-Exametrika）——であって、
   * 採点の作業ではない。
   */
  const scorableExamStudentIds = [
    ...new Set(
      exam.answerImages?.map((answerImage) => answerImage.examStudentId)
    ),
  ]

  const answerSheetCount = scorableExamStudentIds.length

  const expectedScoringCount = questionAnswerCount * answerSheetCount

  // 採点対象の受験者の、採点済みQuestionScore。
  // 分母（expectedScoringCount）と同じ受験者集合で数えないと、分子が分母を超えて
  // 進捗が100%を超える。
  // partial/pending は partialScore が入力済みの場合のみ採点済みとする。
  const actualScoringCount =
    exam.cropRegions
      ?.filter(
        (cropRegion) =>
          cropRegion.type === "QUESTION_ANSWER" && cropRegion.questionScores
      )
      .flatMap((cropRegion) => cropRegion.questionScores)
      .filter(
        (questionScore) =>
          questionScore.status !== "unscored" &&
          scorableExamStudentIds.includes(questionScore.examStudentId) &&
          !(
            (questionScore.status === "partial" ||
              questionScore.status === "pending") &&
            questionScore.partialScore === null
          )
      ).length ?? 0

  const hasScoring =
    expectedScoringCount > 0 && actualScoringCount >= expectedScoringCount

  const pendingDecisionCount = countPendingDecisions(
    exam.cropRegions ?? [],
    scorableExamStudentIds
  )

  return {
    hasImages,
    hasLayout,
    hasRegionInfo,
    hasSubtotalRegions,
    hasSubtotalGroupSetting,
    hasStudents,
    hasAnswers,
    hasScoring,
    hasFinalizedScores: pendingDecisionCount === 0,
    pendingDecisionCount,
    expectedScoringCount,
    actualScoringCount,
    questionAnswerCount,
    answerSheetCount,
  }
}

/** 進捗計算が読む採点領域1つぶん */
type ProgressCropRegion = NonNullable<ExamProgressSource["cropRegions"]>[number]

/**
 * まだ裁定が要るマスを数える ——「8. 採点確定」が済んだかの判定。
 *
 * 確定が要るのは**採点者どうしが食い違ったマス**だけで、そこに確定
 * （ScoreDecision）が入っていれば済み。採点者が1人の試験では食い違いが構造的に
 * 起きないので常に0になる ——「一生満たされない条件」で足を止めない。
 *
 * 食い違いの規則は出力側のリゾルバ（`scoreResolution.ts`）と同じにする:
 *
 * - `unscored` は採点の意思表示ではないので数に入れない
 * - 残った提案の**判定と部分点が全行一致していれば合意**（採点者が何人いても済み）。
 *   採点者ごとに1行なので、1人で使っている試験はここで必ず解決する
 * - 一致しなければ食い違い。確定があれば解消
 * - 確定より後に入った提案があるマスは、確定していても未裁定に戻す（stale）。
 *   確定したあとで誰かが採点し直したなら、もう一度見る必要がある
 *
 * **リゾルバそのものは通さない。** あれは行の全列（id・updatedAt・comment…）が
 * 揃った `SerializedQuestionScore` を要求する集計・出力用で、一覧の全試験ぶんの
 * 採点行をその形で運ぶことになる。ここで要るのは「残っているか」の一問だけ。
 */
function countPendingDecisions(
  cropRegions: ProgressCropRegion[],
  scorableExamStudentIds: string[]
): number {
  const scorableIdSet = new Set(scorableExamStudentIds)

  return cropRegions
    .filter((cropRegion) => cropRegion.type === "QUESTION_ANSWER")
    .reduce((pendingCount, cropRegion) => {
      const decidedAtByExamStudentId = new Map(
        cropRegion.scoreDecisions.map((scoreDecision) => [
          scoreDecision.examStudentId,
          scoreDecision.decidedAt,
        ])
      )

      /** 受験者 → そのマスに入った提案（unscored を除く） */
      const proposalsByExamStudentId = new Map<
        string,
        ProgressCropRegion["questionScores"]
      >()
      cropRegion.questionScores.forEach((questionScore) => {
        if (questionScore.status === "unscored") return
        if (!scorableIdSet.has(questionScore.examStudentId)) return
        const proposals = proposalsByExamStudentId.get(
          questionScore.examStudentId
        )
        if (proposals) {
          proposals.push(questionScore)
        } else {
          proposalsByExamStudentId.set(questionScore.examStudentId, [
            questionScore,
          ])
        }
      })

      return (
        pendingCount +
        [...proposalsByExamStudentId].filter(([examStudentId, proposals]) => {
          const decidedAt = decidedAtByExamStudentId.get(examStudentId)
          if (decidedAt) {
            // 確定より新しい提案があるなら、確定を見直す必要がある
            return proposals.some(
              (proposal) => proposal.updatedAt.getTime() > decidedAt.getTime()
            )
          }
          const [first] = proposals
          return proposals.some(
            (proposal) =>
              proposal.status !== first.status ||
              proposal.partialScore !== first.partialScore
          )
        }).length
      )
    }, 0)
}

/**
 * 試験一覧の「次のステップ」表示（9段階ワークフローの現在地）。
 * 表示文言・遷移 URL・着手可否という presentation 情報であり、renderer 側で導出する。
 */
interface ExamWorkflowStatus {
  step: number
  action: string
  text: string
  url: string
  isCompleted: boolean
  canStart: boolean
}

/**
 * ExamProgress（DB 事実）から一覧の「次のステップ」表示を導出する。
 * 表示文言・renderer のルート URL を含むため、main ではなく renderer 側の唯一の実装とする。
 */
export function getExamWorkflowStatus(
  progress: ExamProgress,
  examId: string
): ExamWorkflowStatus {
  const {
    hasImages,
    hasLayout,
    hasRegionInfo,
    hasSubtotalGroupSetting,
    hasStudents,
    hasAnswers,
    hasScoring,
    hasFinalizedScores,
  } = progress

  if (!hasImages)
    return {
      step: 1,
      action: "upload",
      text: "模範解答画像の管理",
      url: `/exams/${examId}/01-upload`,
      isCompleted: false,
      canStart: true,
    }
  if (!hasLayout)
    return {
      step: 2,
      action: "template",
      text: "答案の採点領域作成",
      url: `/exams/${examId}/02-template`,
      isCompleted: false,
      canStart: hasImages,
    }
  if (!hasRegionInfo)
    return {
      step: 3,
      action: "region-info",
      text: "採点領域の詳細情報設定",
      url: `/exams/${examId}/03-region-info`,
      isCompleted: false,
      canStart: hasLayout,
    }
  if (!hasSubtotalGroupSetting)
    return {
      step: 4,
      action: "question-group",
      text: "小計点の設定",
      url: `/exams/${examId}/04-question-group`,
      isCompleted: false,
      canStart: hasRegionInfo,
    }
  if (!hasStudents)
    return {
      step: 5,
      action: "students",
      text: "受験生徒の管理",
      url: `/exams/${examId}/05-students`,
      isCompleted: false,
      canStart: hasSubtotalGroupSetting,
    }
  if (!hasAnswers)
    return {
      step: 6,
      action: "student-answers",
      text: "生徒答案の追加と関連付け",
      url: `/exams/${examId}/06-student-answers`,
      isCompleted: false,
      canStart: hasStudents,
    }
  if (!hasScoring)
    return {
      step: 7,
      action: "score-at-once",
      text: "一括採点",
      url: `/exams/${examId}/07-score-at-once`,
      isCompleted: false,
      canStart: hasAnswers && hasRegionInfo,
    }

  /**
   * 採点まで済んだら、裁定が残っていれば「8. 採点確定」、無ければ「9. 結果」。
   *
   * **確定を梯子の段にできるのは、残っているかを DB の事実だけで言えるから。**
   * 食い違ったマスに確定が入っているかを数えるだけなので（`countPendingDecisions`）、
   * 採点者が1人の試験では常に0件になり、ここで足が止まることはない。
   * かつてこの段を梯子から外していたのは、進捗の元データに採点者（userId）も
   * 確定も載っていなかったためで、載せた今はその理由が消えている。
   */
  if (!hasFinalizedScores)
    return {
      step: 8,
      action: "finalize",
      text: "採点の割り当てと確定",
      url: `/exams/${examId}/08-finalize`,
      isCompleted: false,
      canStart: hasScoring,
    }

  return {
    step: 9,
    action: "export",
    text: "採点結果のファイル出力",
    url: `/exams/${examId}/09-export`,
    isCompleted: false,
    canStart: hasScoring,
  }
}

/**
 * 試験一覧の読み取りモデル（fetch-exams-summary の要素）。
 * 表示フィールドは Exam に追随（Prisma 派生）し、進捗の元データ（ExamProgressSource）を同梱する。
 * 進捗・「次のステップ」表示はいずれも renderer で導出する
 * （getExamProgress → getExamWorkflowStatus。main 側では計算しない）。
 */
export type ExamSummary = Pick<
  Exam,
  | "id"
  | "examName"
  | "referenceDate"
  | "description"
  | "createdAt"
  | "updatedAt"
> & {
  tags: Pick<Tag, "id" | "name" | "color">[]
} & ExamProgressSource
