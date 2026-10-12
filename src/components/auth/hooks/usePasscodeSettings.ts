import { useState } from "react"

const PASSCODE_TYPES = ["none", "4digit", "6digit", "alphanumeric"] as const

export type PasscodeType = (typeof PASSCODE_TYPES)[number]

function isPasscodeType(
  passcodeTypeText: string | null | undefined
): passcodeTypeText is PasscodeType {
  return PASSCODE_TYPES.some(
    (passcodeType) => passcodeType === passcodeTypeText
  )
}

/** DBや選択肢から来た文字列を PasscodeType へ絞り込む（未知の値は none 扱い） */
export function toPasscodeType(
  passcodeTypeText: string | null | undefined
): PasscodeType {
  return isPasscodeType(passcodeTypeText) ? passcodeTypeText : "none"
}

/** 英数字のパスコードの長さ（入力欄の minLength / maxLength と同じ値） */
export const ALPHANUMERIC_PASSCODE_MIN_LENGTH = 4
export const ALPHANUMERIC_PASSCODE_MAX_LENGTH = 20

const ALPHANUMERIC_PASSCODE_PATTERN = new RegExp(
  `^[A-Za-z0-9]{${ALPHANUMERIC_PASSCODE_MIN_LENGTH},${ALPHANUMERIC_PASSCODE_MAX_LENGTH}}$`
)

/**
 * 送信前の検証。問題があればエラー文言、無ければ null を返す
 *
 * 入力欄の制限（OTP の pattern・maxLength）は貼り付けなどで抜けうるので、
 * 桁数だけでなく文字の種類もここで確かめる。
 */
function getPasscodeError(
  passcodeType: PasscodeType,
  passcode: string
): string | null {
  if (passcodeType !== "none" && !passcode) {
    return "パスコードを入力してください"
  }
  if (passcodeType === "4digit" && !/^[0-9]{4}$/.test(passcode)) {
    return "4桁の数字でパスコードを入力してください"
  }
  if (passcodeType === "6digit" && !/^[0-9]{6}$/.test(passcode)) {
    return "6桁の数字でパスコードを入力してください"
  }
  if (
    passcodeType === "alphanumeric" &&
    !ALPHANUMERIC_PASSCODE_PATTERN.test(passcode)
  ) {
    return `英数字のパスコードは半角の英字と数字で${ALPHANUMERIC_PASSCODE_MIN_LENGTH}〜${ALPHANUMERIC_PASSCODE_MAX_LENGTH}文字で入力してください`
  }
  return null
}

/**
 * パスコードの種類と入力値を持つ。種類を変えると入力値は消える。
 * 入力値はこのフックを使うコンポーネントがマウントされている間だけ保持される。
 */
export function usePasscodeSettings(initialPasscodeType: PasscodeType) {
  const [passcodeType, setPasscodeType] =
    useState<PasscodeType>(initialPasscodeType)
  const [passcode, setPasscode] = useState("")

  const changePasscodeType = (nextPasscodeType: PasscodeType) => {
    setPasscodeType(nextPasscodeType)
    setPasscode("")
  }

  const clearPasscode = () => {
    setPasscode("")
  }

  /** 種類を最初の値へ戻し、入力値を消す */
  const resetPasscodeSettings = () => {
    setPasscodeType(initialPasscodeType)
    setPasscode("")
  }

  return {
    passcodeType,
    passcode,
    setPasscode,
    changePasscodeType,
    clearPasscode,
    resetPasscodeSettings,
    passcodeError: getPasscodeError(passcodeType, passcode),
    /** 送信に載せる値。パスコードなしのときは undefined */
    submittedPasscode: passcodeType === "none" ? undefined : passcode,
  }
}
