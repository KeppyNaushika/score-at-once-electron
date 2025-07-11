"use client"

export function LoadingState() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <div className="border-primary mx-auto h-12 w-12 animate-spin rounded-full border-b-2"></div>
        <p className="text-muted-foreground mt-4">読み込み中...</p>
      </div>
    </div>
  )
}

export function StudentNotFoundState() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="max-w-md">
        <div className="py-8 text-center">
          <p className="mb-2 text-lg font-medium">生徒が見つかりません</p>
          <p className="text-muted-foreground mb-4 text-sm">
            指定された生徒が存在しないか、削除されています。
          </p>
        </div>
      </div>
    </div>
  )
}
