/**
 * 統合アーカイブ（.sao）の取り込みの作業（セッション）
 *
 * 取り込みのウィザードは「開く → 試し取り込み（何度でも） → 取り込む」と段を踏む。開いて現行化した
 * アーカイブ（一時ディレクトリの中）を段ごとに作り直さないよう、main が id で持っておく。
 * 作業ディレクトリは閉じたとき・取り込んだとき・アプリを終えるときに消す。
 *
 * electron には依存しない。migration の場所と、表・列を比べる相手の DB は呼び出し側が渡す。
 */

import Database from "better-sqlite3"
import * as crypto from "crypto"
import * as fs from "fs"
import * as os from "os"
import * as path from "path"

import { convertArchiveAnswerOverlayLengths } from "../../prisma/answerOverlayLengthConversion"
import {
  openUnifiedArchive,
  UnifiedArchiveOpenError,
  type UnifiedArchiveOpenErrorKind,
} from "./archiveOpener"
import type { OpenedUnifiedArchive } from "./types"

export interface UnifiedArchiveImportSession {
  /** 開いた .sao のパス（監査ログの表示に使う） */
  readonly archivePath: string
  readonly workDirectory: string
  readonly opened: OpenedUnifiedArchive
}

export type UnifiedArchiveImportSessionOpenResult =
  | {
      readonly kind: "opened"
      readonly sessionId: string
      readonly session: UnifiedArchiveImportSession
    }
  | {
      readonly kind: "rejected"
      readonly reason: UnifiedArchiveOpenErrorKind
      readonly details: readonly string[]
    }

export interface OpenUnifiedArchiveImportSessionOptions {
  archivePath: string
  /** アプリ同梱の prisma/migrations */
  migrationsDir: string
  /** 表・列を比べる相手（取り込み先のライブ DB） */
  referenceDatabasePath: string
}

/**
 * 現行化の続き: 答案に重ねる要素の長さを画素から mm へ直す（SQL の migration の後）。
 * 答案画像の大きさを読む非同期の処理なので、同期の `openUnifiedArchive` の外で行う。
 * 同梱の答案画像を読めない試験は画素のまま残り、取り込んだ後に起動時の変換が拾う
 */
const finishOpenedArchiveMigration = async (
  opened: OpenedUnifiedArchive
): Promise<void> => {
  const db = new Database(opened.databasePath, { fileMustExist: true })
  try {
    await convertArchiveAnswerOverlayLengths(db, opened.filesDirectory)
  } finally {
    db.close()
  }
}

const sessions = new Map<string, UnifiedArchiveImportSession>()

const removeDirectory = (directory: string): void => {
  try {
    fs.rmSync(directory, { recursive: true, force: true })
  } catch (error) {
    console.warn("統合アーカイブの作業ディレクトリを消せませんでした:", error)
  }
}

/**
 * アーカイブを一時ディレクトリへ開いて、作業を始める。守りに掛かったものは失敗ではなく
 * `rejected` で返す（ウィザードが理由を出す）。それ以外の失敗は作業ディレクトリを消して投げる
 */
export async function openUnifiedArchiveImportSession(
  options: OpenUnifiedArchiveImportSessionOptions
): Promise<UnifiedArchiveImportSessionOpenResult> {
  const workDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "sao-import-"))
  try {
    const opened = openUnifiedArchive({
      archivePath: options.archivePath,
      // 展開先は空であること（mkdtemp の直下に作る）
      workDirectory: path.join(workDirectory, "archive"),
      migrationsDir: options.migrationsDir,
      referenceDatabasePath: options.referenceDatabasePath,
    })
    await finishOpenedArchiveMigration(opened)
    const sessionId = crypto.randomUUID()
    const session: UnifiedArchiveImportSession = {
      archivePath: options.archivePath,
      workDirectory,
      opened,
    }
    sessions.set(sessionId, session)
    return { kind: "opened", sessionId, session }
  } catch (error) {
    removeDirectory(workDirectory)
    if (error instanceof UnifiedArchiveOpenError) {
      return { kind: "rejected", reason: error.kind, details: error.details }
    }
    throw error
  }
}

/** 開いている作業を取り出す。無ければ投げる（閉じた後・アプリを再起動した後） */
export function getUnifiedArchiveImportSession(
  sessionId: string
): UnifiedArchiveImportSession {
  const session = sessions.get(sessionId)
  if (!session) {
    throw new Error(
      "取り込みの作業が見つかりません。アーカイブを開き直してください"
    )
  }
  return session
}

/** 作業を閉じ、作業ディレクトリを消す。既に閉じていれば何もしない */
export function closeUnifiedArchiveImportSession(sessionId: string): void {
  const session = sessions.get(sessionId)
  if (!session) return
  sessions.delete(sessionId)
  removeDirectory(session.workDirectory)
}

/** 残っている作業を全て閉じる（アプリを終えるとき） */
export function closeAllUnifiedArchiveImportSessions(): void {
  for (const sessionId of [...sessions.keys()]) {
    closeUnifiedArchiveImportSession(sessionId)
  }
}
