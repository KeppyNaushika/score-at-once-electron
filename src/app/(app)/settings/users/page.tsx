"use client"

import { useQuery } from "@tanstack/react-query"
import { useState } from "react"
import { toast } from "sonner"

import { UserManagementSection } from "@/app/(app)/settings/components/UserManagementSection"
import { PasscodeEditModal } from "@/components/auth/PasscodeEditModal"
import { UserDeleteModal } from "@/components/auth/UserDeleteModal"
import { UserEditModal } from "@/components/auth/UserEditModal"
import { type PublicUser, userListQuery } from "@/queries/user"

/** 未取得のときに毎回新しい配列を作らないための空値 */
const EMPTY_USERS: PublicUser[] = []

export default function UserSettingsPage() {
  const { data: users = EMPTY_USERS } = useQuery(userListQuery())
  const [isPasscodeEditOpen, setIsPasscodeEditOpen] = useState(false)
  const [isUserEditOpen, setIsUserEditOpen] = useState(false)
  const [selectedUser, setSelectedUser] = useState<PublicUser | null>(null)
  const [deletingUser, setDeletingUser] = useState<PublicUser | null>(null)

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
    <>
      <UserManagementSection
        users={users}
        onEditUser={handleEditUser}
        onEditPasscode={handleEditPasscode}
        onDeleteUser={setDeletingUser}
      />

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

      {/* 閉じている間はマウントしない。開くたびに消えるデータを数え直す */}
      {deletingUser && (
        <UserDeleteModal
          isOpen
          onClose={() => setDeletingUser(null)}
          user={deletingUser}
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
    </>
  )
}
