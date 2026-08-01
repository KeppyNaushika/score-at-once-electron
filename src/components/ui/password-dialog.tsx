"use client"

import { AlertCircle, Lock } from "lucide-react"
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
import { useDialogAutoFocus } from "@/hooks/useDialogAutoFocus"

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
  const { inputRef, onOpenAutoFocus } = useDialogAutoFocus(isOpen)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (password.trim()) {
      // 誤りだったときに前回の入力が残らないよう、送信と同時に消す
      setPassword("")
      onSubmit(password)
    }
  }

  // エラー時の振動効果
  useEffect(() => {
    if (error && !isFirstAttempt) {
      let canceled = false
      let cleanup: (() => void) | null = null

      const frame = requestAnimationFrame(() => {
        if (canceled) {
          return
        }

        setIsShaking(true)
        // 振動効果のリセット
        const timer = setTimeout(() => {
          if (canceled) {
            return
          }
          setIsShaking(false)
        }, 600)

        cleanup = () => {
          clearTimeout(timer)
        }
      })

      return () => {
        canceled = true
        cancelAnimationFrame(frame)
        if (cleanup) {
          cleanup()
        }
      }
    }
  }, [error, isFirstAttempt])

  // パスワード違いの再試行では、呼び出し側（usePdfPasswordConversion）が
  // isOpen を true のまま isLoading だけ戻すため Dialog は再マウントされず、
  // onOpenAutoFocus も再発火しない。入力のクリアは handleSubmit 側で済むので、
  // ここではフォーカスを戻すだけにする。
  useEffect(() => {
    if (isOpen && !isLoading && error && !isFirstAttempt) {
      inputRef.current?.focus()
    }
  }, [isOpen, isLoading, error, isFirstAttempt, inputRef])

  const handleClose = () => {
    setPassword("")
    onClose()
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md" onOpenAutoFocus={onOpenAutoFocus}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5 text-amber-600" />
            PDFパスワード入力
          </DialogTitle>
          <DialogDescription>
            <span className="font-medium">{fileName}</span>{" "}
            はパスワードで保護されています。
          </DialogDescription>
          <p className="mt-1 text-sm text-muted-foreground">
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
              disabled={isLoading}
              className={isShaking ? "animate-pulse border-red-500" : ""}
              style={{
                animation: isShaking ? "shake 0.6s ease-in-out" : "none",
              }}
            />
          </div>

          {error && !isFirstAttempt && (
            <div className="flex items-center gap-2 rounded-md bg-red-50 p-3 text-sm text-red-600">
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
            <Button type="submit" disabled={!password.trim() || isLoading}>
              {isLoading ? "処理中..." : "OK"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
