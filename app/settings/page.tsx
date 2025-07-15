"use client"

import { KeyboardShortcutSection } from "@/app/settings/components/keyboard-shortcut-section"
import { useKeyboardSettings } from "@/app/settings/hooks/use-keyboard-settings"
import ProtectedRoute from "@/components/auth/ProtectedRoute"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { PasscodeEditModal } from "@/components/auth/PasscodeEditModal"
import { UserPen } from "lucide-react"
import { useState, useEffect } from "react"

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
  const [selectedUser, setSelectedUser] = useState<User | null>(null)

  useEffect(() => {
    loadUsers()
  }, [])

  const loadUsers = async () => {
    try {
      const usersData = await window.electronAPI.fetchUsers()
      setUsers(usersData)
    } catch (error) {
      console.error("Failed to load users:", error)
    }
  }

  const handleEditPasscode = (user: User) => {
    setSelectedUser(user)
    setIsPasscodeEditOpen(true)
  }

  const handlePasscodeUpdated = () => {
    loadUsers() // ユーザー一覧を再読み込み
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
                  <div key={user.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <div className="font-medium">{user.name}</div>
                      <div className="text-sm text-muted-foreground">
                        @{user.username} • {user.role}
                        {user.passcodeType && user.passcodeType !== "none" && (
                          <span className="ml-2 text-xs px-2 py-1 bg-blue-100 text-blue-800 rounded">
                            パスコード: {user.passcodeType}
                          </span>
                        )}
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEditPasscode(user)}
                    >
                      <UserPen className="h-4 w-4 mr-2" />
                      パスコード編集
                    </Button>
                  </div>
                ))}
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
