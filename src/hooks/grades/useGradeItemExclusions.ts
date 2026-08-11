"use client"

import { useCallback, useEffect, useState } from "react"

import type { GradeCellTarget } from "@/types/grade.types"

/**
 * 除外セルの同定キー。除外の主語は「その成績の対象者」（GradeStudent）であり、
 * 人（Student）ではない。どちらも string なので、実体ではなくキーを組み立てる
 * この一箇所に集約して取り違えを防ぐ。
 */
const buildKey = (target: GradeCellTarget) =>
  `${target.gradeStudentId}:${target.gradeItemId}`

/** 対象者ごとの成績評定項目除外設定の取得・トグル操作を管理するフック */
export function useGradeItemExclusions(gradeId: string) {
  const [exclusionSet, setExclusionSet] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)

  const loadExclusions = useCallback(async () => {
    setLoading(true)
    try {
      const exclusions =
        await window.electronAPI.grade.getGradeItemExclusions(gradeId)
      setExclusionSet(new Set(exclusions.map(buildKey)))
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
    (target: GradeCellTarget) => exclusionSet.has(buildKey(target)),
    [exclusionSet]
  )

  const toggleExclusion = useCallback(
    async (target: GradeCellTarget) => {
      const key = buildKey(target)
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

      const rollback = () => {
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

      try {
        await window.electronAPI.grade.setGradeItemExclusion({
          ...target,
          excluded: newExcluded,
        })
      } catch {
        rollback()
      }
    },
    [exclusionSet]
  )

  return {
    exclusionSet,
    loading,
    isExcluded,
    toggleExclusion,
  }
}
