import type {
  CropRegionWithProjectPage,
  PageImageWithProjectStudents,
  QuestionProgress,
  ScoringDataRecord,
} from "@/components/projects/07-score-at-once/hooks/scoring-data/types/scoring-data-types"

/**
 * 設問別進捗を計算する関数
 */
export function calculateQuestionProgress(
  cropRegions: CropRegionWithProjectPage[],
  pageImages: PageImageWithProjectStudents[],
  scoringData: ScoringDataRecord,
): QuestionProgress {
  const progress: QuestionProgress = {}

  cropRegions.forEach((cropRegion) => {
    // このCropRegionが属するProjectPageのページ番号を取得
    const cropRegionPageNumber = cropRegion.projectPage?.pageNumber

    // 同じページ番号のPageImageのみを対象とする
    const relevantPageImages = pageImages.filter(
      (pageImage) => pageImage.projectPage?.pageNumber === cropRegionPageNumber,
    )

    const totalAnswers = relevantPageImages.length
    let gradedAnswers = 0

    relevantPageImages.forEach((pageImage) => {
      const key = `${pageImage.studentId}-${cropRegion.id}`
      const scoreData = scoringData[key]

      // 採点済みの状態をチェック（unscoredでない場合は採点済み）
      if (scoreData && scoreData.status !== "unscored") {
        gradedAnswers++
      }
    })

    const percentage =
      totalAnswers > 0 ? Math.round((gradedAnswers / totalAnswers) * 100) : 0

    progress[cropRegion.id] = {
      totalAnswers,
      gradedAnswers,
      percentage,
    }
  })

  return progress
}
