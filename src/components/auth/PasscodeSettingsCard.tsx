"use client"

import { useId } from "react"

import {
  ALPHANUMERIC_PASSCODE_MAX_LENGTH,
  ALPHANUMERIC_PASSCODE_MIN_LENGTH,
  type PasscodeType,
  toPasscodeType,
} from "@/components/auth/hooks/usePasscodeSettings"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface PasscodeSettingsCardProps {
  passcodeType: PasscodeType
  passcode: string
  onPasscodeTypeChange: (passcodeType: PasscodeType) => void
  onPasscodeChange: (passcode: string) => void
}

interface PasscodeInputProps {
  passcodeType: PasscodeType
  passcode: string
  onPasscodeChange: (passcode: string) => void
}

function PasscodeInput({
  passcodeType,
  passcode,
  onPasscodeChange,
}: PasscodeInputProps) {
  const passcodeInputId = useId()

  if (passcodeType === "4digit") {
    return (
      <div className="space-y-2">
        <Label htmlFor={passcodeInputId}>4桁パスコード</Label>
        <InputOTP
          id={passcodeInputId}
          maxLength={4}
          value={passcode}
          onChange={onPasscodeChange}
          pattern="[0-9]*"
        >
          <InputOTPGroup>
            <InputOTPSlot index={0} masked />
            <InputOTPSlot index={1} masked />
            <InputOTPSlot index={2} masked />
            <InputOTPSlot index={3} masked />
          </InputOTPGroup>
        </InputOTP>
      </div>
    )
  }

  if (passcodeType === "6digit") {
    return (
      <div className="space-y-2">
        <Label htmlFor={passcodeInputId}>6桁パスコード</Label>
        <InputOTP
          id={passcodeInputId}
          maxLength={6}
          value={passcode}
          onChange={onPasscodeChange}
          pattern="[0-9]*"
        >
          <InputOTPGroup>
            <InputOTPSlot index={0} masked />
            <InputOTPSlot index={1} masked />
            <InputOTPSlot index={2} masked />
            <InputOTPSlot index={3} masked />
            <InputOTPSlot index={4} masked />
            <InputOTPSlot index={5} masked />
          </InputOTPGroup>
        </InputOTP>
      </div>
    )
  }

  if (passcodeType === "alphanumeric") {
    return (
      <div className="space-y-2">
        <Label htmlFor={passcodeInputId}>英数字パスコード</Label>
        <Input
          id={passcodeInputId}
          type="password"
          value={passcode}
          onChange={(e) => onPasscodeChange(e.target.value)}
          placeholder="半角の英字と数字で入力"
          minLength={ALPHANUMERIC_PASSCODE_MIN_LENGTH}
          maxLength={ALPHANUMERIC_PASSCODE_MAX_LENGTH}
        />
      </div>
    )
  }

  return null
}

/** パスコードの種類の選択と、種類に応じた入力欄 */
export function PasscodeSettingsCard({
  passcodeType,
  passcode,
  onPasscodeTypeChange,
  onPasscodeChange,
}: PasscodeSettingsCardProps) {
  const passcodeTypeSelectId = useId()

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">パスコード設定</CardTitle>
        <CardDescription className="text-xs">
          間違って他のユーザーを選択しないための簡単なパスコードです
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor={passcodeTypeSelectId}>パスコードタイプ</Label>
          <Select
            value={passcodeType}
            onValueChange={(value) =>
              onPasscodeTypeChange(toPasscodeType(value))
            }
          >
            <SelectTrigger id={passcodeTypeSelectId}>
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

        <PasscodeInput
          passcodeType={passcodeType}
          passcode={passcode}
          onPasscodeChange={onPasscodeChange}
        />
      </CardContent>
    </Card>
  )
}
