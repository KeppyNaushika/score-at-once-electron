"use client"

import { Edit3, UserPen } from "lucide-react"

import { Button } from "@/components/ui/button"

interface User {
  id: string
  username: string
  name: string
  role: string
  passcodeType?: string | null
}

interface UserManagementTabProps {
  users: User[]
  onEditUser: (user: User) => void
  onEditPasscode: (user: User) => void
}

export function UserManagementTab({
  users,
  onEditUser,
  onEditPasscode,
}: UserManagementTabProps) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">ユーザー管理</h2>
        <p className="text-sm text-muted-foreground">
          ユーザー情報とパスコードを管理します
        </p>
      </div>

      <div className="space-y-3">
        {users.map((user) => (
          <div
            key={user.id}
            className="flex items-center justify-between rounded-lg border p-3"
          >
            <div>
              <div className="font-medium">{user.name}</div>
              <div className="text-sm text-muted-foreground">
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
                onClick={() => onEditUser(user)}
              >
                <Edit3 className="mr-2 h-4 w-4" />
                ユーザー情報編集
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onEditPasscode(user)}
              >
                <UserPen className="mr-2 h-4 w-4" />
                パスコード編集
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
