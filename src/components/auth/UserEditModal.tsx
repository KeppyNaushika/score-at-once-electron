"use client"

import { useMutation } from "@tanstack/react-query"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { type PublicUser, updateUserMutation } from "@/queries/user"

interface UserEditModalProps {
  isOpen: boolean
  onClose: () => void
  onUserUpdated: () => void
  user: PublicUser | null
}

export function UserEditModal({
  isOpen,
  onClose,
  onUserUpdated,
  user,
}: UserEditModalProps) {
  const [formData, setFormData] = useState({
    username: user?.username || "",
    name: user?.name || "",
  })
  const [error, setError] = useState("")
  const updateUser = useMutation(updateUserMutation())

  // 呼び出し側（settings/page.tsx）は閉じている間このコンポーネントを
  // マウントしないため、開くたびに対象ユーザーの値から始まる。

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    if (!user) {
      setError("ユーザー情報が見つかりません")
      return
    }

    updateUser.mutate(
      { id: user.id, username: formData.username, name: formData.name },
      {
        onSuccess: () => {
          onUserUpdated()
          onClose()
        },
      }
    )
  }

  const handleClose = () => {
    setError("")
    onClose()
  }

  if (!user) return null

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-106.25">
        <DialogHeader>
          <DialogTitle>ユーザー情報を編集</DialogTitle>
          <DialogDescription>
            ユーザー名と表示名を変更できます。
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="username">ユーザー名</Label>
            <Input
              id="username"
              value={formData.username}
              onChange={(e) =>
                setFormData({ ...formData, username: e.target.value })
              }
              placeholder="ユーザー名を入力"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="name">表示名</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              placeholder="表示名を入力"
              required
            />
          </div>

          {error && <div className="text-sm text-red-500">{error}</div>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose}>
              キャンセル
            </Button>
            <Button type="submit" disabled={updateUser.isPending}>
              {updateUser.isPending ? "更新中..." : "更新"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
