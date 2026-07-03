"use client"

import { useCallback, useEffect, useState } from "react"

interface ExclusionRecord {
  id: string
  gradeId: string
  studentId: string
  gradeItemId: string
}

/** 生徒ごとの成績評定項目除外設定の取得・トグル操作を管理するフック */
export function useGradeItemExclusions(gradeId: string) {
  const [exclusionSet, setExclusionSet] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)

  const buildKey = (studentId: string, gradeItemId: string) =>
    `${studentId}:${gradeItemId}`

  const loadExclusions = useCallback(async () => {
    setLoading(true)
    try {
      const result =
        await window.electronAPI.grade.getGradeItemExclusions(gradeId)
      if (result.success && result.exclusions) {
        setExclusionSet(
          new Set(
            result.exclusions.map((exclusion: ExclusionRecord) =>
              buildKey(exclusion.studentId, exclusion.gradeItemId)
            )
          )
        )
      }
    } catch (error) {
      console.error("Failed to load grade item exclusions:", error)
    } finally {
      setLoading(false)
    }
  }, [gradeId])

  useEffect(() => {
    loadExclusions()
  }, [loadExclusions])

  const isExcluded = useCallback(
    (studentId: string, gradeItemId: string) =>
      exclusionSet.has(buildKey(studentId, gradeItemId)),
    [exclusionSet]
  )

  const toggleExclusion = useCallback(
    async (studentId: string, gradeItemId: string) => {
      const key = buildKey(studentId, gradeItemId)
      const currentlyExcluded = exclusionSet.has(key)
      const newExcluded = !currentlyExcluded

      // 楽観的更新
      setExclusionSet((prev) => {
        const next = new Set(prev)
        if (newExcluded) {
          next.add(key)
        } else {
          next.delete(key)
        }
        return next
      })

      try {
        const result = await window.electronAPI.grade.setGradeItemExclusion({
          gradeId,
          studentId,
          gradeItemId,
          excluded: newExcluded,
        })
        if (!result.success) {
          // ロールバック
          setExclusionSet((prev) => {
            const next = new Set(prev)
            if (currentlyExcluded) {
              next.add(key)
            } else {
              next.delete(key)
            }
            return next
          })
        }
      } catch {
        // ロールバック
        setExclusionSet((prev) => {
          const next = new Set(prev)
          if (currentlyExcluded) {
            next.add(key)
          } else {
            next.delete(key)
          }
          return next
        })
      }
    },
    [exclusionSet, gradeId]
  )

  return {
    exclusionSet,
    loading,
    isExcluded,
    toggleExclusion,
  }
}
