"use client"

import { useEffect, useState } from "react"

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

interface User {
  id: string
  username: string
  name: string
  role: string
  passcodeType?: string | null
}

interface UserEditModalProps {
  isOpen: boolean
  onClose: () => void
  onUserUpdated: () => void
  user: User | null
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
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")

  // Update form data when user prop changes
  useEffect(() => {
    if (user) {
      setFormData({
        username: user.username,
        name: user.name,
      })
    }
  }, [user])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setIsLoading(true)

    if (!user) {
      setError("ユーザー情報が見つかりません")
      setIsLoading(false)
      return
    }

    try {
      await window.electronAPI.updateUser(user.id, {
        username: formData.username,
        name: formData.name,
      })

      onUserUpdated()
      onClose()
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "ユーザーの更新に失敗しました"
      )
    } finally {
      setIsLoading(false)
    }
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
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "更新中..." : "更新"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
