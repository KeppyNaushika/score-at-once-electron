"use client"

import type { QueryKey } from "@tanstack/react-query"
import { useQueryClient } from "@tanstack/react-query"
import { useEffect, useRef } from "react"

/**
 * 「書き換わったから読み直せ」という合図を受けて取り直す。
 *
 * **合図が変わったときだけ取り直す。** 素直に effect の依存へ行き先（`queryKey`）も
 * 並べると、**行き先が変わった瞬間**——つまり別のものを取り始めた直後——にも走る。
 * `invalidateQueries` は既定で進行中の取得を打ち切る（`cancelRefetch`）ので、設問や
 * 生徒を切り替えるたびに、始まったばかりの取得を捨てて取り直すことになる（往復が倍）。
 *
 * 合図そのものは、書き込みの後始末では拾えない変化のためにある（別の画面が描いた
 * 注釈・タブへ戻ったときの読み直しなど）。
 */
export function useInvalidateOnSignal(queryKey: QueryKey, signal: unknown) {
  const queryClient = useQueryClient()
  /** 直近に受け取った合図。初回は「もう受け取った」ことにする（取得は始まっている） */
  const lastSignal = useRef(signal)

  useEffect(() => {
    if (lastSignal.current === signal) return
    lastSignal.current = signal
    void queryClient.invalidateQueries({ queryKey })
  }, [signal, queryKey, queryClient])
}
