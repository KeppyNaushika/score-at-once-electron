/**
 * 同期とモードの設定（`data/sync-config.json`）の読み書きと、clientId の持ち主の確認
 */
import * as fs from "fs"
import * as os from "os"
import * as path from "path"
import { afterEach, beforeEach, describe, expect, it } from "vitest"

import {
  ensureClientIdOwnedBy,
  getSyncConfigPath,
  loadSyncConfig,
  parseSyncAppConfig,
  saveSyncConfig,
  upsertSharedProfile,
} from "../../electron-src/lib/sync/syncConfig"
import { DEFAULT_SYNC_CONFIG } from "../../electron-src/lib/sync/types"

const DATA_DIR = path.join(os.tmpdir(), "score-at-once-sync-config-test")

const SHARED_ID_A = "8a1f2c3d-4b5e-4f60-8a71-b2c3d4e5f601"
const SHARED_ID_B = "9b2e3d4c-5a6f-4e70-9b81-c3d4e5f60712"

beforeEach(() => {
  fs.rmSync(DATA_DIR, { recursive: true, force: true })
  fs.mkdirSync(DATA_DIR, { recursive: true })
})
afterEach(() => {
  fs.rmSync(DATA_DIR, { recursive: true, force: true })
})

describe("設定の置き場", () => {
  it("data の直下の sync-config.json に置く（userData ではない）", () => {
    expect(getSyncConfigPath(DATA_DIR)).toBe(
      path.join(DATA_DIR, "sync-config.json")
    )
  })

  it("ファイルが無ければローカルモードの既定値", () => {
    expect(loadSyncConfig(DATA_DIR)).toEqual(DEFAULT_SYNC_CONFIG)
  })

  it("書いた設定をそのまま読める", () => {
    const config = {
      ...DEFAULT_SYNC_CONFIG,
      mode: "shared" as const,
      activeSharedFolderId: SHARED_ID_A,
      sharedProfiles: [
        { sharedFolderId: SHARED_ID_A, sharedFolderPath: "/mnt/share-a" },
      ],
      clientId: "6c1d2e3f-4a5b-4c6d-8e7f-90a1b2c3d4e5",
      clientIdOwner: { installationId: "inst", hostname: "pc-1" },
    }
    saveSyncConfig(config, DATA_DIR)
    expect(loadSyncConfig(DATA_DIR)).toEqual(config)
    // 書きかけの一時ファイルを残さない
    expect(fs.readdirSync(DATA_DIR)).toEqual(["sync-config.json"])
  })

  it("壊れた設定は既定値で読む", () => {
    fs.writeFileSync(getSyncConfigPath(DATA_DIR), "{ not json")
    expect(loadSyncConfig(DATA_DIR)).toEqual(DEFAULT_SYNC_CONFIG)
  })

  it("旧版の形（enabled だけ）は、ローカルモードとして読む", () => {
    expect(
      parseSyncAppConfig({
        enabled: true,
        clientId: "old",
        intervalMs: 60000,
        changelogRetentionDays: 7,
      })
    ).toEqual({ ...DEFAULT_SYNC_CONFIG, clientId: "old", intervalMs: 60000 })
  })

  it("共有モードなのに使うプロファイルが一覧に無ければ、ローカルモードに倒す", () => {
    const parsed = parseSyncAppConfig({
      mode: "shared",
      activeSharedFolderId: SHARED_ID_B,
      sharedProfiles: [
        { sharedFolderId: SHARED_ID_A, sharedFolderPath: "/mnt/share-a" },
      ],
    })
    expect(parsed.mode).toBe("local")
    expect(parsed.activeSharedFolderId).toBeNull()
    expect(parsed.sharedProfiles).toHaveLength(1)
  })
})

describe("clientId の持ち主", () => {
  const owner = { installationId: "inst-1", hostname: "pc-1" }

  it("まだ無ければ振る（振り直しとは数えない）", () => {
    const result = ensureClientIdOwnedBy(DEFAULT_SYNC_CONFIG, owner)
    expect(result.reissued).toBe(false)
    expect(result.config.clientId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
    )
    expect(result.config.clientIdOwner).toEqual(owner)
  })

  it("このPCが振ったものならそのまま", () => {
    const config = {
      ...DEFAULT_SYNC_CONFIG,
      clientId: "kept",
      clientIdOwner: owner,
    }
    expect(ensureClientIdOwnedBy(config, owner)).toEqual({
      config,
      reissued: false,
    })
  })

  it("data を別のPCへ写した（userData の id が違う）なら振り直す", () => {
    const config = {
      ...DEFAULT_SYNC_CONFIG,
      clientId: "copied",
      clientIdOwner: owner,
    }
    const result = ensureClientIdOwnedBy(config, {
      installationId: "inst-2",
      hostname: "pc-1",
    })
    expect(result.reissued).toBe(true)
    expect(result.config.clientId).not.toBe("copied")
  })

  it("userData ごと別のPCへ渡った（ホスト名が違う）なら振り直す", () => {
    const config = {
      ...DEFAULT_SYNC_CONFIG,
      clientId: "roamed",
      clientIdOwner: owner,
    }
    const result = ensureClientIdOwnedBy(config, {
      installationId: "inst-1",
      hostname: "pc-2",
    })
    expect(result.reissued).toBe(true)
    expect(result.config.clientIdOwner).toEqual({
      installationId: "inst-1",
      hostname: "pc-2",
    })
  })

  it("持ち主の記録が無い旧版の clientId は振り直す", () => {
    const config = { ...DEFAULT_SYNC_CONFIG, clientId: "legacy" }
    expect(ensureClientIdOwnedBy(config, owner).reissued).toBe(true)
  })
})

describe("共有プロファイルの一覧", () => {
  it("同じ識別 id はパスを書き換え、違う id は足す", () => {
    const first = upsertSharedProfile(DEFAULT_SYNC_CONFIG, {
      sharedFolderId: SHARED_ID_A,
      sharedFolderPath: "Z:\\share",
    })
    const renamed = upsertSharedProfile(first, {
      sharedFolderId: SHARED_ID_A,
      sharedFolderPath: "\\\\nas\\share",
    })
    const added = upsertSharedProfile(renamed, {
      sharedFolderId: SHARED_ID_B,
      sharedFolderPath: "/mnt/other",
    })
    expect(added.sharedProfiles).toEqual([
      { sharedFolderId: SHARED_ID_A, sharedFolderPath: "\\\\nas\\share" },
      { sharedFolderId: SHARED_ID_B, sharedFolderPath: "/mnt/other" },
    ])
  })
})
