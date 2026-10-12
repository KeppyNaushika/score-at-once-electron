"use client"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

interface UserProfileFieldsProps {
  username: string
  name: string
  onUsernameChange: (username: string) => void
  onNameChange: (name: string) => void
}

/** ユーザー名と表示名の入力欄（どちらも必須） */
export function UserProfileFields({
  username,
  name,
  onUsernameChange,
  onNameChange,
}: UserProfileFieldsProps) {
  return (
    <>
      <div className="space-y-2">
        <Label htmlFor="username">ユーザー名</Label>
        <Input
          id="username"
          value={username}
          onChange={(e) => onUsernameChange(e.target.value)}
          placeholder="ユーザー名を入力"
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="name">表示名</Label>
        <Input
          id="name"
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          placeholder="表示名を入力"
          required
        />
      </div>
    </>
  )
}
