"use client"

import { useQuery } from "@tanstack/react-query"
import { FolderSync, Keyboard, Monitor, Palette, Users } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

import { DisplaySettingsTab } from "@/app/(app)/settings/components/DisplaySettingsTab"
import { KeyboardShortcutSection } from "@/app/(app)/settings/components/KeyboardShortcutSection"
import { ScreenControlTab } from "@/app/(app)/settings/components/ScreenControlTab"
import { SyncSettingsTab } from "@/app/(app)/settings/components/SyncSettingsTab"
import { UserManagementTab } from "@/app/(app)/settings/components/UserManagementTab"
import { useKeyboardSettings } from "@/app/(app)/settings/hooks/useKeyboardSettings"
import { PasscodeEditModal } from "@/components/auth/PasscodeEditModal"
import { UserEditModal } from "@/components/auth/UserEditModal"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { type PublicUser, userListQuery } from "@/queries/user"

/** 未取得のときに毎回新しい配列を作らないための空値 */
const EMPTY_USERS: PublicUser[] = []

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

  const { data: users = EMPTY_USERS } = useQuery(userListQuery())
  const [isPasscodeEditOpen, setIsPasscodeEditOpen] = useState(false)
  const [isUserEditOpen, setIsUserEditOpen] = useState(false)
  const [selectedUser, setSelectedUser] = useState<PublicUser | null>(null)

  const handleEditUser = (user: PublicUser) => {
    setSelectedUser(user)
    setIsUserEditOpen(true)
  }

  const handleEditPasscode = (user: PublicUser) => {
    setSelectedUser(user)
    setIsPasscodeEditOpen(true)
  }

  // 一覧の取り直しは書き込みの meta が行う
  const handleUserUpdated = () => {
    toast.success("ユーザー情報が更新されました")
  }

  return (
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
          <TabsTrigger value="screen" className="gap-2">
            <Monitor className="h-4 w-4" />
            画面制御
          </TabsTrigger>
          <TabsTrigger value="display" className="gap-2">
            <Palette className="h-4 w-4" />
            表示設定
          </TabsTrigger>
          <TabsTrigger value="user" className="gap-2">
            <Users className="h-4 w-4" />
            ユーザー管理
          </TabsTrigger>
          <TabsTrigger value="sync" className="gap-2">
            <FolderSync className="h-4 w-4" />
            同期設定
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

        <TabsContent value="screen">
          <ScreenControlTab />
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

        <TabsContent value="sync">
          <SyncSettingsTab />
        </TabsContent>
      </Tabs>

      {/* 閉じている間はマウントしない。開くたびに対象ユーザーの値でフォームが作り直される */}
      {isUserEditOpen && (
        <UserEditModal
          isOpen={isUserEditOpen}
          onClose={() => {
            setIsUserEditOpen(false)
            setSelectedUser(null)
          }}
          onUserUpdated={handleUserUpdated}
          user={selectedUser}
        />
      )}

      {isPasscodeEditOpen && (
        <PasscodeEditModal
          isOpen={isPasscodeEditOpen}
          onClose={() => {
            setIsPasscodeEditOpen(false)
            setSelectedUser(null)
          }}
          onPasscodeUpdated={() => toast.success("パスコードを更新しました")}
          user={selectedUser}
        />
      )}
    </div>
  )
}
