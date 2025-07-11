"use client"

import { KeyboardShortcutSection } from "@/app/settings/components/keyboard-shortcut-section"
import { useKeyboardSettings } from "@/app/settings/hooks/use-keyboard-settings"
import ProtectedRoute from "@/components/auth/ProtectedRoute"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"

export default function SettingsPage() {
  const {
    shortcuts,
    editingKey,
    pendingKey,
    modifierKeyLabel,
    handleKeyEdit,
    handleKeySave,
    handleKeyCancel,
    handleReset,
    getKeyDisplayName,
  } = useKeyboardSettings()

  return (
    <ProtectedRoute>
      <div className="container mx-auto max-w-4xl p-6">
        <div className="mb-6">
          <h1 className="mb-2 text-3xl font-bold">設定</h1>
          <p className="text-muted-foreground">
            キーボードショートカットやその他の設定を管理します。
          </p>
        </div>

        <div className="space-y-6">
          <KeyboardShortcutSection
            shortcuts={shortcuts}
            editingKey={editingKey}
            pendingKey={pendingKey}
            modifierKeyLabel={modifierKeyLabel}
            onKeyEdit={handleKeyEdit}
            onKeySave={handleKeySave}
            onKeyCancel={handleKeyCancel}
            onReset={handleReset}
            getKeyDisplayName={getKeyDisplayName}
          />

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
              <Button>保存</Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </ProtectedRoute>
  )
}
