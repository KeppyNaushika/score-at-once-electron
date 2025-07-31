import { PrismaClient } from "@prisma/client"
import * as fs from "fs"
import * as path from "path"
import { getDatabasePath } from "./prisma/databaseInitializer"

/**
 * データベースセットアップユーティリティ
 */
export class DatabaseSetup {
  private prisma: PrismaClient
  private dbPath: string

  constructor() {
    this.prisma = new PrismaClient()
    this.dbPath = getDatabasePath()
  }

  /**
   * データベースファイルが存在するかチェック
   */
  isDatabaseExists(): boolean {
    const absolutePath = path.resolve(this.dbPath)
    const exists = fs.existsSync(absolutePath)
    console.log(`🔍 Database check: ${absolutePath} - ${exists ? 'EXISTS' : 'NOT FOUND'}`)
    return exists
  }

  /**
   * データベースが空かどうかチェック
   */
  async isDatabaseEmpty(): Promise<boolean> {
    try {
      const userCount = await this.prisma.user.count()
      const classCount = await this.prisma.class.count()
      const isEmpty = userCount === 0 && classCount === 0
      console.log(`📊 Database content check: Users=${userCount}, Classes=${classCount} - ${isEmpty ? 'EMPTY' : 'HAS DATA'}`)
      return isEmpty
    } catch (error) {
      console.log('❌ Database content check failed:', error)
      return true // エラーの場合は空とみなす
    }
  }

  /**
   * データベースディレクトリを作成
   */
  ensureDatabaseDirectory(): void {
    const dbDir = path.dirname(path.resolve(this.dbPath))
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true })
      console.log(`📁 Created database directory: ${dbDir}`)
    }
  }

  /**
   * シードデータを実行
   */
  async runSeed(): Promise<void> {
    try {
      console.log('🌱 Starting integrated seed...')

      // デフォルトユーザーの作成
      const defaultUser = await this.prisma.user.upsert({
        where: { username: 'admin' },
        update: {},
        create: {
          username: 'admin',
          name: '管理者',
          role: 'admin',
          passcodeType: 'none'
        }
      })
      console.log('✅ Default user created:', defaultUser.name)

      // サンプル学級の作成
      const sampleClass = await this.prisma.class.upsert({
        where: { name: 'サンプル学級' },
        update: {},
        create: {
          name: 'サンプル学級',
          classCode: 'SAMPLE01',
          grade: 1,
          description: 'システム動作確認用のサンプル学級です',
          isVisible: true
        }
      })
      console.log('✅ Sample class created:', sampleClass.name)

      // サンプル生徒の作成
      const sampleStudents = [
        {
          studentId: 'STU001',
          lastName: '山田',
          firstName: '太郎',
          lastNameKana: 'ヤマダ',
          firstNameKana: 'タロウ',
          enrollmentYear: new Date().getFullYear()
        },
        {
          studentId: 'STU002',
          lastName: '佐藤',
          firstName: '花子',
          lastNameKana: 'サトウ',
          firstNameKana: 'ハナコ',
          enrollmentYear: new Date().getFullYear()
        },
        {
          studentId: 'STU003',
          lastName: '田中',
          firstName: '次郎',
          lastNameKana: 'タナカ',
          firstNameKana: 'ジロウ',
          enrollmentYear: new Date().getFullYear()
        }
      ]

      for (const [index, studentData] of sampleStudents.entries()) {
        const student = await this.prisma.student.upsert({
          where: { studentId: studentData.studentId },
          update: {},
          create: studentData
        })

        // 学級への所属を作成
        await this.prisma.studentClassMembership.upsert({
          where: {
            studentId_classId_startDate: {
              studentId: student.id,
              classId: sampleClass.id,
              startDate: new Date()
            }
          },
          update: {},
          create: {
            studentId: student.id,
            classId: sampleClass.id,
            attendanceNumber: index + 1,
            startDate: new Date()
          }
        })
        
        console.log(`✅ Sample student created: ${student.lastName} ${student.firstName}`)
      }

      // サンプル小計グループの作成
      let mathSubtotalGroup = await this.prisma.subtotalGroup.findFirst({
        where: { name: '数学小計グループ' }
      })
      
      if (!mathSubtotalGroup) {
        mathSubtotalGroup = await this.prisma.subtotalGroup.create({
          data: {
            name: '数学小計グループ'
          }
        })
      }
      console.log('✅ Math subtotal group created:', mathSubtotalGroup.name)

      // サンプル小計項目の作成
      const mathSubtotals = [
        { name: '計算問題', order: 1 },
        { name: '文章題', order: 2 },
        { name: '図形問題', order: 3 }
      ]

      for (const subtotalData of mathSubtotals) {
        await this.prisma.subtotal.upsert({
          where: {
            subtotalGroupId_name: {
              subtotalGroupId: mathSubtotalGroup.id,
              name: subtotalData.name
            }
          },
          update: {},
          create: {
            ...subtotalData,
            subtotalGroupId: mathSubtotalGroup.id
          }
        })
        console.log(`✅ Math subtotal created: ${subtotalData.name}`)
      }

      console.log('🎉 Integrated seed completed successfully!')

    } catch (error) {
      console.error('❌ Error during seed:', error)
      throw error
    }
  }

  /**
   * データベースの初期セットアップを実行
   */
  async setupIfNeeded(): Promise<boolean> {
    try {
      const dbExists = this.isDatabaseExists()
      let needsSetup = false

      if (!dbExists) {
        console.log('🏗️ Database file not found, using existing initialization system...')
        return false // 既存のdatabaseInitializerに任せる
      } else {
        const isEmpty = await this.isDatabaseEmpty()
        if (isEmpty) {
          console.log('📭 Database is empty, running seed...')
          await this.runSeed()
          return true
        }
      }

      console.log('✅ Database setup check completed')
      return false
    } catch (error) {
      console.error('❌ Database setup failed:', error)
      throw error
    } finally {
      await this.prisma.$disconnect()
    }
  }

  /**
   * データベース接続テスト
   */
  async testConnection(): Promise<boolean> {
    try {
      await this.prisma.$connect()
      console.log('✅ Database connection test successful')
      return true
    } catch (error) {
      console.error('❌ Database connection test failed:', error)
      return false
    } finally {
      await this.prisma.$disconnect()
    }
  }
}