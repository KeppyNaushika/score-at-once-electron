import {
  CropRegionWithProjectPage,
  PageImageWithProjectStudents,
} from "@/components/projects/07-score-at-once/types"
import { ProjectWithDetails, isValidProject } from "@/types/common.types"
import { useEffect, useState } from "react"
import { toast } from "sonner"

interface ScoringDataLoaderResult {
  loading: boolean
  project: ProjectWithDetails | null
  pageImages: PageImageWithProjectStudents[]
  cropRegions: CropRegionWithProjectPage[]
  currentUserId: string | null
}

export function useScoringDataLoader(
  projectId: string
): ScoringDataLoaderResult {
  const [loading, setLoading] = useState(true)
  const [project, setProject] = useState<ProjectWithDetails | null>(null)
  const [pageImages, setPageImages] = useState<PageImageWithProjectStudents[]>(
    []
  )
  const [cropRegions, setCropRegions] = useState<CropRegionWithProjectPage[]>(
    []
  )
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true)

        // プロジェクトデータの読み込み
        const projectData = await window.electronAPI.fetchProjectById(projectId)
        if (!projectData) {
          throw new Error("プロジェクトが見つかりません")
        }
        if (!isValidProject(projectData)) {
          throw new Error("プロジェクトデータの形式が正しくありません")
        }
        setProject(projectData)

        // 答案データの読み込み
        const answersResult =
          await window.electronAPI.getStudentAnswersByProjectId(projectId)
        if (!answersResult.success) {
          throw new Error("答案データの読み込みに失敗しました")
        }

        const pageImagesData = (answersResult.studentAnswers ||
          []) as unknown as PageImageWithProjectStudents[]

        setPageImages(pageImagesData)

        // 設問領域データの読み込み
        const regionsResult =
          await window.electronAPI.getQuestionAnswerRegionsByProjectId(
            projectId
          )
        if (!regionsResult || !Array.isArray(regionsResult)) {
          throw new Error("設問領域データの読み込みに失敗しました")
        }

        // DBレベルでフィルタリング済みなので、順序を保持したまま設定
        setCropRegions(regionsResult as CropRegionWithProjectPage[])

        // ユーザーIDの取得
        const userData = await window.electronAPI.getCurrentUser()
        if (userData && userData.id) {
          setCurrentUserId(userData.id)
        } else {
          console.warn("ユーザーIDが取得できませんでした")
          setCurrentUserId("default-user")
        }
      } catch (error) {
        console.error("データの読み込みに失敗しました:", error)
        toast.error("データの読み込みに失敗しました")
      } finally {
        setLoading(false)
      }
    }

    if (projectId) {
      loadData()
    }
  }, [projectId])

  return {
    loading,
    project,
    pageImages,
    cropRegions,
    currentUserId,
  }
}
