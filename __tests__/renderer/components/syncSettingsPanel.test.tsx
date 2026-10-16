// @vitest-environment jsdom
/**
 * 同期の設定画面が、**使う前に読む注意**と**直近の同期で出た注意**を、
 * どちらも消えない形で見せること。
 *
 * 同期は beta で、削除がすべてのPCに伝わって取り消せない。起きてから知らせるだけでは
 * 遅いので、起きる前に読める場所が画面に常にある。
 *
 * ここで固定するのは次の4つ:
 *
 * - **beta の印がある。** 仕様が変わりうることを、入口で名乗る
 * - **注意事項が畳まれていない。** 畳んでよいのは後ろの数件だけ
 * - **直近の同期で出た注意が、一覧で残る。** トーストだけだと流れて消える
 * - **モードとプロファイルの切り替えは、再起動で効く。** 設定を変えただけでは
 *   動いている根は変わらないので、再起動待ちであることを出す。空の共有フォルダを
 *   選んだら、ローカルのデータを移すか空で始めるかを選ばせ、選ぶまで何もしない
 * - **共有モードへ入る前に、1項目ずつ同意を求める。** 同意するまで共有フォルダを
 *   選ばせない。ただし同意の無いまま共有モードで動いているPCの同期は止めない
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { SyncSettingsPanel } from "@/app/(app)/sync/components/SyncSettingsPanel"
import type { SharedFolderInspection } from "@/electron-src/lib/sync/sharedFolder"
import {
  DEFAULT_SYNC_CONFIG,
  type SyncAppStatus,
} from "@/electron-src/lib/sync/types"
import {
  SYNC_CONSENT_ITEMS,
  SYNC_CONSENT_VERSION,
} from "@/lib/shared/syncConsentText"

const {
  connectSharedFolder,
  triggerSync,
  chooseSharedFolder,
  recordConsent,
  syncSettings,
} = vi.hoisted(() => ({
  connectSharedFolder: vi.fn(async () => undefined),
  triggerSync: vi.fn(async () => undefined),
  chooseSharedFolder: vi.fn(async () => "/nas/new-share"),
  recordConsent: vi.fn(async () => undefined),
  syncSettings: { current: null as unknown },
}))

vi.mock("@/app/(app)/sync/hooks/useSyncSettings", () => ({
  useSyncSettings: () => syncSettings.current,
}))

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

const IDLE_STATUS: SyncAppStatus = {
  state: "idle",
  lastSyncTime: null,
  lastError: null,
  syncCount: 3,
  versionMismatches: [],
  lastWarnings: [],
}

const SHARED_ID = "5d6e7f8a-9b0c-4d1e-8f2a-3b4c5d6e7f8a"

function renderTab(
  lastWarnings: string[] = [],
  options: {
    restartPending?: boolean
    inspection?: SharedFolderInspection
    /** このPCが今の版の同意文に同意しているか（既定は同意済み） */
    consented?: boolean
    runningMode?: "local" | "shared"
  } = {}
): void {
  const consented = options.consented ?? true
  const runningMode = options.runningMode ?? "local"
  syncSettings.current = {
    config: {
      ...DEFAULT_SYNC_CONFIG,
      mode: options.restartPending ? "shared" : "local",
      activeSharedFolderId: options.restartPending ? SHARED_ID : null,
      sharedProfiles: [
        { sharedFolderId: SHARED_ID, sharedFolderPath: "/nas/share" },
      ],
      clientId: "this-pc",
      syncConsent: consented
        ? {
            clientId: "this-pc",
            consentVersion: SYNC_CONSENT_VERSION,
            consentedAt: "2026-10-16T00:00:00.000Z",
          }
        : null,
    },
    running: {
      mode: runningMode,
      sharedFolder:
        runningMode === "shared"
          ? { sharedFolderId: SHARED_ID, sharedFolderPath: "/nas/share" }
          : null,
      databasePath: "/app/data/database.db",
      sharedFilesDirectory: "/app/data",
      localDataDirectory: "/app/data",
    },
    restartPending: options.restartPending ?? false,
    status: { ...IDLE_STATUS, lastWarnings },
    isLoading: false,
    updateTiming: vi.fn(async () => undefined),
    triggerSync,
    connectSharedFolder,
    isConnecting: false,
    selectStartupStorage: vi.fn(async () => undefined),
    migrateProfileToLocal: vi.fn(async () => undefined),
    isMigratingToLocal: false,
    chooseSharedFolder,
    inspectSharedFolder: vi.fn(
      async () => options.inspection ?? { kind: "empty" }
    ),
    relaunch: vi.fn(async () => undefined),
  }
  // 同意の画面は同意の記録を自分で書く（useMutation）ので、取得の器が要る
  Object.defineProperty(window, "electronAPI", {
    configurable: true,
    value: { sync: { recordConsent } },
  })
  render(
    <QueryClientProvider client={new QueryClient()}>
      <SyncSettingsPanel />
    </QueryClientProvider>
  )
}

