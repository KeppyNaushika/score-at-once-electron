"use client"

import { useMutation } from "@tanstack/react-query"
import { useState } from "react"

import {
  toPasscodeType,
  usePasscodeSettings,
} from "@/components/auth/hooks/usePasscodeSettings"
import { PasscodeSettingsCard } from "@/components/auth/PasscodeSettingsCard"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { type PublicUser, updateUserPasscodeMutation } from "@/queries/user"

interface PasscodeEditModalProps {
  isOpen: boolean
  onClose: () => void
  onPasscodeUpdated: () => void
  user: PublicUser | null
}

export function PasscodeEditModal({
  isOpen,
  onClose,
  onPasscodeUpdated,
  user,
}: PasscodeEditModalProps) {
  // 呼び出し側（settings/page.tsx）は閉じている間このコンポーネントを
  // マウントしないため、開くたびに対象ユーザーの値から始まる。
  const passcodeSettings = usePasscodeSettings(
    toPasscodeType(user?.passcodeType)
  )
  const [error, setError] = useState("")
  const updateUserPasscode = useMutation(updateUserPasscodeMutation())

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return

    setError("")

    if (passcodeSettings.passcodeError) {
      setError(passcodeSettings.passcodeError)
      return
    }

    updateUserPasscode.mutate(
      {
        userId: user.id,
        passcode: passcodeSettings.submittedPasscode,
        passcodeType: passcodeSettings.passcodeType,
      },
      {
        onSuccess: () => {
          passcodeSettings.clearPasscode()
          onPasscodeUpdated()
          onClose()
        },
      }
    )
  }

  if (!user) return null

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-106.25">
        <DialogHeader>
          <DialogTitle>パスコード編集</DialogTitle>
          <DialogDescription>
            {user.name}さんのパスコードを編集します
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>ユーザー名</Label>
            <div className="rounded-md bg-gray-50 px-3 py-2 text-sm text-gray-700">
              {user.username}
            </div>
          </div>

          <div className="space-y-2">
            <Label>表示名</Label>
            <div className="rounded-md bg-gray-50 px-3 py-2 text-sm text-gray-700">
              {user.name}
            </div>
          </div>

          <PasscodeSettingsCard
            passcodeType={passcodeSettings.passcodeType}
            passcode={passcodeSettings.passcode}
            onPasscodeTypeChange={passcodeSettings.changePasscodeType}
            onPasscodeChange={passcodeSettings.setPasscode}
          />

          {error && <div className="text-sm text-red-500">{error}</div>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              キャンセル
            </Button>
            <Button type="submit" disabled={updateUserPasscode.isPending}>
              {updateUserPasscode.isPending ? "更新中..." : "更新"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
