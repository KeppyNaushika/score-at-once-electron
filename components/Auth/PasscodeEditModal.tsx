"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

interface User {
  id: string
  username: string
  name: string
  role: string
  passcodeType?: string
}

interface PasscodeEditModalProps {
  isOpen: boolean
  onClose: () => void
  onPasscodeUpdated: () => void
  user: User | null
}

type PasscodeType = "none" | "4digit" | "6digit" | "alphanumeric"

export function PasscodeEditModal({ isOpen, onClose, onPasscodeUpdated, user }: PasscodeEditModalProps) {
  const [passcodeType, setPasscodeType] = useState<PasscodeType>("none")
  const [passcode, setPasscode] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")

  // ユーザー情報が変更されたときに初期値を設定
  useEffect(() => {
    if (user) {
      setPasscodeType((user.passcodeType as PasscodeType) || "none")
      setPasscode("")
      setError("")
    }
  }, [user])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return

    setError("")
    setIsLoading(true)

    try {
      if (passcodeType !== "none" && !passcode) {
        setError("パスコードを入力してください")
        return
      }

      if (passcodeType === "4digit" && passcode.length !== 4) {
        setError("4桁のパスコードを入力してください")
        return
      }

      if (passcodeType === "6digit" && passcode.length !== 6) {
        setError("6桁のパスコードを入力してください")
        return
      }

      if (passcodeType === "alphanumeric" && passcode.length < 4) {
        setError("英数字のパスコードは4文字以上で入力してください")
        return
      }

      await window.electronAPI.updateUserPasscode(
        user.id,
        passcodeType === "none" ? undefined : passcode,
        passcodeType
      )

      // Reset form
      setPasscode("")
      
      onPasscodeUpdated()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : "パスコードの更新に失敗しました")
    } finally {
      setIsLoading(false)
    }
  }

  const renderPasscodeInput = () => {
    if (passcodeType === "none") return null

    if (passcodeType === "4digit") {
      return (
        <div className="space-y-2">
          <Label htmlFor="passcode">4桁パスコード</Label>
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
        </div>
      )
    }

    if (passcodeType === "6digit") {
      return (
        <div className="space-y-2">
          <Label htmlFor="passcode">6桁パスコード</Label>
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
        </div>
      )
    }

    if (passcodeType === "alphanumeric") {
      return (
        <div className="space-y-2">
          <Label htmlFor="passcode">英数字パスコード</Label>
          <Input
            id="passcode"
            type="password"
            value={passcode}
            onChange={(e) => setPasscode(e.target.value)}
            placeholder="英数字で入力"
            minLength={4}
            maxLength={20}
          />
        </div>
      )
    }

    return null
  }

  if (!user) return null

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>パスコード編集</DialogTitle>
          <DialogDescription>
            {user.name}さんのパスコードを編集します
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>ユーザー名</Label>
            <div className="px-3 py-2 bg-gray-50 rounded-md text-sm text-gray-700">
              {user.username}
            </div>
          </div>
          
          <div className="space-y-2">
            <Label>表示名</Label>
            <div className="px-3 py-2 bg-gray-50 rounded-md text-sm text-gray-700">
              {user.name}
            </div>
          </div>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">パスコード設定</CardTitle>
              <CardDescription className="text-xs">
                間違って他のユーザーを選択しないための簡単なパスコードです
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="passcodeType">パスコードタイプ</Label>
                <Select value={passcodeType} onValueChange={(value: PasscodeType) => {
                  setPasscodeType(value)
                  setPasscode("")
                }}>
                  <SelectTrigger>
                    <SelectValue placeholder="パスコードタイプを選択" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">パスコードなし</SelectItem>
                    <SelectItem value="4digit">4桁数字</SelectItem>
                    <SelectItem value="6digit">6桁数字</SelectItem>
                    <SelectItem value="alphanumeric">英数字</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              {renderPasscodeInput()}
            </CardContent>
          </Card>

          {error && (
            <div className="text-sm text-red-500">{error}</div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
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