import { createSharedPrismaClient } from "./databaseInitializer"

// 共有ドライブ対応のPrismaクライアント（毎回新しいインスタンスを作成）
export default createSharedPrismaClient()

/** 共有ドライブ対応のPrismaクライアントを新規作成して返す */
export function getPrismaClient() {
  return createSharedPrismaClient()
}
