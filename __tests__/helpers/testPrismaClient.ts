/**
 * テスト用Prismaクライアント
 *
 * Electron依存のdataManagerを回避し、テスト用SQLiteファイルに直接接続する
 */

import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3"
import { PrismaClient } from "@prisma/client"
import * as path from "path"

const TEST_DB_PATH = path.resolve(__dirname, "../../data/test-database.db")

/** 任意のSQLiteファイルパスからPrismaClientを生成する */
export function createPrismaClientForPath(dbPath: string): PrismaClient {
  const adapter = new PrismaBetterSqlite3({ url: dbPath })
  return new PrismaClient({ adapter, log: ["error"] })
}

let _testPrisma: PrismaClient | null = null

export function getTestPrismaClient(): PrismaClient {
  if (!_testPrisma) {
    _testPrisma = createPrismaClientForPath(TEST_DB_PATH)
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
  await prisma.gradeBoundary.deleteMany()
  await prisma.gradeBoundarySet.deleteMany()
  await prisma.gradeDataSource.deleteMany()
  await prisma.gradeItem.deleteMany()
  await prisma.gradeStudent.deleteMany()
  await prisma.gradeClassroom.deleteMany()
  await prisma.grade.deleteMany()
  // Coursework関連（gradeDataSource 削除後に評価項目を削除）
  await prisma.courseworkScore.deleteMany()
  await prisma.courseworkLetterScale.deleteMany()
  await prisma.courseworkItem.deleteMany()
  await prisma.courseworkTag.deleteMany()
  await prisma.courseworkClassroom.deleteMany()
  await prisma.courseworkStudent.deleteMany()
  await prisma.coursework.deleteMany()
  // Score関連
  await prisma.drawingAnnotation.deleteMany()
  await prisma.questionScore.deleteMany()
  await prisma.cropRegionOmrChoiceOption.deleteMany()
  await prisma.cropRegionOmrConfig.deleteMany()
  await prisma.cropSubtotal.deleteMany()
  await prisma.cropRegion.deleteMany()
  await prisma.masterImage.deleteMany()
  await prisma.studentAnswerImage.deleteMany()
  await prisma.examPage.deleteMany()
  await prisma.examAnswerOverlayStyle.deleteMany()
  await prisma.examAnswerOverlayVisibility.deleteMany()
  await prisma.examIndividualReportTableSection.deleteMany()
  await prisma.examIndividualReportGraphSettings.deleteMany()
  await prisma.examIndividualReportSettings.deleteMany()
  await prisma.examSubtotalGroup.deleteMany()
  await prisma.examStudent.deleteMany()
  await prisma.examClassroom.deleteMany()
  await prisma.userExam.deleteMany()
  await prisma.exam.deleteMany()
  await prisma.subtotal.deleteMany()
  await prisma.subtotalGroup.deleteMany()
  await prisma.examTag.deleteMany()
  await prisma.tagSubtotalGroup.deleteMany()
  await prisma.tag.deleteMany()
  await prisma.studentClassroomMembership.deleteMany()
  await prisma.student.deleteMany()
  await prisma.classroom.deleteMany()
  await prisma.userKeyboardShortcut.deleteMany()
  await prisma.userPreference.deleteMany()
  await prisma.user.deleteMany()
  // 監査ログ（FKなし・追記専用）。テスト間の混入を防ぐため最後に削除
  await prisma.auditLog.deleteMany()
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
