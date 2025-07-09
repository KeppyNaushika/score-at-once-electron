"use client"

import { useState, useEffect } from "react"
import ProtectedRoute from "@/components/auth/ProtectedRoute"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import { 
  DEFAULT_SHORTCUTS, 
  getKeyboardShortcuts, 
  saveKeyboardShortcuts,
  isMacOS,
  getModifierKeyLabel
} from "@/components/projects/06-score-at-once/hooks/use-scoring-keyboard"

// キーの表示名マッピング
const KEY_DISPLAY_NAMES: { [key: string]: string } = {
  q: "Q",
  e: "E", 
  f: "F",
  j: "J",
  o: "O",
  p: "P",
  ArrowRight: "→",
  ArrowLeft: "←",
  ArrowDown: "↓",
  ArrowUp: "↑",
  "=": "=",
  "-": "-",
  "0": "0",
}

// 各設定の日本語名
const SHORTCUT_LABELS: { [key in keyof typeof DEFAULT_SHORTCUTS]: string } = {
  ungraded: "未採点",
  correct: "正答",
  partial: "部分点",
  pending: "保留", 
  incorrect: "誤答",
  no_answer: "無答",
  nextQuestion: "次の設問",
  prevQuestion: "前の設問",
  nextStudent: "次の生徒",
  prevStudent: "前の生徒",
  save: "保存",
  zoomIn: "拡大",
  zoomOut: "縮小",
  resetZoom: "ズームリセット",
  fullView: "全体表示切替",
  moveUp: "上に移動",
  moveLeft: "左に移動",
  moveDown: "下に移動",
  moveRight: "右に移動",
  refreshFilter: "フィルタ更新",
  toggleNames: "名前表示切替",
  nextQuestionShift: "次の設問（Shift）",
  prevQuestionShift: "前の設問（Shift）",
}

