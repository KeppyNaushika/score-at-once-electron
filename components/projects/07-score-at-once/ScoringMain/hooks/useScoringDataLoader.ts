import {
  CropRegionWithProjectPage,
  PageImageWithProjectStudents,
} from "@/components/projects/07-score-at-once/types"
import { ProjectWithDetails } from "@/types/common.types"
import { useEffect, useState } from "react"
import { toast } from "sonner"

interface ScoringDataLoaderResult {
  loading: boolean
  project: ProjectWithDetails | null
  pageImages: PageImageWithProjectStudents[]
  cropRegions: CropRegionWithProjectPage[]
  currentUserId: string | null
  error: string | null
}

export function useScoringDataLoader(
  projectId: string,
): ScoringDataLoaderResult {
  const [loading, setLoading] = useState(true)
  const [project, setProject] = useState<ProjectWithDetails | null>(null)
  const [pageImages, setPageImages] = useState<PageImageWithProjectStudents[]>(
    [],
  )
  const [cropRegions, setCropRegions] = useState<CropRegionWithProjectPage[]>(
    [],
  )
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true)
        setError(null)

        // プロジェクトデータの読み込み
        const projectData = await window.electronAPI.fetchProjectById(projectId)
        if (!projectData) {
          throw new Error("プロジェクトが見つかりません")
        }
        setProject(projectData as ProjectWithDetails)

        // 答案データの読み込み
        const answersResult =
          await window.electronAPI.getStudentAnswersByProjectId(projectId)
        if (!answersResult.success) {
          throw new Error("答案データの読み込みに失敗しました")
        }
        
        const pageImagesData = (answersResult.studentAnswers ||
          []) as unknown as PageImageWithProjectStudents[]
        
        console.log("useScoringDataLoader - pageImages loaded:", {
          success: answersResult.success,
          length: pageImagesData.length,
          sampleData: pageImagesData.slice(0, 2).map(pi => ({
            id: pi.id,
            studentId: pi.studentId,
            pageNumber: pi.projectPage?.pageNumber
          }))
        })
        
        setPageImages(pageImagesData)

        // 設問領域データの読み込み
        const regionsResult =
          await window.electronAPI.getCropRegionsByProjectId(projectId)
        if (!regionsResult || !Array.isArray(regionsResult)) {
          throw new Error("設問領域データの読み込みに失敗しました")
        }

        const cropRegions = regionsResult.filter(
          (region: any) => region.type === "QUESTION_ANSWER",
        ) as CropRegionWithProjectPage[]
        
        console.log("useScoringDataLoader - cropRegions loaded:", {
          totalRegions: regionsResult.length,
          questionAnswerRegions: cropRegions.length,
          sampleRegions: cropRegions.slice(0, 2).map(cr => ({
            id: cr.id,
            label: cr.label,
            type: cr.type,
            pageNumber: cr.projectPage?.pageNumber
          }))
        })
        
        setCropRegions(cropRegions)

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
        setError(
          error instanceof Error ? error.message : "不明なエラーが発生しました",
        )
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
    error,
  }
}
