"use client"

import { CircleCheck, CircleX } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Spinner } from "@/components/ui/spinner"

/**
 * 取り込みの実行段で、実行中・完了・失敗を伝える部品。
 *
 * 試験（.score）の取り込みと統合アーカイブ（.sao）の取り込みで同じ見た目にする。
 * 完了時の件数と警告の出し方はウィザードごとに違うので、ここには持たない。
 */

/** 実行中 */
export function ImportExecutingView() {
  return (
    <div className="flex h-full flex-col items-center justify-center py-16">
      <div className="mx-auto mb-8 flex h-20 w-20 items-center justify-center rounded-2xl bg-primary/10">
        <Spinner className="size-10 text-primary" />
      </div>
      <h3 className="mb-2 text-xl font-semibold">取り込み中...</h3>
      <p className="mb-8 text-muted-foreground">
        データを取り込んでいます。しばらくお待ちください。
      </p>
      <div className="w-full max-w-sm">
        <Progress value={undefined} className="h-2" />
      </div>
    </div>
  )
}

/** 完了の見出し。`description` は見出しの下に添える1文（無ければ出さない） */
export function ImportSucceededHeading({
  description,
}: {
  description?: string
}) {
  return (
    <div className="mb-8 text-center">
      <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-green-100 dark:bg-green-900/30">
        <CircleCheck className="h-10 w-10 text-green-600 dark:text-green-400" />
      </div>
      <h3 className="mb-2 text-xl font-semibold">取り込みが完了しました</h3>
      {description && <p className="text-muted-foreground">{description}</p>}
    </div>
  )
}

/** 失敗。`error` が無ければ「詳細は不明です」と出す */
export function ImportFailedView({
  error,
  onClose,
}: {
  error: string | null
  onClose: () => void
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center py-8">
      <div className="mb-8 text-center">
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-destructive/10">
          <CircleX className="h-10 w-10 text-destructive" />
        </div>
        <h3 className="mb-2 text-xl font-semibold">取り込みに失敗しました</h3>
        <p className="max-w-md text-destructive">{error ?? "詳細は不明です"}</p>
      </div>
      <Button onClick={onClose} variant="outline" size="lg">
        閉じる
      </Button>
    </div>
  )
}
