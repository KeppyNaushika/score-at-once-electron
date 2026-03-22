"use client"

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
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp"
import { Label } from "@/components/ui/label"

interface PasscodeModalProps {
  isOpen: boolean
  onClose: () => void
  user: {
    id: string
    name: string
    passcodeType?: string | null
  }
  onPasscodeVerified: () => void
}

export function PasscodeModal({
  isOpen,
  onClose,
  user,
  onPasscodeVerified,
}: PasscodeModalProps) {
  const [passcode, setPasscode] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setIsLoading(true)

    try {
      const isValid = await window.electronAPI.verifyPasscode(user.id, passcode)

      if (isValid) {
        setPasscode("")
        onPasscodeVerified()
        onClose()
      } else {
        setError("パスコードが正しくありません")
      }
    } catch {
      setError("パスコードの確認に失敗しました")
    } finally {
      setIsLoading(false)
    }
  }

  const renderPasscodeInput = () => {
    if (user.passcodeType === "4digit") {
      return (
        <InputOTP
          maxLength={4}
          value={passcode}
          onChange={setPasscode}
          pattern="[0-9]*"
        >
          <InputOTPGroup>
            <InputOTPSlot index={0} />
            <InputOTPSlot index={1} />
            <InputOTPSlot index={2} />
            <InputOTPSlot index={3} />
          </InputOTPGroup>
        </InputOTP>
      )
    }

    if (user.passcodeType === "6digit") {
      return (
        <InputOTP
          maxLength={6}
          value={passcode}
          onChange={setPasscode}
          pattern="[0-9]*"
        >
          <InputOTPGroup>
            <InputOTPSlot index={0} />
            <InputOTPSlot index={1} />
            <InputOTPSlot index={2} />
            <InputOTPSlot index={3} />
            <InputOTPSlot index={4} />
            <InputOTPSlot index={5} />
          </InputOTPGroup>
        </InputOTP>
      )
    }

    if (user.passcodeType === "alphanumeric") {
      return (
        <Input
          type="password"
          value={passcode}
          onChange={(e) => setPasscode(e.target.value)}
          placeholder="パスコードを入力"
          autoFocus
        />
      )
    }

    return null
  }

  const getPasscodeLabel = () => {
    switch (user.passcodeType) {
      case "4digit":
        return "4桁パスコード"
      case "6digit":
        return "6桁パスコード"
      case "alphanumeric":
        return "英数字パスコード"
      default:
        return "パスコード"
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[350px]">
        <DialogHeader>
          <DialogTitle>{user.name}</DialogTitle>
          <DialogDescription>
            パスコードを入力してログインしてください
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="passcode">{getPasscodeLabel()}</Label>
            {renderPasscodeInput()}
          </div>

          {error && <div className="text-sm text-red-500">{error}</div>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              キャンセル
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "確認中..." : "ログイン"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
