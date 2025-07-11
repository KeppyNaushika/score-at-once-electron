import { createSharedPrismaClient } from "./databaseInitializer"

// 共有ドライブ対応のPrismaクライアント
const prisma = createSharedPrismaClient()

export default prisma
export function getPrismaClient() {
  return prisma
}
