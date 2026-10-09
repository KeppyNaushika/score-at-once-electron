import { useMemo } from "react"

import type { WhitenessByAnswerId } from "@/components/exams/07-score-at-once/ScoringMain/hooks/useAnswerWhiteness"
import type {
  AnswerSortOrder,
  GradingMode,
  MasterGridItem,
  ScoringData,
  StudentAnswerImageWithExamStudents,
} from "@/components/exams/07-score-at-once/types"
import { findQuestionScore } from "@/components/exams/07-score-at-once/types"
import { toAppImageUrl } from "@/lib/appImageUrl"
import type { QuestionAnswerRegionRow } from "@/queries/cropRegion"
import type { QuestionScoreRow } from "@/queries/scoring"
import type { ExamWithPages } from "@/types/prismaExtensions"
import { toScoringStatus } from "@/types/scoringStatus.types"

/** 採点行がまだ1つも無い設問のための空値（毎回新しい配列を作らない） */
const EMPTY_SCORES: QuestionScoreRow[] = []

interface UseQuestionScoringDataProps {
  currentCropRegion: QuestionAnswerRegionRow | undefined
  studentAnswerImages: StudentAnswerImageWithExamStudents[]
  questionScoresByCropRegionId: Map<string, QuestionScoreRow[]>
  currentUserId: string
  exam: ExamWithPages | null
  gradingMode: GradingMode
  answerSortOrder: AnswerSortOrder
  whitenessByAnswerId: WhitenessByAnswerId
}

/**
 * 現在の設問の答案一覧（絞り込む前・表示順に並べたもの）と、先頭に置く模範解答
 */
export function useQuestionScoringData({
  currentCropRegion,
  studentAnswerImages,
  questionScoresByCropRegionId,
  currentUserId,
  exam,
  gradingMode,
  answerSortOrder,
  whitenessByAnswerId,
}: UseQuestionScoringDataProps) {
  const allScoringData = useMemo((): ScoringData[] => {
    if (!currentCropRegion) return []

    const pageFilteredSheets = studentAnswerImages.filter(
      (pageImage) => pageImage.examPageId === currentCropRegion.examPageId
    )

    const sortedAnswerSheets = [...pageFilteredSheets].sort(
      (sheetA, sheetB) => {
        const aOrder = sheetA.examStudent.customOrder ?? 999999
        const bOrder = sheetB.examStudent.customOrder ?? 999999

        if (aOrder === bOrder) {
          const studentA = sheetA.examStudent.student
          const studentB = sheetB.examStudent.student
          const aName = `${studentA.lastName}${studentA.firstName}`
          const bName = `${studentB.lastName}${studentB.firstName}`
          return aName.localeCompare(bName, "ja")
        }

        return aOrder - bOrder
      }
    )

    const studentScoringData: ScoringData[] = sortedAnswerSheets.map(
      (pageImage) => {
        const score = findQuestionScore(
          questionScoresByCropRegionId.get(currentCropRegion.id) ??
            EMPTY_SCORES,
          pageImage.examStudentId,
          currentUserId
        )
        const { student } = pageImage.examStudent

        return {
          id: pageImage.id,
          examStudentId: pageImage.examStudentId,
          studentName: `${student.lastName} ${student.firstName}`,
          imageUrl: pageImage.imagePath
            ? toAppImageUrl(pageImage.imagePath)
            : "",
          currentScore:
            score?.partialScore !== undefined && score?.partialScore !== null
              ? Number(score.partialScore)
              : undefined,
          maxScore: currentCropRegion.points ?? 0,
          status: toScoringStatus(score?.status),
          questionRegion: currentCropRegion,
          customOrder: pageImage.examStudent.customOrder ?? 999999,
        }
      }
    )

    // 白さ順・濃さ順（一覧表示のみ）。並べる基準は平均輝度のみで、閾値は持たない
    // （実採点データの「無答」を正解として比較した結果に基づく。
    //   詳細は electron-src/lib/scoring/regionWhiteness.ts の冒頭コメント）。
    // sortは安定なので、輝度が同値の答案は直前の表示順（customOrder）のまま残る。
    // 白さが未算出の答案は、どちらの向きでも末尾へ送る。
    if (
      gradingMode === "grid" &&
      (answerSortOrder === "whiteness" || answerSortOrder === "darkness")
    ) {
      const cropRegionId = currentCropRegion.id
      // 濃さ順は白さ順の逆向き
      const direction = answerSortOrder === "darkness" ? -1 : 1

      studentScoringData.sort((scoringDataA, scoringDataB) => {
        const whitenessA = whitenessByAnswerId
          .get(scoringDataA.id)
          ?.get(cropRegionId)
        const whitenessB = whitenessByAnswerId
          .get(scoringDataB.id)
          ?.get(cropRegionId)

        if (!whitenessA && !whitenessB) return 0
        if (!whitenessA) return 1
        if (!whitenessB) return -1

        return direction * (whitenessB.meanLuminance - whitenessA.meanLuminance)
      })
    }

    return studentScoringData
  }, [
    currentCropRegion,
    questionScoresByCropRegionId,
    studentAnswerImages,
    currentUserId,
    gradingMode,
    answerSortOrder,
    whitenessByAnswerId,
  ])

  const masterAnswerData = useMemo((): MasterGridItem | null => {
    if (!currentCropRegion || !exam?.examPages) return null

    const examPage = exam.examPages.find(
      (page) => page.id === currentCropRegion.examPageId
    )

    if (!examPage) return null

    const masterImagePath = examPage.imagePath

    return {
      id: `master-${currentCropRegion.id}`,
      examStudentId: "MASTER",
      studentName: "模範解答",
      imageUrl: masterImagePath ? toAppImageUrl(masterImagePath) : "",
      maxScore: currentCropRegion.points || 0,
      status: "master",
      questionRegion: currentCropRegion,
      customOrder: -1,
      isMaster: true,
    }
  }, [currentCropRegion, exam])

  return { allScoringData, masterAnswerData }
}
