import { createSharedPrismaClient } from "./databaseInitializer"

// 共有ドライブ対応のPrismaクライアント（毎回新しいインスタンスを作成）
export default createSharedPrismaClient()

export function getPrismaClient() {
  return createSharedPrismaClient()
}
