"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Settings,
  Users,
  ArrowRightLeft,
  ArrowUpDown,
  Hash,
  FileStack,
  FileText,
  Clock,
  Info,
} from "lucide-react"

interface BatchSettingsProps {
  assignmentMode: 'auto' | 'manual'
  setAssignmentMode: (mode: 'auto' | 'manual') => void
  fileOrder: 'page-then-student' | 'student-then-page'
  setFileOrder: (order: 'page-then-student' | 'student-then-page') => void
  sortMode: 'natural' | 'alphabetical' | 'upload-order'
  setSortMode: (mode: 'natural' | 'alphabetical' | 'upload-order') => void
  pageRange: 'all' | 'specific'
  setPageRange: (range: 'all' | 'specific') => void
  specificPages: string
  setSpecificPages: (pages: string) => void
}

export default function BatchSettings({
  assignmentMode,
  setAssignmentMode,
  fileOrder,
  setFileOrder,
  sortMode,
  setSortMode,
  pageRange,
  setPageRange,
  specificPages,
  setSpecificPages,
}: BatchSettingsProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          <Settings className="h-4 w-4" />
          自動割り当て設定
        </CardTitle>
        <CardDescription className="text-sm">
          ファイルと生徒の自動割り当て方法を設定できます。
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* メイン設定 */}
        <div className="space-y-3">
          {/* 生徒割り当て方法 */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Users className="h-3 w-3 text-blue-600" />
              <Label className="text-sm font-medium">生徒への割り当て方法</Label>
            </div>
            <Select
              value={assignmentMode}
              onValueChange={(value: 'auto' | 'manual') => setAssignmentMode(value)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">
                  <div className="flex items-center gap-2">
                    <Hash className="h-4 w-4" />
                    <div>
                      <div className="font-medium">自動割り当て（出席番号順）</div>
                      <div className="text-xs text-muted-foreground">ファイルを生徒の出席番号順に自動割り当て</div>
                    </div>
                  </div>
                </SelectItem>
                <SelectItem value="manual">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    <div>
                      <div className="font-medium">手動割り当て（ファイル名推測）</div>
                      <div className="text-xs text-muted-foreground">ファイル名から生徒を推測して割り当て</div>
                    </div>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>

            {/* モード別説明 */}
            {assignmentMode === 'auto' ? (
              <div className="rounded bg-blue-50 p-3 border border-blue-200">
                <div className="flex items-start gap-2">
                  <Hash className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <h4 className="font-medium text-blue-900 text-sm">自動割り当て</h4>
                    <p className="text-xs text-blue-700 mt-1">
                      出席番号順に自動割り当て。受験生徒のみ対象、欠席者は自動スキップ。
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded bg-amber-50 p-3 border border-amber-200">
                <div className="flex items-start gap-2">
                  <FileText className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <h4 className="font-medium text-amber-900 text-sm">手動割り当て</h4>
                    <p className="text-xs text-amber-700 mt-1">
                      ファイル名から学籍番号・氏名で生徒を推測して割り当て。
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ファイルの並び順（自動モード時のみ） */}
          {assignmentMode === 'auto' && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <ArrowRightLeft className="h-3 w-3 text-green-600" />
                <Label className="text-sm font-medium">ファイルの並び順</Label>
              </div>
              <Select
                value={fileOrder}
                onValueChange={(value: 'page-then-student' | 'student-then-page') => setFileOrder(value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="student-then-page">
                    <div>
                      <div className="font-medium">生徒ごと→ページ順（推奨）</div>
                      <div className="text-xs text-muted-foreground">例: 田中p1, 田中p2, 山田p1, 山田p2...</div>
                    </div>
                  </SelectItem>
                  <SelectItem value="page-then-student">
                    <div>
                      <div className="font-medium">ページごと→生徒順</div>
                      <div className="text-xs text-muted-foreground">例: 田中p1, 山田p1, 田中p2, 山田p2...</div>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>

              <div className="rounded bg-green-50 p-2 border border-green-200">
                <div className="flex items-center gap-2">
                  <Info className="h-3 w-3 text-green-600 flex-shrink-0" />
                  <div className="text-xs text-green-700">
                    {fileOrder === 'student-then-page'
                      ? '生徒ごとにページをまとめる（推奨）'
                      : 'ページごとに生徒をまとめる'}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 詳細設定 */}
        <div className="border-t pt-3">
          <h3 className="text-xs font-medium mb-2 flex items-center gap-2 text-muted-foreground">
            <Clock className="h-3 w-3" />
            詳細設定
          </h3>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {/* ファイル並び替え */}
            <div className="space-y-1">
              <div className="flex items-center gap-1">
                <ArrowUpDown className="h-3 w-3 text-muted-foreground" />
                <Label className="text-xs">ファイルの並び替え</Label>
              </div>
              <Select
                value={sortMode}
                onValueChange={(value: 'natural' | 'alphabetical' | 'upload-order') => setSortMode(value)}
              >
                <SelectTrigger className="h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="natural">
                    <div className="text-sm">
                      <div className="font-medium">自然順（推奨）</div>
                      <div className="text-xs text-muted-foreground">連番対応</div>
                    </div>
                  </SelectItem>
                  <SelectItem value="alphabetical">
                    <div className="text-sm">
                      <div className="font-medium">アルファベット順</div>
                      <div className="text-xs text-muted-foreground">標準ソート</div>
                    </div>
                  </SelectItem>
                  <SelectItem value="upload-order">
                    <div className="text-sm">
                      <div className="font-medium">アップロード順</div>
                      <div className="text-xs text-muted-foreground">選択順</div>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* ページ範囲 */}
            <div className="space-y-1">
              <div className="flex items-center gap-1">
                <FileStack className="h-3 w-3 text-muted-foreground" />
                <Label className="text-xs">読み込むページ</Label>
              </div>
              <Select
                value={pageRange}
                onValueChange={(value: 'all' | 'specific') => setPageRange(value)}
              >
                <SelectTrigger className="h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">すべてのページ</SelectItem>
                  <SelectItem value="specific">特定のページのみ</SelectItem>
                </SelectContent>
              </Select>

              {/* 特定ページ指定 */}
              {pageRange === 'specific' && (
                <div className="space-y-1">
                  <Input
                    type="text"
                    value={specificPages}
                    onChange={(e) => setSpecificPages(e.target.value)}
                    placeholder="例: 1,3-5,7"
                    className="text-xs h-8"
                  />
                  <p className="text-xs text-muted-foreground">
                    カンマ区切り・範囲指定可能
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}