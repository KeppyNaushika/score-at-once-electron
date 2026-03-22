"use client"

interface ScoredAnswerPreviewProps {
  imageUrls: string[]
  isLoading: boolean
  error: string | null
}

export function ScoredAnswerPreview({
  imageUrls,
  isLoading,
  error,
}: ScoredAnswerPreviewProps) {
  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-muted-foreground text-sm">読み込み中...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-destructive text-sm">{error}</p>
      </div>
    )
  }

  if (imageUrls.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-muted-foreground text-sm">
          プレビューする生徒を選択してください
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center gap-2">
      {imageUrls.map((url, index) => (
        <img
          key={index}
          src={url}
          alt={`採点済み答案 ページ${index + 1}`}
          className="w-full rounded shadow-sm"
          style={{ maxWidth: "100%" }}
        />
      ))}
    </div>
  )
}
