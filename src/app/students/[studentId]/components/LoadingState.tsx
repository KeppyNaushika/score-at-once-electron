"use client"

import { ArrowLeft } from "lucide-react"
import { useRouter } from "next/navigation"

import { Button } from "@/components/ui/button"

export function LoadingState() {
  return (
    <div className="flex h-full items-center justify-center">
      <div className="text-center">
        <div className="mx-auto h-12 w-12 animate-spin rounded-full border-b-2 border-primary"></div>
        <p className="mt-4 text-muted-foreground">読み込み中...</p>
      </div>
    </div>
  )
}

export function StudentNotFoundState() {
  const router = useRouter()

  return (
    <div className="flex h-full items-center justify-center">
      <div className="text-center">
        <p className="mb-2 text-lg font-medium">生徒が見つかりません</p>
        <p className="mb-4 text-sm text-muted-foreground">
          指定された生徒が存在しないか、削除されています。
        </p>
        <Button
          variant="outline"
          className="rounded-lg"
          onClick={() => router.push("/students")}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          生徒一覧に戻る
        </Button>
      </div>
    </div>
  )
}
