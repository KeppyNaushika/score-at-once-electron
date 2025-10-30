"use client"

import { KeyboardShortcutSection } from "@/app/settings/components/keyboard-shortcut-section"
import { useKeyboardSettings } from "@/app/settings/hooks/use-keyboard-settings"
import { PasscodeEditModal } from "@/components/auth/PasscodeEditModal"
import ProtectedRoute from "@/components/auth/ProtectedRoute"
import { UserEditModal } from "@/components/auth/UserEditModal"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import {
  getSelectionBorderSettings,
  saveSelectionBorderColor,
  SELECTION_BORDER_COLORS,
} from "@/lib/utils"
import { Edit3, UserPen } from "lucide-react"
import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"

interface User {
  id: string
  username: string
  name: string
  role: string
  passcodeType?: string | null
}

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

  const [users, setUsers] = useState<User[]>([])
  const [isPasscodeEditOpen, setIsPasscodeEditOpen] = useState(false)
  const [isUserEditOpen, setIsUserEditOpen] = useState(false)
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [selectionBorderColor, setSelectionBorderColor] = useState(
    getSelectionBorderSettings().color,
  )

  const loadUsers = useCallback(async () => {
    try {
      const usersData = await window.electronAPI.fetchUsers()
      setUsers(usersData)
    } catch (error) {
      console.error("Failed to load users:", error)
    }
  }, [])

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      void loadUsers()
    })

    return () => cancelAnimationFrame(frame)
  }, [loadUsers])

  const handleEditUser = (user: User) => {
    setSelectedUser(user)
    setIsUserEditOpen(true)
  }

  const handleEditPasscode = (user: User) => {
    setSelectedUser(user)
    setIsPasscodeEditOpen(true)
  }

  const handleUserUpdated = () => {
    void loadUsers()
    toast.success("ユーザー情報が更新されました")
  }

  const handlePasscodeUpdated = () => {
    void loadUsers() // ユーザー一覧を再読み込み
  }

  const handleSelectionBorderColorChange = (color: string) => {
    setSelectionBorderColor(color)
    saveSelectionBorderColor(color)
    // カスタムイベントを発火して他のコンポーネントに通知
    window.dispatchEvent(new CustomEvent("selectionBorderColorChanged"))
    toast.success("選択枠色が変更されました")
  }

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
          <Card>
            <CardHeader>
              <CardTitle>ユーザー管理</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {users.map((user) => (
                  <div
                    key={user.id}
                    className="flex items-center justify-between rounded-lg border p-3"
                  >
                    <div>
                      <div className="font-medium">{user.name}</div>
                      <div className="text-muted-foreground text-sm">
                        @{user.username} • {user.role}
                        {user.passcodeType && user.passcodeType !== "none" && (
                          <span className="ml-2 rounded bg-blue-100 px-2 py-1 text-xs text-blue-800">
                            パスコード: {user.passcodeType}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEditUser(user)}
                      >
                        <Edit3 className="mr-2 h-4 w-4" />
                        ユーザー情報編集
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEditPasscode(user)}
                      >
                        <UserPen className="mr-2 h-4 w-4" />
                        パスコード編集
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Separator />

          <Card>
            <CardHeader>
              <CardTitle>表示設定</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-base font-medium">選択枠の色</Label>
                <p className="text-muted-foreground mb-3 text-sm">
                  答案選択時の枠色を変更できます
                </p>
                <div className="grid grid-cols-3 gap-3">
                  {Object.entries(SELECTION_BORDER_COLORS).map(
                    ([colorValue, config]) => (
                      <button
                        key={colorValue}
                        onClick={() =>
                          handleSelectionBorderColorChange(colorValue)
                        }
                        className={`relative flex items-center justify-center rounded-lg border-2 p-3 transition-all hover:scale-105 ${
                          selectionBorderColor === colorValue
                            ? "border-gray-800 shadow-md"
                            : "border-gray-200 hover:border-gray-300"
                        }`}
                      >
                        <div
                          className="h-8 w-8 rounded border-2"
                          style={{ borderColor: config.color }}
                        />
                        {selectionBorderColor === colorValue && (
                          <div className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-blue-500" />
                        )}
                      </button>
                    ),
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Separator />

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

        <UserEditModal
          isOpen={isUserEditOpen}
          onClose={() => {
            setIsUserEditOpen(false)
            setSelectedUser(null)
          }}
          onUserUpdated={handleUserUpdated}
          user={selectedUser}
        />

        <PasscodeEditModal
          isOpen={isPasscodeEditOpen}
          onClose={() => {
            setIsPasscodeEditOpen(false)
            setSelectedUser(null)
          }}
          onPasscodeUpdated={handlePasscodeUpdated}
          user={selectedUser}
        />
      </div>
    </ProtectedRoute>
  )
}
