import { PasswordDialogState } from "@/components/exams/01-upload/types"
import { ConvertedImage, convertPdfToImages } from "@/lib/pdfConverter"

/**
 * パスワード処理用のグローバル変数をクリアする
 */
export const clearPasswordGlobals = (): void => {
  window.__masterImagePasswordResolve = null
  window.__masterImagePasswordReject = null
  window.__masterImagePasswordFile = null
}

/**
 * パスワード処理用のグローバル変数を設定する
 * @param {(value: ConvertedImage[]) => void} resolve - Promise resolve関数
 * @param {(reason?: unknown) => void} reject - Promise reject関数
 * @param {File} file - 処理対象のファイル
 */
export const setPasswordGlobals = (
  resolve: (value: ConvertedImage[]) => void,
  reject: (reason?: unknown) => void,
  file: File
): void => {
  window.__masterImagePasswordResolve = resolve
  window.__masterImagePasswordReject = reject
  window.__masterImagePasswordFile = file
}

/**
 * パスワード処理用のグローバル変数を取得する
 * @returns {object} グローバル変数のオブジェクト
 */
export const getPasswordGlobals = (): {
  resolve: ((value: ConvertedImage[]) => void) | null
  reject: ((reason?: unknown) => void) | null
  file: File | null
} => {
  return {
    resolve: window.__masterImagePasswordResolve ?? null,
    reject: window.__masterImagePasswordReject ?? null,
    file: window.__masterImagePasswordFile ?? null,
  }
}

/**
 * パスワード付きPDFを変換する
 * @param {File} file - 変換対象のPDFファイル
 * @param {string} password - パスワード（オプション）
 * @returns {Promise<ConvertedImage[]>} 変換された画像データ
 * @throws {Error} パスワードが必要な場合やその他のエラー
 */
export const convertPdfWithPassword = async (
  file: File,
  password?: string
): Promise<ConvertedImage[]> => {
  try {
    return await convertPdfToImages(file, password)
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)

    if (
      errorMessage === "password-required" ||
      errorMessage === "invalid-password"
    ) {
      // パスワードが必要な場合、専用のエラーを投げる
      throw new Error(errorMessage)
    } else {
      // その他のエラーはそのまま投げる
      throw error
    }
  }
}

/**
 * パスワードダイアログの初期状態を作成する
 * @param {string} fileName - ファイル名
 * @param {boolean} isInvalidPassword - 無効なパスワードかどうか
 * @param {number} currentAttempts - 現在の試行回数
 * @returns {PasswordDialogState} パスワードダイアログの状態
 */
export const createPasswordDialogState = (
  fileName: string,
  isInvalidPassword: boolean = false,
  currentAttempts: number = 0
): PasswordDialogState => {
  return {
    isOpen: true,
    fileName,
    attempts: isInvalidPassword ? currentAttempts + 1 : 0,
    hasError: isInvalidPassword,
    isLoading: false,
  }
}

/**
 * パスワードダイアログを閉じた状態を作成する
 * @returns {PasswordDialogState} 閉じた状態のパスワードダイアログ
 */
export const createClosedPasswordDialogState = (): PasswordDialogState => {
  return {
    isOpen: false,
    fileName: undefined,
    attempts: 0,
    hasError: false,
    isLoading: false,
  }
}

/**
 * パスワード処理のローディング状態を作成する
 * @param {PasswordDialogState} currentState - 現在の状態
 * @returns {PasswordDialogState} ローディング状態
 */
export const createPasswordLoadingState = (
  currentState: PasswordDialogState
): PasswordDialogState => {
  return {
    ...currentState,
    isLoading: true,
    hasError: false,
  }
}

/**
 * パスワードエラー状態を作成する
 * @param {PasswordDialogState} currentState - 現在の状態
 * @returns {PasswordDialogState} エラー状態
 */
export const createPasswordErrorState = (
  currentState: PasswordDialogState
): PasswordDialogState => {
  return {
    ...currentState,
    isLoading: false,
    hasError: true,
    attempts: currentState.attempts + 1,
  }
}