describe("SyncSettingsPanel", () => {
  beforeEach(() => {
    connectSharedFolder.mockClear()
    triggerSync.mockClear()
    chooseSharedFolder.mockClear()
    recordConsent.mockClear()
  })

  it("入口に beta の印を出す", () => {
    renderTab()
    expect(screen.getAllByText("beta").length).toBeGreaterThan(0)
  })

  it("使う前に読む注意を、畳まずに出す", () => {
    renderTab()

    // 削除が取り消せないことと、控えがバックアップでないことは、開かなくても読める
    expect(
      screen.getByText(/あるPCで消したものは、他のPCからも消えます/)
    ).toBeTruthy()
    // 同期フォルダの説明にも同じ断りがあるので、複数当たってよい
    expect(
      screen.getAllByText(/ご自身でもバックアップを取ってください/).length
    ).toBeGreaterThan(0)
    expect(screen.getByText(/まだ beta であり/)).toBeTruthy()
    expect(screen.getByText(/一切の保証はありません/)).toBeTruthy()
  })

  it("残りのご注意も、開かずに読める（畳まない）", () => {
    renderTab()

    expect(
      screen.getByText(/一括採点そのものは、PCごとに入れてください/)
    ).toBeTruthy()
    expect(
      screen.getByText(/すべて同じバージョンの一括採点にしてください/)
    ).toBeTruthy()
    expect(screen.getByText(/タグは1つにまとまって表示されます/)).toBeTruthy()
    // 畳む仕掛けそのものを置かない
    expect(screen.queryByText(/残りのご注意を見る/)).toBeNull()
  })

  it("直近の同期で出た注意を、一覧で残す（トーストだけにしない）", () => {
    renderTab([
      "Unplaceable ExamStudent:a: 理由",
      "Skipping client pc-b: schema version mismatch (local=x, remote=y)",
    ])

    expect(screen.getByText("直近の同期で出た注意")).toBeTruthy()
    expect(screen.getByText(/受験生徒/)).toBeTruthy()
    expect(screen.getByText(/バージョンの違う/)).toBeTruthy()
  })

  it("言い換えられない注意は、原文のまま一覧に残す", () => {
    renderTab(["Some future warning the app has never seen"])

    expect(
      screen.getByText(/Some future warning the app has never seen/)
    ).toBeTruthy()
  })

  it("注意が無ければ一覧そのものを出さない", () => {
    renderTab()
    expect(screen.queryByText("直近の同期で出た注意")).toBeNull()
  })

  it("再起動待ちなら、そのことと再起動の手段を出す", () => {
    renderTab([], { restartPending: true })
    expect(screen.getByText(/再起動すると切り替わります/)).toBeTruthy()
    expect(screen.getByRole("button", { name: /今すぐ再起動/ })).toBeTruthy()
  })

  it("ローカルモードで動いている間は、共有プロファイルをローカルへ移せない", () => {
    renderTab()
    const button = screen.getByRole("button", { name: /ローカルへ移行/ })
    expect(button.hasAttribute("disabled")).toBe(true)
  })

  it("空の共有フォルダを選ぶと、移すか空で始めるかを尋ね、選ぶまで何もしない", async () => {
    renderTab()

    fireEvent.click(screen.getByRole("button", { name: /共有フォルダを追加/ }))

    const dialog = await screen.findByRole("alertdialog")
    expect(dialog.textContent).toContain("共有しているデータがありません")
    expect(
      screen.getByRole("button", { name: "ローカルのデータを移して始める" })
    ).toBeTruthy()
    expect(
      screen.getByRole("button", { name: "空のプロファイルで始める" })
    ).toBeTruthy()
    expect(connectSharedFolder).not.toHaveBeenCalled()

    fireEvent.click(
      screen.getByRole("button", { name: "空のプロファイルで始める" })
    )
    await waitFor(() =>
      expect(connectSharedFolder).toHaveBeenCalledWith({
        sharedFolderPath: "/nas/new-share",
        action: "create-empty",
      })
    )
  })

  it("既に共有されているフォルダは、ローカルのデータと統合しないことを言って合流する", async () => {
    renderTab([], {
      inspection: {
        kind: "shared",
        sharedFolderId: "6e7f8a9b-0c1d-4e2f-8a3b-4c5d6e7f8a9b",
      },
    })

    fireEvent.click(screen.getByRole("button", { name: /共有フォルダを追加/ }))

    const dialog = await screen.findByRole("alertdialog")
    expect(dialog.textContent).toContain("混ぜません")
    fireEvent.click(screen.getByRole("button", { name: "合流する" }))
    await waitFor(() =>
      expect(connectSharedFolder).toHaveBeenCalledWith({
        sharedFolderPath: "/nas/new-share",
        action: "join",
      })
    )
  })

  it("同意していなければ、共有フォルダを選ぶ前に同意を求め、全項目を確かめるまで同意できない", async () => {
    renderTab([], { consented: false })

    fireEvent.click(screen.getByRole("button", { name: /共有フォルダを追加/ }))

    const dialog = await screen.findByRole("dialog")
    expect(dialog.textContent).toContain("共有モードの注意事項への同意")
    expect(chooseSharedFolder).not.toHaveBeenCalled()
    const consentButton = screen.getByRole("button", { name: "同意する" })
    expect(consentButton.hasAttribute("disabled")).toBe(true)

    const checkboxes = screen.getAllByRole("checkbox")
    expect(checkboxes).toHaveLength(SYNC_CONSENT_ITEMS.length)
    checkboxes.forEach((checkbox) => fireEvent.click(checkbox))
    expect(consentButton.hasAttribute("disabled")).toBe(false)

    fireEvent.click(consentButton)
    await waitFor(() => expect(recordConsent).toHaveBeenCalled())
    // 同意したら、そのまま共有フォルダを選ぶところへ進む
    await waitFor(() => expect(chooseSharedFolder).toHaveBeenCalled())
  })

  it("同意の画面を閉じたら、共有フォルダを選ばない", async () => {
    renderTab([], { consented: false })

    fireEvent.click(screen.getByRole("button", { name: /共有フォルダを追加/ }))
    await screen.findByRole("dialog")
    fireEvent.click(screen.getByRole("button", { name: "キャンセル" }))

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())
    expect(chooseSharedFolder).not.toHaveBeenCalled()
    expect(recordConsent).not.toHaveBeenCalled()
  })

  it("同意済みなら、同意を求めずに共有フォルダを選ぶ", async () => {
    renderTab()

    fireEvent.click(screen.getByRole("button", { name: /共有フォルダを追加/ }))

    await waitFor(() => expect(chooseSharedFolder).toHaveBeenCalled())
    expect(screen.queryByText("共有モードの注意事項への同意")).toBeNull()
  })

  it("同意の無いまま共有モードで動いていれば、同期は続いていると言って同意を促す", () => {
    renderTab([], { consented: false, runningMode: "shared" })

    expect(screen.getByText(/今の注意事項にまだ同意していません/)).toBeTruthy()
    expect(screen.getByRole("button", { name: "確認して同意する" })).toBeTruthy()
    // 同期は止めない
    expect(
      screen
        .getByRole("button", { name: /今すぐ同期/ })
        .hasAttribute("disabled")
    ).toBe(false)
  })
})
