/**
 * Prisma のエラー判定。
 *
 * 対象が消えたことを「失敗」ではなく「もうその状態になっている」と扱いたい経路が
 * 複数あるため、判定をここに置く（採点の保存・採点担当の解除）。
 */

/**
 * Prisma の「更新/削除対象が見つからない」エラー（P2025）か。
 *
 * 存在チェックと書き込みのあいだに同期が相手の DELETE を適用した、といった隙間で出る。
 */
export function isRecordNotFoundError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "P2025"
  )
}
