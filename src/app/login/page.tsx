"use client"

import { Plus, Settings, UserIcon } from "lucide-react"
import { useEffect, useState } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { useAuth } from "@/contexts/AuthContext"

import { PasscodeModal } from "./PasscodeModal"
import { UserCreateModal } from "./UserCreateModal"

interface User {
  id: string
  username: string
  name: string
  role: string
  passcodeType?: string | null
}

export default function UserSelection() {
  const [users, setUsers] = useState<User[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showPasscodeModal, setShowPasscodeModal] = useState(false)
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const { quickLogin } = useAuth()

  useEffect(() => {
    loadUsers()
  }, [])

  const loadUsers = async () => {
    try {
      const result = await window.electronAPI.fetchUsers()
      setUsers(result || [])
    } catch (error) {
      console.error("Failed to load users:", error)
      toast.error("ユーザー一覧の読み込みに失敗しました")
    } finally {
      setIsLoading(false)
    }
  }

  const handleUserSelect = async (user: User) => {
    if (user.passcodeType && user.passcodeType !== "none") {
      setSelectedUser(user)
      setShowPasscodeModal(true)
    } else {
      await quickLogin(user)
    }
  }

  const handlePasscodeVerified = async () => {
    if (selectedUser) {
      await quickLogin(selectedUser)
    }
  }

  const handleCreateUser = () => {
    setShowCreateModal(true)
  }

  const handleUserCreated = () => {
    loadUsers()
    toast.success("新しいユーザーが作成されました")
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-linear-to-br from-blue-50 to-indigo-100">
        <div className="text-center">
          <div className="mx-auto h-16 w-16 animate-spin rounded-full border-4 border-blue-500 border-t-transparent"></div>
          <p className="mt-4 text-lg text-gray-600">読み込み中...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-linear-to-br from-blue-50 to-indigo-100 p-4">
      <div className="w-full max-w-4xl">
        <div className="mb-8 text-center">
          <h1 className="mb-4 text-4xl font-bold text-gray-900">一括採点</h1>
          <p className="text-xl text-gray-600">
            ユーザーを選択して開始してください
          </p>
        </div>

        <div className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {users.map((user) => (
            <Card
              key={user.id}
              className="group cursor-pointer transition-all duration-200 hover:scale-105 hover:shadow-lg"
              onClick={() => handleUserSelect(user)}
            >
              <CardContent className="p-6 text-center">
                <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-linear-to-br from-blue-500 to-purple-600 transition-all duration-200 group-hover:from-blue-600 group-hover:to-purple-700">
                  <UserIcon className="h-10 w-10 text-white" />
                </div>
                <h3 className="mb-2 text-xl font-semibold text-gray-900">
                  {user.name}
                </h3>
                <p className="mb-1 text-gray-600">{user.username}</p>
                <p className="text-sm text-gray-500 capitalize">
                  {user.role || "教師"}
                </p>
                <Button
                  className="mt-4 w-full rounded-lg bg-linear-to-r from-blue-500 to-purple-600 px-4 py-2 font-medium text-white transition-all duration-200 hover:from-blue-600 hover:to-purple-700"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleUserSelect(user)
                  }}
                >
                  採点を開始
                </Button>
              </CardContent>
            </Card>
          ))}

          {/* Add new user card */}
          <Card
            className="group cursor-pointer border-2 border-dashed border-gray-300 transition-all duration-200 hover:scale-105 hover:shadow-lg"
            onClick={handleCreateUser}
          >
            <CardContent className="p-6 text-center">
              <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-gray-200 transition-all duration-200 group-hover:bg-gray-300">
                <Plus className="h-10 w-10 text-gray-600" />
              </div>
              <h3 className="mb-2 text-xl font-semibold text-gray-700">
                新しいユーザー
              </h3>
              <p className="mb-4 text-gray-500">ユーザーを追加</p>
              <Button
                variant="outline"
                className="mt-4 w-full border-gray-300 text-gray-700 hover:bg-gray-50"
                onClick={(e) => {
                  e.stopPropagation()
                  handleCreateUser()
                }}
              >
                追加
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="text-center">
          <Button
            variant="ghost"
            className="text-gray-600 hover:text-gray-800"
            onClick={() => toast.info("システム設定機能は後で実装予定です")}
          >
            <Settings className="mr-2 h-4 w-4" />
            システム設定
          </Button>
        </div>
      </div>

      <UserCreateModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onUserCreated={handleUserCreated}
      />

      {selectedUser && (
        <PasscodeModal
          isOpen={showPasscodeModal}
          onClose={() => setShowPasscodeModal(false)}
          user={selectedUser}
          onPasscodeVerified={handlePasscodeVerified}
        />
      )}
    </div>
  )
}
