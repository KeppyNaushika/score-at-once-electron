/**
 * htmlToPngBuffer テスト
 *
 * BrowserWindowに正しいオプション（enableLargerThanScreen等）が渡されること、
 * およびウィンドウサイズが画面にクランプされた環境（Windows/Linux）での
 * 縮小キャプチャ→拡大フォールバックを検証する。
 * ref: https://github.com/KeppyNaushika/score-at-once-electron/issues/664
 * ref: https://github.com/KeppyNaushika/score-at-once-electron/issues/661
 */

import type * as NodeFs from "fs"
import sharp from "sharp"
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest"

// --- Electron モック ---

const mockDestroy = vi.fn()
const mockLoadFile = vi.fn().mockResolvedValue(undefined)
const mockCapturePage = vi.fn()
const mockInsertCSS = vi.fn().mockResolvedValue(undefined)
const mockSetContentSize = vi.fn()
const mockGetContentSize = vi.fn()
const mockBrowserWindowConstructor = vi.fn()

vi.mock("electron", () => ({
  app: { isPackaged: false },
  BrowserWindow: class MockBrowserWindow {
    webContents = { capturePage: mockCapturePage, insertCSS: mockInsertCSS }
    constructor(opts: Record<string, unknown>) {
      mockBrowserWindowConstructor(opts)
    }
    loadFile = mockLoadFile
    destroy = mockDestroy
    setContentSize = mockSetContentSize
    getContentSize = mockGetContentSize
  },
}))

