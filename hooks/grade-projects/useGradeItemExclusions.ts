"use client"

import { useCallback, useEffect, useState } from "react"

interface ExclusionRecord {
  id: string
  gradeProjectId: string
  studentId: string
  gradeItemId: string
}

export function useGradeItemExclusions(gradeProjectId: string) {
  const [exclusionSet, setExclusionSet] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)

  const buildKey = (studentId: string, gradeItemId: string) =>
    `${studentId}:${gradeItemId}`

  const loadExclusions = useCallback(async () => {
    setLoading(true)
    try {
      const result =
        await window.electronAPI.gradeProject.getGradeItemExclusions(
          gradeProjectId
        )
      if (result.success && result.exclusions) {
        setExclusionSet(
          new Set(
            result.exclusions.map((ex: ExclusionRecord) =>
              buildKey(ex.studentId, ex.gradeItemId)
            )
          )
        )
      }
    } catch (error) {
      console.error("Failed to load grade item exclusions:", error)
    } finally {
      setLoading(false)
    }
  }, [gradeProjectId])

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
        const result =
          await window.electronAPI.gradeProject.setGradeItemExclusion({
            gradeProjectId,
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
    [exclusionSet, gradeProjectId]
  )

  const batchUpdate = useCallback(
    async (
      updates: { studentId: string; gradeItemId: string; excluded: boolean }[]
    ) => {
      // 楽観的更新
      setExclusionSet((prev) => {
        const next = new Set(prev)
        for (const u of updates) {
          const key = buildKey(u.studentId, u.gradeItemId)
          if (u.excluded) {
            next.add(key)
          } else {
            next.delete(key)
          }
        }
        return next
      })

      try {
        const result =
          await window.electronAPI.gradeProject.batchUpdateGradeItemExclusions(
            gradeProjectId,
            updates
          )
        if (!result.success) {
          await loadExclusions()
        }
      } catch {
        await loadExclusions()
      }
    },
    [gradeProjectId, loadExclusions]
  )

  return {
    exclusionSet,
    loading,
    isExcluded,
    toggleExclusion,
    batchUpdate,
    reload: loadExclusions,
  }
}
