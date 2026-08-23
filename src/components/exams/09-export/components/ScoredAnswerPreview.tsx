"use client"

import Image from "next/image"

import type { ScoredAnswerPreviewPage } from "../types"

interface ScoredAnswerPreviewProps {
  pages: ScoredAnswerPreviewPage[]
  isLoading: boolean
  error: string | null
}

export function ScoredAnswerPreview({
  pages,
  isLoading,
  error,
}: ScoredAnswerPreviewProps) {
  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-sm text-muted-foreground">読み込み中...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-sm text-destructive">{error}</p>
      </div>
    )
  }

  if (pages.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-sm text-muted-foreground">
          プレビューする生徒を選択してください
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center gap-2">
      {pages.map((page, index) => (
        <Image
          key={index}
          src={page.dataUrl}
          alt={`採点済み答案 ページ${index + 1}`}
          width={page.width}
          height={page.height}
          unoptimized
          className="w-full rounded shadow-sm"
          style={{ maxWidth: "100%", height: "auto" }}
        />
      ))}
    </div>
  )
}
