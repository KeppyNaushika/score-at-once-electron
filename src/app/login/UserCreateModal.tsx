"use client"

import { useMutation } from "@tanstack/react-query"
import { useState } from "react"

import { usePasscodeSettings } from "@/components/auth/hooks/usePasscodeSettings"
import { PasscodeSettingsCard } from "@/components/auth/PasscodeSettingsCard"
import { UserProfileFields } from "@/components/auth/UserProfileFields"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { createUserMutation } from "@/queries/user"

interface UserCreateModalProps {
  isOpen: boolean
  onClose: () => void
  onUserCreated: () => void
}

export function UserCreateModal({
  isOpen,
  onClose,
  onUserCreated,
}: UserCreateModalProps) {
  const [formData, setFormData] = useState({
    username: "",
    name: "",
  })
  const passcodeSettings = usePasscodeSettings("none")
  const [error, setError] = useState("")
  const createUser = useMutation(createUserMutation())

  /**
   * 閉じるときは入力をすべて消す。このモーダルは login/page.tsx に常にマウントされて
   * いるので、消さないとパスコードや前回のエラーが次に開いたときに残る
   */
  const handleClose = () => {
    setFormData({ username: "", name: "" })
    passcodeSettings.resetPasscodeSettings()
    setError("")
    onClose()
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    if (passcodeSettings.passcodeError) {
      setError(passcodeSettings.passcodeError)
      return
    }

    createUser.mutate(
      {
        username: formData.username,
        name: formData.name,
        passcode: passcodeSettings.submittedPasscode,
        passcodeType: passcodeSettings.passcodeType,
      },
      {
        onSuccess: () => {
          onUserCreated()
          handleClose()
        },
      }
    )
  }

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) handleClose()
      }}
    >
      <DialogContent className="sm:max-w-106.25">
        <DialogHeader>
          <DialogTitle>新しいユーザーを作成</DialogTitle>
          <DialogDescription>
            新しいユーザーアカウントを作成します。パスコードは任意で設定できます。
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <UserProfileFields
            username={formData.username}
            name={formData.name}
            onUsernameChange={(username) =>
              setFormData({ ...formData, username })
            }
            onNameChange={(name) => setFormData({ ...formData, name })}
          />

          <PasscodeSettingsCard
            passcodeType={passcodeSettings.passcodeType}
            passcode={passcodeSettings.passcode}
            onPasscodeTypeChange={passcodeSettings.changePasscodeType}
            onPasscodeChange={passcodeSettings.setPasscode}
          />

          {error && <div className="text-sm text-red-500">{error}</div>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose}>
              キャンセル
            </Button>
            <Button type="submit" disabled={createUser.isPending}>
              {createUser.isPending ? "作成中..." : "作成"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
