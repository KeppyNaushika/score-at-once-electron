/**
 * ローカルモードで起動したときは、同期を始めない
 */
import * as os from "os"
import * as path from "path"
import { describe, expect, it, vi } from "vitest"

vi.mock("electron", () => ({
  app: { getPath: () => os.tmpdir() },
  BrowserWindow: { getAllWindows: () => [] },
}))

vi.mock("../../electron-src/lib/prisma/databaseInitializer", () => ({
  createSharedPrismaClient: () => ({}),
}))

const setupSync = vi.fn()
vi.mock("sqlite-nas-sync", () => ({ setupSync }))

import {
  getSyncStatus,
  initializeSync,
  triggerSyncNow,
} from "../../electron-src/lib/sync/syncService"
import { fixLocalStorageRootsForTest } from "../helpers/localStorageRoots"

fixLocalStorageRootsForTest(
  path.join(os.tmpdir(), "score-at-once-sync-local-mode")
)

describe("ローカルモードで起動したとき", () => {
  it("同期を始めず、手動の同期も断る", async () => {
    await initializeSync()
    expect(setupSync).not.toHaveBeenCalled()
    expect(getSyncStatus().state).toBe("disabled")
    await expect(triggerSyncNow()).rejects.toThrow(/共有モード/)
  })
})
