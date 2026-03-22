/**
 * htmlToPngBuffer テスト
 *
 * BrowserWindowに正しいオプション（enableLargerThanScreen等）が
 * 渡されることを検証する。
 * ref: https://github.com/KeppyNaushika/score-at-once-electron/issues/664
 */

import { beforeEach, describe, expect, it, vi } from "vitest"

// --- Electron モック ---

const mockDestroy = vi.fn()
const mockLoadFile = vi.fn().mockResolvedValue(undefined)
const mockCapturePage = vi.fn().mockResolvedValue({
  toPNG: () => Buffer.from("fake-png"),
})
const mockBrowserWindowConstructor = vi.fn()

vi.mock("electron", () => ({
  app: { isPackaged: false },
  BrowserWindow: class MockBrowserWindow {
    webContents = { capturePage: mockCapturePage }
    constructor(opts: Record<string, unknown>) {
      mockBrowserWindowConstructor(opts)
    }
    loadFile = mockLoadFile
    destroy = mockDestroy
  },
}))

// fs モック（一時ファイル書き込み・削除をスキップ）
vi.mock("fs", async () => {
  const actual = await vi.importActual<typeof import("fs")>("fs")
  return {
    ...actual,
    default: {
      ...actual,
      writeFileSync: vi.fn(),
      unlinkSync: vi.fn(),
      existsSync: actual.existsSync,
      readFileSync: actual.readFileSync,
    },
    writeFileSync: vi.fn(),
    unlinkSync: vi.fn(),
  }
})

import { htmlToPngBuffer } from "../../../electron-src/lib/printUtils"

describe("htmlToPngBuffer", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("A4縦 300DPI で正しいピクセルサイズのBrowserWindowを作成する", async () => {
    const pageWidthMm = 210
    const pageHeightMm = 297
    const dpi = 300

    await htmlToPngBuffer(
      "<html><head></head><body></body></html>",
      pageWidthMm,
      pageHeightMm,
      dpi
    )

    const expectedWidth = Math.round((210 / 25.4) * 300) // 2480
    const expectedHeight = Math.round((297 / 25.4) * 300) // 3508

    expect(mockBrowserWindowConstructor).toHaveBeenCalledWith(
      expect.objectContaining({
        width: expectedWidth,
        height: expectedHeight,
      })
    )
  })

  it("enableLargerThanScreen: true が設定される（画面解像度を超えるPNG出力対応）", async () => {
    await htmlToPngBuffer(
      "<html><head></head><body></body></html>",
      210,
      297,
      300
    )

    expect(mockBrowserWindowConstructor).toHaveBeenCalledWith(
      expect.objectContaining({
        enableLargerThanScreen: true,
      })
    )
  })

  it("offscreen レンダリングが有効である", async () => {
    await htmlToPngBuffer(
      "<html><head></head><body></body></html>",
      210,
      297,
      300
    )

    expect(mockBrowserWindowConstructor).toHaveBeenCalledWith(
      expect.objectContaining({
        webPreferences: expect.objectContaining({ offscreen: true }),
      })
    )
  })

  it("capturePageに正しいサイズの矩形が渡される", async () => {
    const pageWidthMm = 210
    const pageHeightMm = 297
    const dpi = 300

    await htmlToPngBuffer(
      "<html><head></head><body></body></html>",
      pageWidthMm,
      pageHeightMm,
      dpi
    )

    const expectedWidth = Math.round((210 / 25.4) * 300)
    const expectedHeight = Math.round((297 / 25.4) * 300)

    expect(mockCapturePage).toHaveBeenCalledWith({
      x: 0,
      y: 0,
      width: expectedWidth,
      height: expectedHeight,
    })
  })

  it(".page を 100vw/100vh に拡張するCSSが注入される", async () => {
    const html =
      "<html><head></head><body><div class='page'></div></body></html>"

    await htmlToPngBuffer(html, 210, 297, 300)

    // writeFileSyncに渡されたHTMLを検証
    const fs = await import("fs")
    const writeCall = vi.mocked(fs.default.writeFileSync).mock.calls[0]
    const writtenHtml = writeCall[1] as string

    expect(writtenHtml).toContain("width: 100vw !important")
    expect(writtenHtml).toContain("height: 100vh !important")
  })

  it("処理後にBrowserWindowが破棄される", async () => {
    await htmlToPngBuffer(
      "<html><head></head><body></body></html>",
      210,
      297,
      300
    )

    expect(mockDestroy).toHaveBeenCalled()
  })

  it("カスタムDPIで正しいピクセルサイズが計算される", async () => {
    const dpi = 150

    await htmlToPngBuffer(
      "<html><head></head><body></body></html>",
      210,
      297,
      dpi
    )

    const expectedWidth = Math.round((210 / 25.4) * 150) // 1240
    const expectedHeight = Math.round((297 / 25.4) * 150) // 1754

    expect(mockBrowserWindowConstructor).toHaveBeenCalledWith(
      expect.objectContaining({
        width: expectedWidth,
        height: expectedHeight,
      })
    )
  })
})
