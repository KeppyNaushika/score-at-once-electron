import { PrismaClient } from "@prisma/client"
import { createSharedPrismaClient } from "./databaseInitializer"

// 共有ドライブ対応のPrismaクライアント
const prisma = createSharedPrismaClient()

export default prisma
