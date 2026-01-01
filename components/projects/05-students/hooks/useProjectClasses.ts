"use client"

import type {
  ProjectClassWithClass,
  ProjectClassWithDetails,
} from "@/types/electron.d"
import { useCallback, useEffect, useState } from "react"

interface UseProjectClassesOptions {
  projectId: string
}

interface UseProjectClassesReturn {
  /** プロジェクトに関連付けられたクラス一覧 */
  projectClasses: ProjectClassWithClass[]
  /** 読み込み中フラグ */
  loading: boolean
  /** データを再取得 */
  refresh: () => Promise<void>
  /** クラスを削除 */
  removeClass: (projectClassId: string) => Promise<boolean>
  /** クラス設定を更新 */
  updateClass: (
    projectClassId: string,
    options: { administered?: boolean; statistics?: boolean }
  ) => Promise<ProjectClassWithDetails | null>
}

/**
 * ProjectClass（プロジェクト-クラス関連）を管理するフック
 */
export function useProjectClasses({
  projectId,
}: UseProjectClassesOptions): UseProjectClassesReturn {
  const [projectClasses, setProjectClasses] = useState<ProjectClassWithClass[]>(
    []
  )
  const [loading, setLoading] = useState(true)

  // データ取得
  const fetchProjectClasses = useCallback(async () => {
    if (!projectId) return

    setLoading(true)

    try {
      const data = await window.electronAPI.projectClass.getAll(projectId)
      setProjectClasses(data)
    } catch (err) {
      console.error("Failed to fetch project classes:", err)
    } finally {
      setLoading(false)
    }
  }, [projectId])

  // 初回読み込み
  useEffect(() => {
    fetchProjectClasses()
  }, [fetchProjectClasses])

  // クラスを削除
  const removeClass = useCallback(
    async (projectClassId: string): Promise<boolean> => {
      try {
        await window.electronAPI.projectClass.remove(projectClassId)
        await fetchProjectClasses()
        return true
      } catch (err) {
        console.error("Failed to remove class from project:", err)
        return false
      }
    },
    [fetchProjectClasses]
  )

  // クラス設定を更新
  const updateClass = useCallback(
    async (
      projectClassId: string,
      options: { administered?: boolean; statistics?: boolean }
    ): Promise<ProjectClassWithDetails | null> => {
      try {
        const result = await window.electronAPI.projectClass.update({
          id: projectClassId,
          ...options,
        })
        await fetchProjectClasses()
        return result
      } catch (err) {
        console.error("Failed to update project class:", err)
        return null
      }
    },
    [fetchProjectClasses]
  )

  return {
    projectClasses,
    loading,
    refresh: fetchProjectClasses,
    removeClass,
    updateClass,
  }
}
