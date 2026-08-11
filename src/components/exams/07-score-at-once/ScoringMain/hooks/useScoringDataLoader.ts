import { useEffect, useState } from "react"
import { toast } from "sonner"

import type { CropRegionWithExamPage } from "@/components/exams/07-score-at-once/types"
import type { ExamWithPages } from "@/types/electron/examApi"
import type { StudentAnswerImageWithExamPageAndStudent } from "@/types/prismaExtensions"

interface ScoringDataLoaderResult {
  loading: boolean
  exam: ExamWithPages | null
  studentAnswerImages: StudentAnswerImageWithExamPageAndStudent[]
  cropRegions: CropRegionWithExamPage[]
  currentUserId: string | null
}

/** 試験・答案・設問領域・ユーザー情報を一括ロードして採点画面の初期データを準備するフック */
export function useScoringDataLoader(
  examId: string,
  authUserId: string | null
): ScoringDataLoaderResult {
  const [loading, setLoading] = useState(true)
  const [exam, setExam] = useState<ExamWithPages | null>(null)
  const [studentAnswerImages, setStudentAnswerImages] = useState<
    StudentAnswerImageWithExamPageAndStudent[]
  >([])
  const [cropRegions, setCropRegions] = useState<CropRegionWithExamPage[]>([])
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true)

        // 試験データの読み込み（スカラー + examPages を1クエリ。重データは別クエリ）
        const examData = await window.electronAPI.getExamWithPages(examId)
        if (!examData) {
          throw new Error("試験が見つかりません")
        }
        setExam(examData)

        // 答案データの読み込み
        setStudentAnswerImages(
          await window.electronAPI.getStudentAnswersByExamId(examId)
        )

        // 設問領域データの読み込み
        const regionsResult =
          await window.electronAPI.getQuestionAnswerRegionsByExamId(examId)
        if (!regionsResult || !Array.isArray(regionsResult)) {
          throw new Error("設問領域データの読み込みに失敗しました")
        }

        // DBレベルでフィルタリング済みなので、順序を保持したまま設定
        setCropRegions(regionsResult as CropRegionWithExamPage[])

        // ユーザーIDの設定（AuthContextから渡されたIDを優先）
        if (authUserId) {
          setCurrentUserId(authUserId)
        } else {
          // フォールバック: electronAPI経由で取得
          const userData = await window.electronAPI.getCurrentUser()
          if (userData && userData.id) {
            setCurrentUserId(userData.id)
          } else {
            console.warn("ユーザーIDが取得できませんでした")
            setCurrentUserId("default-user")
          }
        }
      } catch (error) {
        console.error("データの読み込みに失敗しました:", error)
        toast.error("データの読み込みに失敗しました")
      } finally {
        setLoading(false)
      }
    }

    if (examId) {
      loadData()
    }
  }, [examId, authUserId])

  return {
    loading,
    exam,
    studentAnswerImages,
    cropRegions,
    currentUserId,
  }
}