export default function SettingsPage() {
  const [shortcuts, setShortcuts] = useState(DEFAULT_SHORTCUTS)
  const [editingKey, setEditingKey] = useState<string | null>(null)
  const [pendingKey, setPendingKey] = useState<string>("")
  const [modifierKeyLabel, setModifierKeyLabel] = useState('Alt')

  // 初期化時にlocalStorageから読み込み
  useEffect(() => {
    setShortcuts(getKeyboardShortcuts())
    setModifierKeyLabel(getModifierKeyLabel())
  }, [])

  // キー入力をキャプチャ
  useEffect(() => {
    if (!editingKey) return

    const handleKeyDown = (event: KeyboardEvent) => {
      event.preventDefault()
      
      // Escapeでキャンセル
      if (event.key === "Escape") {
        setEditingKey(null)
        setPendingKey("")
        return
      }

      // 修飾キーのみの場合はスキップ
      if (["Control", "Alt", "Shift", "Meta"].includes(event.key)) {
        return
      }

      // キーを記録
      let key = event.key
      if (key === " ") key = "Space"
      
      setPendingKey(key)
    }

    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [editingKey])

  // キー設定を保存
  const handleSaveKey = () => {
    if (!editingKey || !pendingKey) return

    // 重複チェック
    const duplicate = Object.entries(shortcuts).find(
      ([existingKey, existingValue]) => 
        existingKey !== editingKey && existingValue === pendingKey
    )

    if (duplicate) {
      toast.error(`キー「${pendingKey}」は既に「${SHORTCUT_LABELS[duplicate[0] as keyof typeof DEFAULT_SHORTCUTS]}」に割り当てられています`)
      return
    }

    const newShortcuts = {
      ...shortcuts,
      [editingKey]: pendingKey
    }

    setShortcuts(newShortcuts)
    saveKeyboardShortcuts(newShortcuts)
    setEditingKey(null)
    setPendingKey("")
    toast.success("キーバインドを更新しました")
  }

  // キャンセル
  const handleCancelEdit = () => {
    setEditingKey(null)
    setPendingKey("")
  }

  // デフォルトに戻す
  const handleResetToDefault = () => {
    setShortcuts(DEFAULT_SHORTCUTS)
    saveKeyboardShortcuts(DEFAULT_SHORTCUTS)
    toast.success("キーバインドをデフォルトに戻しました")
  }

  // キーの表示名を取得
  const getDisplayKey = (key: string): string => {
    return KEY_DISPLAY_NAMES[key] || key.toUpperCase()
  }

  return (
    <ProtectedRoute>
      <div className="container mx-auto p-4">
        <h1 className="mb-6 text-2xl font-semibold">設定</h1>

        <div className="space-y-8">
          <Card>
            <CardHeader>
              <CardTitle>画像前処理設定</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid w-full max-w-sm items-center gap-1.5">
                <Label htmlFor="setting-threshold">二値化閾値</Label>
                <Input
                  type="number"
                  id="setting-threshold"
                  placeholder="例: 128"
                />
              </div>
              {/* TODO: Add more image processing settings */}
              <Button>保存</Button>
            </CardContent>
          </Card>

          <Separator />

          <Card>
            <CardHeader>
              <CardTitle>デフォルト出力先設定</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid w-full max-w-lg items-center gap-1.5">
                <Label htmlFor="setting-output-excel">
                  Excel出力先フォルダ
                </Label>
                <div className="flex space-x-2">
                  <Input
                    type="text"
                    id="setting-output-excel"
                    placeholder="未設定"
                    readOnly
                  />
                  <Button variant="outline">選択</Button>
                </div>
              </div>
              <div className="grid w-full max-w-lg items-center gap-1.5">
                <Label htmlFor="setting-output-pdf">PDF出力先フォルダ</Label>
                <div className="flex space-x-2">
                  <Input
                    type="text"
                    id="setting-output-pdf"
                    placeholder="未設定"
                    readOnly
                  />
                  <Button variant="outline">選択</Button>
                </div>
              </div>
              {/* TODO: Add more output settings */}
              <Button>保存</Button>
            </CardContent>
          </Card>

          <Separator />

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                キーバインド設定
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={handleResetToDefault}
                >
                  デフォルトに戻す
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="text-sm text-gray-600 mb-4">
                  キーをクリックして新しいキーを設定できます。Escapeでキャンセルします。
                </div>

                {/* 採点操作 */}
                <div>
                  <h4 className="font-medium mb-3 text-gray-800">採点操作</h4>
                  <div className="grid grid-cols-1 gap-4">
                    {(['ungraded', 'correct', 'partial', 'pending', 'incorrect', 'no_answer'] as const).map((key) => (
                      <div key={key} className="flex items-center justify-between p-3 bg-gray-50 rounded-md">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2">
                            <span className="text-sm font-medium">
                              {SHORTCUT_LABELS[key]}
                            </span>
                            <Badge variant="secondary" className="text-xs">
                              {modifierKeyLabel}+{getDisplayKey(shortcuts[key])} でフィルタ切替
                            </Badge>
                          </div>
                        </div>
                        {editingKey === key ? (
                          <div className="flex items-center space-x-2">
                            <Badge variant="secondary" className="min-w-[60px] justify-center">
                              {pendingKey || "キーを押してください"}
                            </Badge>
                            <Button size="sm" onClick={handleSaveKey} disabled={!pendingKey}>
                              保存
                            </Button>
                            <Button size="sm" variant="outline" onClick={handleCancelEdit}>
                              キャンセル
                            </Button>
                          </div>
                        ) : (
                          <Badge 
                            variant="outline" 
                            className="cursor-pointer hover:bg-gray-100 min-w-[60px] justify-center"
                            onClick={() => setEditingKey(key)}
                          >
                            {getDisplayKey(shortcuts[key])}
                          </Badge>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <Separator />

                {/* ナビゲーション */}
                <div>
                  <h4 className="font-medium mb-3 text-gray-800">ナビゲーション</h4>
                  <div className="grid grid-cols-2 gap-4">
                    {(['nextQuestion', 'prevQuestion', 'nextStudent', 'prevStudent'] as const).map((key) => (
                      <div key={key} className="flex items-center justify-between p-3 bg-gray-50 rounded-md">
                        <span className="text-sm font-medium">
                          {SHORTCUT_LABELS[key]}
                        </span>
                        {editingKey === key ? (
                          <div className="flex items-center space-x-2">
                            <Badge variant="secondary" className="min-w-[60px] justify-center">
                              {pendingKey || "キーを押してください"}
                            </Badge>
                            <Button size="sm" onClick={handleSaveKey} disabled={!pendingKey}>
                              保存
                            </Button>
                            <Button size="sm" variant="outline" onClick={handleCancelEdit}>
                              キャンセル
                            </Button>
                          </div>
                        ) : (
                          <Badge 
                            variant="outline" 
                            className="cursor-pointer hover:bg-gray-100 min-w-[60px] justify-center"
                            onClick={() => setEditingKey(key)}
                          >
                            {getDisplayKey(shortcuts[key])}
                          </Badge>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <Separator />

                {/* 移動操作 */}
                <div>
                  <h4 className="font-medium mb-3 text-gray-800">移動操作 (WASD)</h4>
                  <div className="grid grid-cols-2 gap-4">
                    {(['moveUp', 'moveLeft', 'moveDown', 'moveRight'] as const).map((key) => (
                      <div key={key} className="flex items-center justify-between p-3 bg-gray-50 rounded-md">
                        <span className="text-sm font-medium">
                          {SHORTCUT_LABELS[key]}
                        </span>
                        {editingKey === key ? (
                          <div className="flex items-center space-x-2">
                            <Badge variant="secondary" className="min-w-[60px] justify-center">
                              {pendingKey || "キーを押してください"}
                            </Badge>
                            <Button size="sm" onClick={handleSaveKey} disabled={!pendingKey}>
                              保存
                            </Button>
                            <Button size="sm" variant="outline" onClick={handleCancelEdit}>
                              キャンセル
                            </Button>
                          </div>
                        ) : (
                          <Badge 
                            variant="outline" 
                            className="cursor-pointer hover:bg-gray-100 min-w-[60px] justify-center"
                            onClick={() => setEditingKey(key)}
                          >
                            {getDisplayKey(shortcuts[key])}
                          </Badge>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <Separator />

                {/* その他の操作 */}
                <div>
                  <h4 className="font-medium mb-3 text-gray-800">その他の操作</h4>
                  <div className="grid grid-cols-2 gap-4">
                    {(['refreshFilter', 'toggleNames'] as const).map((key) => (
                      <div key={key} className="flex items-center justify-between p-3 bg-gray-50 rounded-md">
                        <span className="text-sm font-medium">
                          {SHORTCUT_LABELS[key]}
                        </span>
                        {editingKey === key ? (
                          <div className="flex items-center space-x-2">
                            <Badge variant="secondary" className="min-w-[60px] justify-center">
                              {pendingKey || "キーを押してください"}
                            </Badge>
                            <Button size="sm" onClick={handleSaveKey} disabled={!pendingKey}>
                              保存
                            </Button>
                            <Button size="sm" variant="outline" onClick={handleCancelEdit}>
                              キャンセル
                            </Button>
                          </div>
                        ) : (
                          <Badge 
                            variant="outline" 
                            className="cursor-pointer hover:bg-gray-100 min-w-[60px] justify-center"
                            onClick={() => setEditingKey(key)}
                          >
                            {getDisplayKey(shortcuts[key])}
                          </Badge>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <Separator />

                {/* 表示操作 */}
                <div>
                  <h4 className="font-medium mb-3 text-gray-800">表示操作</h4>
                  <div className="grid grid-cols-2 gap-4">
                    {(['zoomIn', 'zoomOut', 'resetZoom', 'fullView'] as const).map((key) => (
                      <div key={key} className="flex items-center justify-between p-3 bg-gray-50 rounded-md">
                        <span className="text-sm font-medium">
                          {SHORTCUT_LABELS[key]}
                        </span>
                        {editingKey === key ? (
                          <div className="flex items-center space-x-2">
                            <Badge variant="secondary" className="min-w-[60px] justify-center">
                              {pendingKey || "キーを押してください"}
                            </Badge>
                            <Button size="sm" onClick={handleSaveKey} disabled={!pendingKey}>
                              保存
                            </Button>
                            <Button size="sm" variant="outline" onClick={handleCancelEdit}>
                              キャンセル
                            </Button>
                          </div>
                        ) : (
                          <Badge 
                            variant="outline" 
                            className="cursor-pointer hover:bg-gray-100 min-w-[60px] justify-center"
                            onClick={() => setEditingKey(key)}
                          >
                            {getDisplayKey(shortcuts[key])}
                          </Badge>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-6 p-4 bg-blue-50 rounded-md">
                  <h5 className="font-medium text-blue-800 mb-2">使用方法</h5>
                  <ul className="text-sm text-blue-700 space-y-1">
                    <li>• キーをクリックして新しいキーを割り当てることができます</li>
                    <li>• Alt+採点キーでフィルタの表示/非表示を切り替えできます</li>
                    <li>• 変更は自動的に保存され、すぐに反映されます</li>
                    <li>• 重複するキーは設定できません</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </ProtectedRoute>
  )
}
