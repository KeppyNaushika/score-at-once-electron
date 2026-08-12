"use client"

import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useCallback } from "react"

import { queryKeys } from "@/lib/queryKeys"
import type { GradeCellTarget } from "@/types/grade.types"

/**
 * 除外セルの同定キー。除外の主語は「その成績の対象者」（GradeStudent）であり、
 * 人（Student）ではない。どちらも string なので、実体ではなくキーを組み立てる
 * この一箇所に集約して取り違えを防ぐ。
 */
const buildKey = (target: GradeCellTarget) =>
  `${target.gradeStudentId}:${target.gradeItemId}`

/** 未取得のときに毎回新しい Set を作らないための空値 */
const EMPTY_EXCLUSIONS: ReadonlySet<string> = new Set()

/** 対象者ごとの成績評定項目除外設定の取得・トグル操作を管理するフック */
export function useGradeItemExclusions(gradeId: string) {
  const queryClient = useQueryClient()
  const queryKey = queryKeys.grade.exclusions(gradeId)
  const { data: exclusionSet = EMPTY_EXCLUSIONS, isPending: loading } =
    useQuery({
      queryKey,
      queryFn: async () =>
        new Set(
          (await window.electronAPI.grade.getGradeItemExclusions(gradeId)).map(
            buildKey
          )
        ),
    })

  /** 楽観更新でキャッシュを直に差し替える（サーバーへの往復を待たせない） */
  const patchCache = useCallback(
    (key: string, excluded: boolean) => {
      queryClient.setQueryData<Set<string>>(queryKey, (previous) => {
        const next = new Set(previous ?? [])
        if (excluded) next.add(key)
        else next.delete(key)
        return next
      })
    },
    [queryClient, queryKey]
  )

  const isExcluded = useCallback(
    (target: GradeCellTarget) => exclusionSet.has(buildKey(target)),
    [exclusionSet]
  )

  const toggleExclusion = useCallback(
    async (target: GradeCellTarget) => {
      const key = buildKey(target)
      const currentlyExcluded = exclusionSet.has(key)
      const newExcluded = !currentlyExcluded

      patchCache(key, newExcluded)

      try {
        await window.electronAPI.grade.setGradeItemExclusion({
          ...target,
          excluded: newExcluded,
        })
      } catch {
        patchCache(key, currentlyExcluded)
      }
    },
    [exclusionSet, patchCache]
  )

  return {
    exclusionSet,
    loading,
    isExcluded,
    toggleExclusion,
  }
}
