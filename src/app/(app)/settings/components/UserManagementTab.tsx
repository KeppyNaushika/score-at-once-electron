"use client"

import { Edit3, UserPen } from "lucide-react"

import { Button } from "@/components/ui/button"
import type { PublicUser } from "@/queries/user"

/**
 * パスコードの種類の表示名。語はパスコード編集画面の選択肢
 * （PasscodeEditModal / UserCreateModal）と揃える
 */
const PASSCODE_TYPE_LABELS: Record<string, string> = {
  "4digit": "4桁数字",
  "6digit": "6桁数字",
  alphanumeric: "英数字",
}

interface UserManagementTabProps {
  users: PublicUser[]
  onEditUser: (user: PublicUser) => void
  onEditPasscode: (user: PublicUser) => void
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
                    パスコード:{" "}
                    {PASSCODE_TYPE_LABELS[user.passcodeType] ?? "設定済み"}
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