// fs モック（一時ファイル書き込み・削除をスキップ）
vi.mock("fs", async () => {
  const actual = await vi.importActual<typeof NodeFs>("fs")
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

import {
  computeCapturePlan,
  htmlToPngBuffer,
} from "../../../electron-src/lib/printUtils"

const A4_WIDTH_PX = Math.round((210 / 25.4) * 300) // 2480
const A4_HEIGHT_PX = Math.round((297 / 25.4) * 300) // 3508

/** 指定サイズの白色PNGバッファを作成 */
function createPng(width: number, height: number): Promise<Buffer> {
  return sharp({
    create: { width, height, channels: 3, background: "#ffffff" },
  })
    .png()
    .toBuffer()
}

describe("computeCapturePlan", () => {
  it("コンテンツサイズが目標以上ならクランプなし・目標サイズでキャプチャする", () => {
    const plan = computeCapturePlan(2480, 3508, 2480, 3508)
    expect(plan).toEqual({
      clamped: false,
      captureWidth: 2480,
      captureHeight: 3508,
    })
  })

  it("画面にクランプされた場合はアスペクト比を維持した縮小矩形を返す", () => {
    // Issue #661 のユーザー環境: 1920x1128 にクランプ
    const plan = computeCapturePlan(2480, 3508, 1920, 1128)
    expect(plan.clamped).toBe(true)
    // fit = min(1920/2480, 1128/3508) = 1128/3508
    expect(plan.captureHeight).toBe(1128)
    expect(plan.captureWidth).toBe(Math.floor(2480 * (1128 / 3508)))
    // アスペクト比が目標と一致する（丸め誤差1px以内）
    const targetAspect = 2480 / 3508
    const planAspect = plan.captureWidth / plan.captureHeight
    expect(Math.abs(planAspect - targetAspect)).toBeLessThan(0.01)
  })

  it("横方向のみクランプされた場合もアスペクト比を維持する", () => {
    const plan = computeCapturePlan(2480, 3508, 1920, 4000)
    expect(plan.clamped).toBe(true)
    expect(plan.captureWidth).toBe(1920)
    expect(plan.captureHeight).toBe(Math.floor(3508 * (1920 / 2480)))
  })

  it("極端に小さいコンテンツでも1px以上を保証する", () => {
    const plan = computeCapturePlan(2480, 3508, 1, 1)
    expect(plan.captureWidth).toBeGreaterThanOrEqual(1)
    expect(plan.captureHeight).toBeGreaterThanOrEqual(1)
  })
})

describe("htmlToPngBuffer", () => {
  let fullSizePng: Buffer

  beforeAll(async () => {
    fullSizePng = await createPng(A4_WIDTH_PX, A4_HEIGHT_PX)
  })

  beforeEach(() => {
    vi.clearAllMocks()
    // デフォルト: クランプなし（要求どおりのサイズが確保できた）
    mockGetContentSize.mockReturnValue([A4_WIDTH_PX, A4_HEIGHT_PX])
    mockCapturePage.mockResolvedValue({ toPNG: () => fullSizePng })
  })

  it("A4縦 300DPI で正しいピクセルサイズのBrowserWindowを作成する", async () => {
    await htmlToPngBuffer(
      "<html><head></head><body></body></html>",
      210,
      297,
      300
    )

    expect(mockBrowserWindowConstructor).toHaveBeenCalledWith(
      expect.objectContaining({
        width: A4_WIDTH_PX,
        height: A4_HEIGHT_PX,
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

  it("作成後にsetContentSizeでサイズを再設定する（Windowsの作成時クランプ対策）", async () => {
    await htmlToPngBuffer(
      "<html><head></head><body></body></html>",
      210,
      297,
      300
    )

    expect(mockSetContentSize).toHaveBeenCalledWith(A4_WIDTH_PX, A4_HEIGHT_PX)
  })

  it("クランプされていない場合、capturePageに目標サイズの矩形が渡される", async () => {
    await htmlToPngBuffer(
      "<html><head></head><body></body></html>",
      210,
      297,
      300
    )

    expect(mockCapturePage).toHaveBeenCalledWith({
      x: 0,
      y: 0,
      width: A4_WIDTH_PX,
      height: A4_HEIGHT_PX,
    })
    expect(mockInsertCSS).not.toHaveBeenCalled()
  })

  it(".page を 100vw/100vh に拡張するCSSが注入される", async () => {
    const html =
      "<html><head></head><body><div class='page'></div></body></html>"

    await htmlToPngBuffer(html, 210, 297, 300)

    // writeFileSyncに渡されたHTMLを検証
    // printUtils は名前空間 import（`import * as fs from "fs"`）なので、
    // モックの default キーではなく名前空間直下の writeFileSync が呼ばれる
    const fs = await import("fs")
    const writeCall = vi.mocked(fs.writeFileSync).mock.calls[0]
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
    const expectedWidth = Math.round((210 / 25.4) * dpi) // 1240
    const expectedHeight = Math.round((297 / 25.4) * dpi) // 1754
    mockGetContentSize.mockReturnValue([expectedWidth, expectedHeight])
    mockCapturePage.mockResolvedValue({
      toPNG: () => fullSizePng,
    })

    await htmlToPngBuffer(
      "<html><head></head><body></body></html>",
      210,
      297,
      dpi
    )

    expect(mockBrowserWindowConstructor).toHaveBeenCalledWith(
      expect.objectContaining({
        width: expectedWidth,
        height: expectedHeight,
      })
    )
  })

  it("クランプ時はアスペクト比維持のCSSを注入し、縮小矩形でキャプチャする", async () => {
    // Issue #661: ウィンドウが 1920x1128 にクランプされるWindows環境を再現
    mockGetContentSize.mockReturnValue([1920, 1128])
    const expectedPlan = computeCapturePlan(
      A4_WIDTH_PX,
      A4_HEIGHT_PX,
      1920,
      1128
    )
    const clampedPng = await createPng(
      expectedPlan.captureWidth,
      expectedPlan.captureHeight
    )
    mockCapturePage.mockResolvedValue({ toPNG: () => clampedPng })

    await htmlToPngBuffer(
      "<html><head></head><body><div class='page'></div></body></html>",
      210,
      297,
      300
    )

    expect(mockInsertCSS).toHaveBeenCalledWith(
      expect.stringContaining(`width: ${expectedPlan.captureWidth}px`)
    )
    expect(mockCapturePage).toHaveBeenCalledWith({
      x: 0,
      y: 0,
      width: expectedPlan.captureWidth,
      height: expectedPlan.captureHeight,
    })
  })

  it("クランプ時の出力は目標ピクセルサイズに拡大される", async () => {
    mockGetContentSize.mockReturnValue([1920, 1128])
    const plan = computeCapturePlan(A4_WIDTH_PX, A4_HEIGHT_PX, 1920, 1128)
    const clampedPng = await createPng(plan.captureWidth, plan.captureHeight)
    mockCapturePage.mockResolvedValue({ toPNG: () => clampedPng })

    const result = await htmlToPngBuffer(
      "<html><head></head><body></body></html>",
      210,
      297,
      300
    )

    const metadata = await sharp(result).metadata()
    expect(metadata.width).toBe(A4_WIDTH_PX)
    expect(metadata.height).toBe(A4_HEIGHT_PX)
  })

  it("Retina環境（capturePageが2倍解像度を返す）でも目標サイズに正規化される", async () => {
    const retinaPng = await createPng(A4_WIDTH_PX * 2, A4_HEIGHT_PX * 2)
    mockCapturePage.mockResolvedValue({ toPNG: () => retinaPng })

    const result = await htmlToPngBuffer(
      "<html><head></head><body></body></html>",
      210,
      297,
      300
    )

    const metadata = await sharp(result).metadata()
    expect(metadata.width).toBe(A4_WIDTH_PX)
    expect(metadata.height).toBe(A4_HEIGHT_PX)
  })
})
