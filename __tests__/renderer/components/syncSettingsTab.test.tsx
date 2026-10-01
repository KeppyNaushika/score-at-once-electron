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
 * - **同期を切るときの確認が、実際の処理と食い違わない。** 切るときに走るのは
 *   このPCの控えを共有フォルダへ写す処理だけで、他のPCの変更を取りに行く処理は無い
 */

import { fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { SyncSettingsTab } from "@/app/(app)/settings/components/SyncSettingsTab"
import type { SyncAppStatus } from "@/electron-src/lib/sync/types"

const { updateConfig, triggerSync, syncSettings } = vi.hoisted(() => ({
  updateConfig: vi.fn(async () => undefined),
  triggerSync: vi.fn(async () => undefined),
  syncSettings: { current: null as unknown },
}))

vi.mock("@/app/(app)/settings/hooks/useSyncSettings", () => ({
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

function renderTab(lastWarnings: string[] = []): void {
  syncSettings.current = {
    config: {
      enabled: true,
      clientId: "this-pc",
      intervalMs: 30000,
      changelogRetentionDays: 7,
    },
    syncPath: "/nas/data/sync",
    status: { ...IDLE_STATUS, lastWarnings },
    isLoading: false,
    updateConfig,
    triggerSync,
  }
  render(<SyncSettingsTab />)
}

describe("SyncSettingsTab", () => {
  beforeEach(() => {
    updateConfig.mockClear()
    triggerSync.mockClear()
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
    expect(screen.getByText(/まだ beta です/)).toBeTruthy()
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
    expect(screen.getByText(/試験の受験生徒/)).toBeTruthy()
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

  it("同期を切る確認は、最後の同期と、届くのが相手の次の同期であることを言う", () => {
    renderTab()

    fireEvent.click(screen.getByRole("switch"))

    const message = screen.getByRole("alertdialog").textContent ?? ""
    // 切る前に最後の同期が走る（取り込みもする）
    expect(message).toContain("最後にもう一度同期してから")
    // ただし、こちらの変更が相手に現れるのは相手の次の同期のとき
    expect(message).toContain("そのPCが次に同期したとき")
    // 取り込まれない、とは言えなくなった
    expect(message).not.toContain("取り込まれません")
    // 確認を出しただけの段では、まだ設定を書かない
    expect(updateConfig).not.toHaveBeenCalled()
  })
})
