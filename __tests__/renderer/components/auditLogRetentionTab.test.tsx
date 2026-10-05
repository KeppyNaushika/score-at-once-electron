// @vitest-environment jsdom
/**
 * 設定の「操作履歴」タブ（操作履歴を残す期間）。
 *
 * ここで固定すること:
 * - 設定が無いあいだは既定の1年を見せる
 * - 長くするときはそのまま保存する
 * - 短くするときは、古い履歴が消えて戻らないことを確かめてから保存する（やめれば保存しない）
 *
 * window.electronAPI は偽物。
 */

import "../setup"

import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest"

import { AuditLogRetentionTab } from "@/app/(app)/settings/components/AuditLogRetentionTab"

import { createQueryWrapper } from "../../helpers/queryWrapper"

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

/** main の代わりに日数を持つ偽の口 */
function installFakeSettingsApi(initialStoredText: string | null) {
  let storedText = initialStoredText
  const settings = {
    getAppPreference: vi.fn(async () => storedText),
    setAuditLogRetentionDays: vi.fn(async (days: number) => {
      storedText = JSON.stringify(days)
    }),
  }
  Object.defineProperty(window, "electronAPI", {
    value: { settings },
    writable: true,
    configurable: true,
  })
  return settings
}

async function chooseRetention(
  user: ReturnType<typeof userEvent.setup>,
  optionName: string
) {
  const trigger = await screen.findByRole("combobox", {
    name: "操作履歴を残す期間",
  })
  trigger.focus()
  await user.keyboard("{Enter}")
  const listbox = await screen.findByRole("listbox")
  await user.click(within(listbox).getByRole("option", { name: optionName }))
}

describe("AuditLogRetentionTab", () => {
  beforeAll(() => {
    // Radix の Select が jsdom で開くのに要る（jsdom は持たない）
    Element.prototype.hasPointerCapture = () => false
    Element.prototype.releasePointerCapture = () => {}
    Element.prototype.scrollIntoView = () => {}
  })

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("設定が無いあいだは既定の1年を見せる", async () => {
    installFakeSettingsApi(null)
    render(<AuditLogRetentionTab />, { wrapper: createQueryWrapper() })
    expect(
      await screen.findByRole("combobox", { name: "操作履歴を残す期間" })
    ).toHaveTextContent("1年")
  })

  it("長くするときは確かめずに保存する", async () => {
    const user = userEvent.setup()
    const settings = installFakeSettingsApi(null)
    render(<AuditLogRetentionTab />, { wrapper: createQueryWrapper() })

    await chooseRetention(user, "2年")

    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument()
    expect(settings.setAuditLogRetentionDays).toHaveBeenCalledWith(730)
  })

  it("短くするときは、消えて戻らないことを確かめてから保存する", async () => {
    const user = userEvent.setup()
    const settings = installFakeSettingsApi(null)
    render(<AuditLogRetentionTab />, { wrapper: createQueryWrapper() })

    await chooseRetention(user, "90日")

    const dialog = await screen.findByRole("alertdialog")
    expect(dialog).toHaveTextContent("元に戻せません")
    expect(settings.setAuditLogRetentionDays).not.toHaveBeenCalled()

    await user.click(within(dialog).getByRole("button", { name: "短くする" }))
    expect(settings.setAuditLogRetentionDays).toHaveBeenCalledWith(90)
  })

  it("短くするのをやめれば保存しない", async () => {
    const user = userEvent.setup()
    const settings = installFakeSettingsApi(null)
    render(<AuditLogRetentionTab />, { wrapper: createQueryWrapper() })

    await chooseRetention(user, "180日")
    const dialog = await screen.findByRole("alertdialog")
    await user.click(within(dialog).getByRole("button", { name: "やめる" }))

    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument()
    expect(settings.setAuditLogRetentionDays).not.toHaveBeenCalled()
  })
})
