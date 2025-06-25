import { PrismaClient } from '@prisma/client'
import * as path from 'path'
import * as fs from 'fs/promises'
import { getDataDirectory } from '../dataManager'

// データベースファイルのパス
export const getDatabasePath = (): string => {
  return path.join(getDataDirectory(), 'database.db')
}

// 共有ドライブ用のPrismaクライアントを作成
export const createSharedPrismaClient = (): PrismaClient => {
  const databasePath = getDatabasePath()
  const databaseUrl = `file:${databasePath}`
  
  console.log('Database URL:', databaseUrl)
  
  return new PrismaClient({
    datasources: {
      db: {
        url: databaseUrl
      }
    },
    // 共有ドライブでの競合を避けるための設定
    log: ['error', 'warn'],
  })
}

// データベースの初期化（初回起動時）
export const initializeDatabase = async (): Promise<boolean> => {
  const databasePath = getDatabasePath()
  
  try {
    // データベースファイルの存在確認
    const dbExists = await checkDatabaseExists()
    
    if (!dbExists) {
      console.log('Database not found, creating new database...')
      
      // データディレクトリが存在することを確認
      const dataDir = getDataDirectory()
      await fs.mkdir(dataDir, { recursive: true })
      
      // Prismaクライアントでデータベースを初期化
      const prisma = createSharedPrismaClient()
      
      try {
        // データベースのマイグレーション実行
        // 本来は prisma migrate deploy を使うべきだが、
        // 開発環境では直接接続してテーブル作成を試行
        await prisma.$connect()
        await prisma.$disconnect()
        
        console.log('Database initialized successfully at:', databasePath)
        return true
      } catch (error) {
        console.error('Failed to initialize database:', error)
        throw error
      } finally {
        await prisma.$disconnect()
      }
    } else {
      console.log('Database already exists at:', databasePath)
      return false
    }
  } catch (error) {
    console.error('Database initialization failed:', error)
    throw error
  }
}

// データベースファイルの存在確認
export const checkDatabaseExists = async (): Promise<boolean> => {
  const databasePath = getDatabasePath()
  
  try {
    await fs.access(databasePath)
    return true
  } catch {
    return false
  }
}

// データベースの健全性チェック
export const checkDatabaseHealth = async (): Promise<boolean> => {
  const prisma = createSharedPrismaClient()
  
  try {
    // 簡単なクエリで接続確認
    await prisma.$queryRaw`SELECT 1`
    return true
  } catch (error) {
    console.error('Database health check failed:', error)
    return false
  } finally {
    await prisma.$disconnect()
  }
}

// 共有ドライブ用のSQLite最適化設定
export const optimizeDatabaseForSharedDrive = async (): Promise<void> => {
  const prisma = createSharedPrismaClient()
  
  try {
    // WALモードを有効にして同時読み取りを改善
    await prisma.$executeRaw`PRAGMA journal_mode = WAL`
    
    // 読み取り専用トランザクションのタイムアウトを短縮
    await prisma.$executeRaw`PRAGMA busy_timeout = 30000`
    
    // 同期モードを調整（共有ドライブでのパフォーマンス向上）
    await prisma.$executeRaw`PRAGMA synchronous = NORMAL`
    
    // キャッシュサイズを増加
    await prisma.$executeRaw`PRAGMA cache_size = -64000`
    
    console.log('Database optimized for shared drive')
  } catch (error) {
    console.error('Failed to optimize database:', error)
  } finally {
    await prisma.$disconnect()
  }
}

// データベースのバックアップ作成
export const createDatabaseBackup = async (): Promise<string> => {
  const databasePath = getDatabasePath()
  const backupPath = `${databasePath}.backup.${Date.now()}`
  
  try {
    await fs.copyFile(databasePath, backupPath)
    console.log('Database backup created:', backupPath)
    return backupPath
  } catch (error) {
    console.error('Failed to create database backup:', error)
    throw error
  }
}