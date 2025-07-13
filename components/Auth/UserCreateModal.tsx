"use client"

import { useState } from "react"
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

interface UserCreateModalProps {
  isOpen: boolean
  onClose: () => void
  onUserCreated: () => void
}

type PasscodeType = "none" | "4digit" | "6digit" | "alphanumeric"

export function UserCreateModal({ isOpen, onClose, onUserCreated }: UserCreateModalProps) {
  const [formData, setFormData] = useState({
    username: "",
    name: "",
  })
  const [passcodeType, setPasscodeType] = useState<PasscodeType>("none")
  const [passcode, setPasscode] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
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

      await window.electronAPI.createUser({
        username: formData.username,
        name: formData.name,
        passcode: passcodeType === "none" ? undefined : passcode,
        passcodeType,
      })

      // Reset form
      setFormData({ username: "", name: "" })
      setPasscodeType("none")
      setPasscode("")
      
      onUserCreated()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : "ユーザーの作成に失敗しました")
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

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>新しいユーザーを作成</DialogTitle>
          <DialogDescription>
            新しいユーザーアカウントを作成します。パスコードは任意で設定できます。
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="username">ユーザー名</Label>
            <Input
              id="username"
              value={formData.username}
              onChange={(e) => setFormData({ ...formData, username: e.target.value })}
              placeholder="ユーザー名を入力"
              required
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="name">表示名</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="表示名を入力"
              required
            />
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
              {isLoading ? "作成中..." : "作成"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}