"use client"

import {
  SHORTCUT_CATEGORIES,
  SHORTCUT_LABELS,
} from "@/app/(app)/settings/constants"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"

interface KeyboardShortcutSectionProps {
  shortcuts: Record<string, string>
  editingKey: string | null
  pendingKey: string
  modifierKeyLabel: string
  onKeyEdit: (key: string) => void
  onKeySave: () => void
  onKeyCancel: () => void
  onReset: () => void
  getKeyDisplayName: (key: string) => string
}

export function KeyboardShortcutSection({
  shortcuts,
  editingKey,
  pendingKey,
  modifierKeyLabel,
  onKeyEdit,
  onKeySave,
  onKeyCancel,
  onReset,
  getKeyDisplayName,
}: KeyboardShortcutSectionProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>キーボードショートカット</CardTitle>
          <Button onClick={onReset} variant="outline" size="sm">
            デフォルトに戻す
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {Object.entries(SHORTCUT_CATEGORIES).map(([categoryKey, category]) => (
          <div key={categoryKey} className="space-y-3">
            <div>
              <h3 className="text-lg font-semibold">{category.label}</h3>
              <p className="text-sm text-muted-foreground">
                {category.description}
              </p>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {category.keys.map((key) => (
                <div
                  key={key}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <div className="flex-1">
                    <Label className="text-sm font-medium">
                      {SHORTCUT_LABELS[key]}
                    </Label>
                  </div>
                  <div className="flex items-center gap-2">
                    {editingKey === key ? (
                      <div className="flex items-center gap-2">
                        <Input
                          value={pendingKey}
                          placeholder="キーを押してください"
                          className="w-32 text-center"
                          readOnly
                        />
                        <Button
                          size="sm"
                          onClick={onKeySave}
                          disabled={!pendingKey}
                        >
                          保存
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={onKeyCancel}
                        >
                          キャンセル
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="font-mono">
                          {getKeyDisplayName(shortcuts[key])}
                        </Badge>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => onKeyEdit(key)}
                        >
                          変更
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <Separator />
          </div>
        ))}

        <div className="mt-6 rounded-lg bg-muted p-4">
          <h4 className="mb-2 font-medium">使用方法</h4>
          <div className="space-y-1 text-sm text-muted-foreground">
            <p>• 採点画面で上記のキーを押すと、対応する操作が実行されます</p>
            <p>
              • 修飾キーは {modifierKeyLabel} + キーで動作します（例:{" "}
              {modifierKeyLabel}+E）
            </p>
            <p>• 設定の変更は即座に反映されます</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
