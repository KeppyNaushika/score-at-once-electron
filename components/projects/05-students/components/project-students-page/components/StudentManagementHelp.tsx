"use client"

import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Info, UserCheck, Users, UserX } from "lucide-react"

export function StudentManagementHelp() {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <Info className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[450px]" align="start" side="bottom">
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-blue-600" />
              <h3 className="text-base font-semibold">受験生徒の管理</h3>
            </div>
            <p className="text-muted-foreground pl-7 text-sm">
              採点対象となる生徒を選択・管理します。学級単位での一括追加や、個別の生徒追加が可能です。
            </p>
          </div>

          <div className="space-y-3 pl-7">
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
              <strong>基本操作</strong>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                <li>
                  <strong>学級単位で追加</strong>: 学級の全生徒を一括追加
                </li>
                <li>
                  <strong>個別追加</strong>: 特定の生徒のみを選択して追加
                </li>
                <li>
                  <strong>受験状態管理</strong>:
                  受験・見込・欠席の状態を設定
                </li>
                <li>
                  <strong>並び替え</strong>:
                  ドラッグ&ドロップで生徒の表示順を変更
                </li>
              </ul>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium">受験状態の種類：</p>
              <div className="space-y-1 text-sm">
                <div className="flex items-center gap-2">
                  <UserCheck className="h-4 w-4 text-green-600" />
                  <span>
                    <strong>受験</strong>: 答案の採点対象
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <UserX className="h-4 w-4 text-red-600" />
                  <span>
                    <strong>欠席</strong>: 答案なし（0点として集計）
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-blue-600" />
                  <span>
                    <strong>見込</strong>: 暫定的な登録
                  </span>
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-orange-200 bg-orange-50 p-3 text-sm text-orange-800">
              <strong>ヒント:</strong>
              <ul className="mt-1 list-disc space-y-1 pl-5">
                <li>生徒の並び順は採点画面での表示順に影響します</li>
                <li>
                  欠席者も集計には含まれるため、正確に設定してください
                </li>
                <li>削除時に採点データがある場合は警告が表示されます</li>
              </ul>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
