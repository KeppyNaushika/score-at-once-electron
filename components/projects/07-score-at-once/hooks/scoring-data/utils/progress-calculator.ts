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

  // デバッグ情報を追加
  console.log("calculateQuestionProgress input:", {
    cropRegionsLength: cropRegions?.length || 0,
    pageImagesLength: pageImages?.length || 0,
    scoringDataKeys: Object.keys(scoringData || {}).length,
    cropRegions: cropRegions?.map(cr => ({
      id: cr.id,
      label: cr.label,
      pageNumber: cr.projectPage?.pageNumber
    })),
    pageImages: pageImages?.map(pi => ({
      id: pi.id,
      studentId: pi.studentId,
      pageNumber: pi.projectPage?.pageNumber
    })),
  })

  cropRegions.forEach((cropRegion) => {
    // このCropRegionが属するProjectPageのページ番号を取得
    const cropRegionPageNumber = cropRegion.projectPage?.pageNumber

    // 同じページ番号のPageImageのみを対象とする（studentIdが有効なもののみ）
    const relevantPageImages = pageImages.filter(
      (pageImage) => 
        pageImage.projectPage?.pageNumber === cropRegionPageNumber &&
        pageImage.studentId // studentIdが存在する場合のみ
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

    // 各設問の詳細ログ
    console.log(`Question ${cropRegion.label || cropRegion.id}:`, {
      cropRegionPageNumber,
      relevantPageImagesCount: relevantPageImages.length,
      totalAnswers,
      gradedAnswers,
      percentage,
      keys: relevantPageImages.map(pi => `${pi.studentId}-${cropRegion.id}`),
      scoreDataForKeys: relevantPageImages.map(pi => {
        const key = `${pi.studentId}-${cropRegion.id}`
        return { key, scoreData: scoringData[key] }
      })
    })
  })

  console.log("calculateQuestionProgress result:", progress)
  return progress
}
