export interface QuestionProgress {
  [questionId: string]: {
    totalAnswers: number
    gradedAnswers: number
    /**
     * 確定した採点の件数。gradedAnswers との違いは pending（保留）を数えないことだけ。
     * 保留は「後で見直す」印なので、確定した採点としては扱わない。
     */
    finalizedAnswers: number
    percentage: number
  }
}
