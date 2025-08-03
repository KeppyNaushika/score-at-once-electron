import type {
  CropRegionWithProjectPage,
  PageImageWithProjectStudents,
  QuestionProgress,
} from "@/components/projects/07-score-at-once/ScoringData/types/scoring-data-types"
import {
  findQuestionScore,
  type QuestionScore,
} from "@/components/projects/07-score-at-once/types"

/**
 * 設問別進捗を計算する関数
 */
export function calculateQuestionProgress(
  cropRegions: CropRegionWithProjectPage[],
  pageImages: PageImageWithProjectStudents[],
  questionScores: QuestionScore[],
): QuestionProgress {
  const progress: QuestionProgress = {}

  // デバッグ情報を追加
  console.log("=== calculateQuestionProgress DEBUG START ===")
  console.log("Input data overview:", {
    cropRegionsLength: cropRegions?.length || 0,
    pageImagesLength: pageImages?.length || 0,
    questionScoresLength: questionScores?.length || 0,
  })

  console.log(
    "CropRegions details:",
    cropRegions?.map((cr, index) => ({
      index,
      id: cr.id,
      label: cr.label,
      type: cr.type,
      orderIndex: cr.orderIndex,
      pageNumber: cr.projectPage?.pageNumber,
      projectPageId: cr.projectPageId,
      projectPage: cr.projectPage
        ? {
            id: cr.projectPage.id,
            pageNumber: cr.projectPage.pageNumber,
          }
        : null,
    })),
  )

  console.log(
    "PageImages details:",
    pageImages?.slice(0, 5).map((pi, index) => ({
      index,
      id: pi.id,
      studentId: pi.studentId,
      pageNumber: pi.projectPage?.pageNumber,
      projectPageId: pi.projectPageId,
      projectPage: pi.projectPage
        ? {
            id: pi.projectPage.id,
            pageNumber: pi.projectPage.pageNumber,
          }
        : null,
      student: pi.student
        ? {
            id: pi.student.id,
            studentId: pi.student.studentId,
            name: `${pi.student.lastName} ${pi.student.firstName}`,
          }
        : null,
    })),
  )

  console.log(
    "QuestionScores sample:",
    questionScores?.slice(0, 5).map((score, index) => ({
      index,
      id: score.id,
      studentId: score.studentId,
      cropRegionId: score.cropRegionId,
      status: score.status,
      partialScore: score.partialScore,
    })),
  )

  cropRegions.forEach((cropRegion, cropRegionIndex) => {
    console.log(
      `\n--- Processing CropRegion ${cropRegionIndex}: ${cropRegion.label || cropRegion.id} ---`,
    )

    // このCropRegionが属するProjectPageのID
    const cropRegionProjectPageId = cropRegion.projectPageId
    console.log("CropRegion projectPageId:", cropRegionProjectPageId)

    if (!cropRegionProjectPageId) {
      console.warn("⚠️ CropRegion has no projectPageId:", {
        cropRegionId: cropRegion.id,
        label: cropRegion.label,
        projectPageId: cropRegion.projectPageId,
      })
    }

    // フィルタリング前のPageImages件数
    const totalPageImages = pageImages.length
    console.log("Total PageImages before filtering:", totalPageImages)

    // ProjectPageIDでフィルタリング（正しい方法）
    const samePageImages = pageImages.filter(
      (pageImage) => pageImage.projectPageId === cropRegion.projectPageId,
    )
    console.log("PageImages with same projectPageId:", samePageImages.length)

    // studentIdフィルタリング
    const relevantPageImages = samePageImages.filter(
      (pageImage) => pageImage.studentId,
    )
    console.log("PageImages with valid studentId:", relevantPageImages.length)

    // フィルタリング結果の詳細
    console.log("Filtering breakdown:", {
      totalPageImages,
      samePageCount: samePageImages.length,
      withStudentIdCount: relevantPageImages.length,
      projectPageIdsInData: [
        ...new Set(pageImages.map((pi) => pi.projectPageId)),
      ],
      targetProjectPageId: cropRegion.projectPageId,
    })

    const totalAnswers = relevantPageImages.length
    let gradedAnswers = 0

    console.log("Checking scoring data for each student:")
    relevantPageImages.forEach((pageImage, index) => {
      if (!pageImage.studentId) return // studentIdがnullの場合はスキップ

      const score = findQuestionScore(
        questionScores,
        pageImage.studentId,
        cropRegion.id,
      )
      const isGraded = score && score.status !== "unscored"

      console.log(
        `  Student ${index + 1}: ${pageImage.student?.lastName || "N/A"} ${pageImage.student?.firstName || "N/A"}`,
        {
          studentId: pageImage.studentId,
          cropRegionId: cropRegion.id,
          hasScore: !!score,
          status: score?.status || "No data",
          partialScore: score?.partialScore || null,
          isGraded: isGraded,
        },
      )

      if (isGraded) {
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

    console.log(`✅ Question ${cropRegion.label || cropRegion.id} result:`, {
      totalAnswers,
      gradedAnswers,
      percentage: `${percentage}%`,
      display: `${gradedAnswers}/${totalAnswers}`,
    })
  })

  console.log("=== calculateQuestionProgress DEBUG END ===")
  console.log("Final progress result:", progress)
  console.log(
    "Progress summary:",
    Object.entries(progress).map(([questionId, data]) => ({
      questionId,
      display: `${data.gradedAnswers}/${data.totalAnswers}`,
      percentage: `${data.percentage}%`,
    })),
  )

  // 0/0 の問題がある場合の警告
  const zeroZeroQuestions = Object.entries(progress).filter(
    ([_, data]) => data.totalAnswers === 0 && data.gradedAnswers === 0,
  )

  if (zeroZeroQuestions.length > 0) {
    console.warn(
      "🚨 Found 0/0 progress questions:",
      zeroZeroQuestions.map(([id, data]) => ({
        questionId: id,
        ...data,
      })),
    )
  }

  return progress
}
