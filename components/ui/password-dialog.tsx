"use client"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Lock, AlertCircle } from "lucide-react"
import { useState, useEffect, useRef } from "react"

interface PasswordDialogProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (password: string) => void
  fileName: string
  error?: string
  isLoading?: boolean
  isFirstAttempt?: boolean
}

export function PasswordDialog({
  isOpen,
  onClose,
  onSubmit,
  fileName,
  error,
  isLoading = false,
  isFirstAttempt = true,
}: PasswordDialogProps) {
  const [password, setPassword] = useState("")
  const [isShaking, setIsShaking] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (password.trim()) {
      onSubmit(password)
    }
  }

  // エラー時の振動効果
  useEffect(() => {
    if (error && !isFirstAttempt) {
      setIsShaking(true)
      // 振動効果のリセット
      const timer = setTimeout(() => {
        setIsShaking(false)
      }, 600)
      return () => clearTimeout(timer)
    }
  }, [error, isFirstAttempt])

  // ダイアログが開かれた時にパスワードをクリア
  useEffect(() => {
    if (isOpen) {
      setPassword("")
      setIsShaking(false)
    }
  }, [isOpen])

  const handleClose = () => {
    setPassword("")
    onClose()
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5 text-amber-600" />
            PDFパスワード入力
          </DialogTitle>
          <DialogDescription>
            <span className="font-medium">{fileName}</span> はパスワードで保護されています。
          </DialogDescription>
          <p className="text-sm text-muted-foreground mt-1">
            パスワードを入力してファイルを読み込んでください。
          </p>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="pdf-password">パスワード</Label>
            <Input
              ref={inputRef}
              id="pdf-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="PDFのパスワードを入力"
              autoFocus
              disabled={isLoading}
              className={isShaking ? "animate-pulse border-red-500" : ""}
              style={{
                animation: isShaking ? "shake 0.6s ease-in-out" : "none",
              }}
            />
          </div>

          {error && !isFirstAttempt && (
            <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 p-3 rounded-md">
              <AlertCircle className="h-4 w-4" />
              パスワードが間違っている可能性があります
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isLoading}
            >
              キャンセル
            </Button>
            <Button
              type="submit"
              disabled={!password.trim() || isLoading}
            >
              {isLoading ? "処理中..." : "OK"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}