import { type SetStateAction, useCallback, useState } from "react"

import type { DrawingAnnotation } from "@/types/drawingAnnotation.types"

/**
 * 採用前の朱書きの下書き（試行ごと）。教員が詳細で動かす・大きさを変える・文字を直すと
 * ここに残り、採用のときに求めた置き場所の代わりに書かれる。
 *
 * 持つのは直したものだけ。直していない試行は、置き場所から作った初めの形（seed）を使う
 */
export function useAiAnnotationDrafts() {
  const [draftAnnotationsByAttemptId, setDraftAnnotationsByAttemptId] =
    useState<ReadonlyMap<string, DrawingAnnotation[]>>(new Map())

  /** 試行の下書きを変える。まだ直していなければ seed から変える */
  const updateDraft = useCallback(
    (
      attemptId: string,
      seedAnnotations: DrawingAnnotation[],
      action: SetStateAction<DrawingAnnotation[]>
    ) => {
      setDraftAnnotationsByAttemptId((prev) => {
        const current = prev.get(attemptId) ?? seedAnnotations
        const next = typeof action === "function" ? action(current) : action
        return new Map(prev).set(attemptId, next)
      })
    },
    []
  )

  return { draftAnnotationsByAttemptId, updateDraft }
}
