/**
 * 同期とモードの設定の読み書き（`data/sync-config.json`）
 *
 * **userData ではなく data に置く。** アプリを更新するとき利用者は data を手で写すので、
 * 設定（モード・共有プロファイル・clientId）も一緒に移る。data を丸ごと別のPCへ
 * 写したときの clientId の重なりは、起動時に `ensureClientIdOwnedBy` で振り直す。
 *
 * 旧版（userData の `sync-config.json`）からの移り方は `legacyUserDataMigration.ts`。
 */

import * as crypto from "crypto"
import * as fs from "fs"
import * as path from "path"

import { getLocalDataDirectory } from "../dataManager"
import type {
  ClientIdOwner,
  SharedProfile,
  StorageMode,
  SyncAppConfig,
} from "./types"
import { DEFAULT_SYNC_CONFIG } from "./types"

/** 設定ファイルの名前（data の直下） */
const SYNC_CONFIG_FILE_NAME = "sync-config.json"

/** 設定ファイルのパス */
export function getSyncConfigPath(
  localDataDirectory: string = getLocalDataDirectory()
): string {
  return path.join(localDataDirectory, SYNC_CONFIG_FILE_NAME)
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)

const isStorageMode = (value: unknown): value is StorageMode =>
  value === "local" || value === "shared"

const readString = (record: Record<string, unknown>, key: string): string => {
  const value = record[key]
  return typeof value === "string" ? value : ""
}

const readPositiveNumber = (
  record: Record<string, unknown>,
  key: string,
  fallback: number
): number => {
  const value = record[key]
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? value
    : fallback
}

const parseSharedProfile = (value: unknown): SharedProfile | null => {
  if (!isRecord(value)) return null
  const sharedFolderId = readString(value, "sharedFolderId")
  const sharedFolderPath = readString(value, "sharedFolderPath")
  if (sharedFolderId === "" || sharedFolderPath === "") return null
  return { sharedFolderId, sharedFolderPath }
}

const parseClientIdOwner = (value: unknown): ClientIdOwner | null => {
  if (!isRecord(value)) return null
  const installationId = readString(value, "installationId")
  const hostname = readString(value, "hostname")
  if (installationId === "" || hostname === "") return null
  return { installationId, hostname }
}

/**
 * 設定ファイルの中身を型に起こす。欠けた項目・形の合わない項目は既定値にする。
 *
 * 共有モードなのに使うプロファイルが一覧に無いときは、ローカルモードに倒す。
 * 存在しない共有フォルダを根にして起動することはできないので。
 */
export function parseSyncAppConfig(raw: unknown): SyncAppConfig {
  if (!isRecord(raw)) return { ...DEFAULT_SYNC_CONFIG }
  const sharedProfiles = Array.isArray(raw.sharedProfiles)
    ? raw.sharedProfiles.flatMap((entry) => {
        const profile = parseSharedProfile(entry)
        return profile === null ? [] : [profile]
      })
    : []
  const activeSharedFolderId =
    typeof raw.activeSharedFolderId === "string" &&
    sharedProfiles.some(
      (profile) => profile.sharedFolderId === raw.activeSharedFolderId
    )
      ? raw.activeSharedFolderId
      : null
  const requestedMode = isStorageMode(raw.mode) ? raw.mode : "local"
  return {
    mode:
      requestedMode === "shared" && activeSharedFolderId === null
        ? "local"
        : requestedMode,
    activeSharedFolderId,
    sharedProfiles,
    clientId: readString(raw, "clientId"),
    clientIdOwner: parseClientIdOwner(raw.clientIdOwner),
    intervalMs: readPositiveNumber(
      raw,
      "intervalMs",
      DEFAULT_SYNC_CONFIG.intervalMs
    ),
    changelogRetentionDays: readPositiveNumber(
      raw,
      "changelogRetentionDays",
      DEFAULT_SYNC_CONFIG.changelogRetentionDays
    ),
  }
}

/**
 * 設定を読む。ファイルが無ければ既定値（ローカルモード）。
 *
 * 壊れていても既定値で続ける。モードの切り替えは書き戻しも統合もしない（再起動で
 * 根を選び直すだけ）ので、ローカルモードで起動しても失われるものは無い。
 */
export function loadSyncConfig(
  localDataDirectory: string = getLocalDataDirectory()
): SyncAppConfig {
  const configPath = getSyncConfigPath(localDataDirectory)
  if (!fs.existsSync(configPath)) return { ...DEFAULT_SYNC_CONFIG }
  try {
    const raw: unknown = JSON.parse(fs.readFileSync(configPath, "utf-8"))
    return parseSyncAppConfig(raw)
  } catch (error) {
    console.error(`Failed to load sync config: ${configPath}`, error)
    return { ...DEFAULT_SYNC_CONFIG }
  }
}

/**
 * 設定を書く。同じディレクトリの一時ファイルへ書いてから置き換えるので、
 * 書きかけの設定ファイルは残らない。
 */
export function saveSyncConfig(
  config: SyncAppConfig,
  localDataDirectory: string = getLocalDataDirectory()
): void {
  const configPath = getSyncConfigPath(localDataDirectory)
  fs.mkdirSync(path.dirname(configPath), { recursive: true })
  const partialPath = `${configPath}.${crypto.randomUUID()}.partial`
  fs.writeFileSync(partialPath, JSON.stringify(config, null, 2), "utf-8")
  fs.renameSync(partialPath, configPath)
}

/**
 * clientId がこのPCで振ったものかを確かめ、違えば振り直す。
 *
 * data を丸ごと別のPCへ写すと、clientId も一緒に写る。2台が同じ clientId を名乗ると、
 * 共有フォルダの同じ写し（`client-<clientId>.sqlite`）を上書きし合う。ライブラリにも
 * 取り合いの検出はあるが、写した直後の数回は検出されないことを実測している
 * （報告参照）ので、名乗る前にこちらで止める。
 *
 * 振り直しても失うものは無い。手元の控えの事実はそのまま新しい clientId の写しに
 * 載り、古い写しは更新されないクライアントとして残るだけ。
 *
 * @returns 振り直したなら新しい設定、そのままなら同じ設定（どちらも保存はしない）
 */
export function ensureClientIdOwnedBy(
  config: SyncAppConfig,
  owner: ClientIdOwner
): { config: SyncAppConfig; reissued: boolean } {
  const ownedByThisPc =
    config.clientId !== "" &&
    config.clientIdOwner !== null &&
    config.clientIdOwner.installationId === owner.installationId &&
    config.clientIdOwner.hostname === owner.hostname
  if (ownedByThisPc) return { config, reissued: false }
  return {
    config: { ...config, clientId: crypto.randomUUID(), clientIdOwner: owner },
    reissued: config.clientId !== "",
  }
}

/** 共有プロファイルを1つ足すか、同じ識別 id のものがあればパスを書き換える */
export function upsertSharedProfile(
  config: SyncAppConfig,
  profile: SharedProfile
): SyncAppConfig {
  const others = config.sharedProfiles.filter(
    (existing) => existing.sharedFolderId !== profile.sharedFolderId
  )
  return { ...config, sharedProfiles: [...others, profile] }
}
