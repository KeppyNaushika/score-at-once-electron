/**
 * テスト用Prismaクライアント
 *
 * Electron依存のdataManagerを回避し、テスト用SQLiteファイルに直接接続する
 */

import { PrismaClient } from "@prisma/client"
import * as path from "path"

const TEST_DB_PATH = path.resolve(__dirname, "../../data/test-database.db")
const TEST_DATABASE_URL = `file:${TEST_DB_PATH}`

let _testPrisma: PrismaClient | null = null

export function getTestPrismaClient(): PrismaClient {
  if (!_testPrisma) {
    _testPrisma = new PrismaClient({
      datasources: {
        db: {
          url: TEST_DATABASE_URL,
        },
      },
      log: ["error"],
    })
  }
  return _testPrisma
}

export async function disconnectTestPrisma(): Promise<void> {
  if (_testPrisma) {
    await _testPrisma.$disconnect()
    _testPrisma = null
  }
}

/**
 * テスト用DBの全テーブルをクリーンアップ
 * 外部キー制約の順序に注意してDELETEする
 */
export async function cleanupTestDatabase(): Promise<void> {
  const prisma = getTestPrismaClient()

  // 外部キー制約の依存順序に従い、子テーブルから削除
  // Grade関連
  await prisma.manualScore.deleteMany()
  await prisma.gradeBoundary.deleteMany()
  await prisma.gradeBoundarySet.deleteMany()
  await prisma.gradeDataSource.deleteMany()
  await prisma.gradeItem.deleteMany()
  await prisma.gradeProjectStudent.deleteMany()
  await prisma.gradeProjectClass.deleteMany()
  await prisma.gradeProject.deleteMany()
  // Score関連
  await prisma.drawingAnnotation.deleteMany()
  await prisma.questionScore.deleteMany()
  await prisma.cropRegionMarkingOverride.deleteMany()
  await prisma.cropSubtotal.deleteMany()
  await prisma.cropRegion.deleteMany()
  await prisma.masterImage.deleteMany()
  await prisma.studentAnswerImage.deleteMany()
  await prisma.projectPage.deleteMany()
  await prisma.projectExportSettings.deleteMany()
  await prisma.projectMarkingFormat.deleteMany()
  await prisma.projectSubtotalGroup.deleteMany()
  await prisma.projectStudent.deleteMany()
  await prisma.projectClass.deleteMany()
  await prisma.userProject.deleteMany()
  await prisma.project.deleteMany()
  await prisma.subtotal.deleteMany()
  await prisma.subtotalGroup.deleteMany()
  await prisma.subjectSubtotalGroup.deleteMany()
  await prisma.subject.deleteMany()
  await prisma.studentClassMembership.deleteMany()
  await prisma.student.deleteMany()
  await prisma.class.deleteMany()
  await prisma.userKeyboardShortcut.deleteMany()
  await prisma.userScoringPreference.deleteMany()
  await prisma.user.deleteMany()
}

/**
 * テスト用に基本的なユーザーを作成
 */
export async function createTestUser(
  overrides: {
    id?: string
    username?: string
    name?: string
  } = {}
): Promise<{ id: string; username: string; name: string }> {
  const prisma = getTestPrismaClient()
  const user = await prisma.user.create({
    data: {
      id: overrides.id ?? crypto.randomUUID(),
      username: overrides.username ?? `testuser_${Date.now()}`,
      name: overrides.name ?? "テストユーザー",
      role: "teacher",
    },
  })
  return { id: user.id, username: user.username, name: user.name }
}
