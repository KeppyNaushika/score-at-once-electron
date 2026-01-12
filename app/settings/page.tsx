"use client"

import { Keyboard, Monitor, Users } from "lucide-react"
import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"

import { DisplaySettingsTab } from "@/app/settings/components/DisplaySettingsTab"
import { KeyboardShortcutSection } from "@/app/settings/components/KeyboardShortcutSection"
import { UserManagementTab } from "@/app/settings/components/UserManagementTab"
import { useKeyboardSettings } from "@/app/settings/hooks/useKeyboardSettings"
import { PasscodeEditModal } from "@/components/auth/PasscodeEditModal"
import ProtectedRoute from "@/components/auth/ProtectedRoute"
import { UserEditModal } from "@/components/auth/UserEditModal"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

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
    void loadUsers()
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

        <Tabs defaultValue="keyboard" className="space-y-6">
          <TabsList>
            <TabsTrigger value="keyboard" className="gap-2">
              <Keyboard className="h-4 w-4" />
              キーボード
            </TabsTrigger>
            <TabsTrigger value="display" className="gap-2">
              <Monitor className="h-4 w-4" />
              表示設定
            </TabsTrigger>
            <TabsTrigger value="user" className="gap-2">
              <Users className="h-4 w-4" />
              ユーザー管理
            </TabsTrigger>
          </TabsList>

          <TabsContent value="keyboard">
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
          </TabsContent>

          <TabsContent value="display">
            <DisplaySettingsTab />
          </TabsContent>

          <TabsContent value="user">
            <UserManagementTab
              users={users}
              onEditUser={handleEditUser}
              onEditPasscode={handleEditPasscode}
            />
          </TabsContent>
        </Tabs>

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
