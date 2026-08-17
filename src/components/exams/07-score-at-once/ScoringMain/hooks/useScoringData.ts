import { useQuery } from "@tanstack/react-query"
import { useCallback } from "react"

import { useBatchScoring } from "@/components/exams/07-score-at-once/ScoringData/hooks/useBatchScoring"
import type {
  CropRegionWithExamPage,
  StudentAnswerImageWithExamStudents,
} from "@/components/exams/07-score-at-once/ScoringData/types"
import { calculateQuestionProgress } from "@/components/exams/07-score-at-once/ScoringData/utils/progressCalculator"
import { questionScoresForExamQuery } from "@/queries/scoring"
import type { SerializedQuestionScore } from "@/types/prismaExtensions"

interface UseScoringDataProps {
  examId: string
  currentUserId: string | null
  currentCropRegionId: string | null
  studentAnswerImages: StudentAnswerImageWithExamStudents[]
  cropRegions: CropRegionWithExamPage[]
}

/** 未取得のときに毎回新しい配列を作らないための空値 */
const EMPTY_QUESTION_SCORES: SerializedQuestionScore[] = []

/**
 * 採点データの取得・一括採点・進捗計算を統合的に管理するフック。
 *
 * 採点行はキャッシュが持つ。以前は取得した配列を state へ写して楽観更新して
 * いたが、DB の姿と手元の姿が2つある状態になり、他の教員の書き込みや失敗した
 * 書き込みのたびにどちらが正かが分からなくなっていた。
 */
export function useScoringData({
  examId,
  currentUserId,
  currentCropRegionId,
  studentAnswerImages,
  cropRegions,
}: UseScoringDataProps) {
  // ログインしている利用者の採点だけを取る（採点は利用者ごとに別の行）
  const { data: questionScores = EMPTY_QUESTION_SCORES } = useQuery({
    ...questionScoresForExamQuery(examId, currentUserId ?? undefined),
    enabled: Boolean(examId),
  })

  const { handleBatchScore } = useBatchScoring({
    examId,
    studentAnswerImages,
    cropRegions,
    currentCropRegionId,
    currentUserId,
    questionScores,
  })

  const calculateQuestionProgressCallback = useCallback(
    () =>
      calculateQuestionProgress(
        cropRegions,
        studentAnswerImages,
        questionScores
      ),
    [studentAnswerImages, cropRegions, questionScores]
  )

  return {
    questionScores,
    handleBatchScore,
    calculateQuestionProgress: calculateQuestionProgressCallback,
  }
}
