"use client"

import { useCallback, useRef, useState } from "react"

import type { TrendSeries } from "./types"

interface UseTrendSeriesListOptions<TSeries extends TrendSeries> {
  /** 追加系列の id の接頭辞（`s1`, `s2` …） */
  idPrefix: string
  /** 最初の1本。id は `${idPrefix}0` で固定 */
  createInitialSeries: () => TSeries
  /** 追加する系列。id と色はここで決めて渡す */
  createSeries: (id: string, color: string) => TSeries
  /** 系列の色。追加した順に回して使う */
  colors: readonly string[]
  /** タグと小計から系列のラベルを作る */
  buildLabel: (tags: Set<string>, subtotalId: string) => string
}

/**
 * 推移グラフの系列一覧（追加・削除・タグ・小計の切り替え）。
 * 最後の1本は消せない。
 */
export function useTrendSeriesList<TSeries extends TrendSeries>({
  idPrefix,
  createInitialSeries,
  createSeries,
  colors,
  buildLabel,
}: UseTrendSeriesListOptions<TSeries>) {
  // nextIdRef は追加系列（createId）専用。初期系列の id は固定
  const nextIdRef = useRef(1)
  const createId = useCallback(
    () => `${idPrefix}${nextIdRef.current++}`,
    [idPrefix]
  )

  const [seriesList, setSeriesList] = useState<TSeries[]>(() => [
    createInitialSeries(),
  ])

  const addSeries = useCallback(() => {
    setSeriesList((prev) => [
      ...prev,
      createSeries(createId(), colors[prev.length % colors.length]),
    ])
  }, [createId, createSeries, colors])

  const removeSeries = useCallback((seriesId: string) => {
    setSeriesList((prev) =>
      prev.length <= 1 ? prev : prev.filter((series) => series.id !== seriesId)
    )
  }, [])

  /** 1本だけを差し替える */
  const updateSeries = useCallback(
    (seriesId: string, update: (series: TSeries) => TSeries) => {
      setSeriesList((prev) =>
        prev.map((series) => (series.id === seriesId ? update(series) : series))
      )
    },
    []
  )

  const toggleTag = useCallback(
    (seriesId: string, tag: string) => {
      updateSeries(seriesId, (series) => {
        const next = new Set(series.tags)
        if (next.has(tag)) next.delete(tag)
        else next.add(tag)
        return {
          ...series,
          tags: next,
          label: buildLabel(next, series.subtotalId),
        }
      })
    },
    [updateSeries, buildLabel]
  )

  const clearTags = useCallback(
    (seriesId: string) => {
      updateSeries(seriesId, (series) => {
        const empty = new Set<string>()
        return {
          ...series,
          tags: empty,
          label: buildLabel(empty, series.subtotalId),
        }
      })
    },
    [updateSeries, buildLabel]
  )

  const setSubtotal = useCallback(
    (seriesId: string, subtotalId: string) => {
      updateSeries(seriesId, (series) => ({
        ...series,
        subtotalId,
        label: buildLabel(series.tags, subtotalId),
      }))
    },
    [updateSeries, buildLabel]
  )

  return {
    seriesList,
    addSeries,
    removeSeries,
    updateSeries,
    toggleTag,
    clearTags,
    setSubtotal,
  }
}
