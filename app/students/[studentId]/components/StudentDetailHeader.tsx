"use client"

import {
  ArrowLeft,
  Edit,
  History,
  Info,
  PlusCircle,
  Trash2,
  UserCircle,
} from "lucide-react"
import { useRouter } from "next/navigation"

import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

export function StudentDetailHeader() {
  const router = useRouter()

  return (
    <div className="mb-6">
      <Button
        onClick={() => router.push("/students")}
        variant="ghost"
        size="sm"
        className="mb-4"
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        生徒一覧に戻る
      </Button>
      <div className="flex items-center gap-2">
        <h1 className="text-3xl font-bold">生徒詳細</h1>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <Info className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-125" align="start" side="bottom">
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <UserCircle className="h-5 w-5 text-blue-600" />
                  <h3 className="text-base font-semibold">生徒詳細ページ</h3>
                </div>
                <p className="text-muted-foreground pl-7 text-sm">
                  生徒の基本情報と所属履歴を管理できます。
                </p>
              </div>

              <div className="space-y-3 pl-7">
                <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
                  <strong>所属履歴管理:</strong>
                  <br />
                  生徒の学級所属履歴を時系列で表示します。
                  <ul className="mt-2 list-disc space-y-1 pl-5">
                    <li>現在の所属学級</li>
                    <li>過去の所属履歴</li>
                    <li>出席番号の変遷</li>
                    <li>所属期間の詳細</li>
                  </ul>
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-medium">主な操作：</p>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="flex items-center gap-2">
                      <Edit className="h-4 w-4 text-orange-600" />
                      <span>基本情報編集</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <PlusCircle className="h-4 w-4 text-green-600" />
                      <span>学級所属追加</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <History className="h-4 w-4 text-blue-600" />
                      <span>所属履歴確認</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Trash2 className="h-4 w-4 text-red-600" />
                      <span>所属情報削除</span>
                    </div>
                  </div>
                </div>

                <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800">
                  <strong>タイムライン表示:</strong> タイムラインで所属履歴を
                  視覚的に確認できます。複数学級への同時所属も一目でわかります。
                </div>
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  )
}
