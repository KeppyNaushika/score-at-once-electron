/**
 * ローカルモードと共有モードの起動の e2e（issue #1322）
 *
 * 根（DB と画像の置き場）は起動時に1度だけ決まるので、切り替えは「設定を書く →
 * 起動し直す」でしか確かめられない。ここでは同じ data で2度起動する。
 *
 * - PC-A: ローカルモードで試験を作る → 空の共有フォルダへ移す（この時点で写しまで上がる）
 * - PC-B: PC-A が再起動する前に、新規インストールから同じ共有フォルダに合流する →
 *   共有モードで起動し直すと、PC-A の試験が見え、PC-B のローカルの試験とは混ざらない
 * - PC-A: 共有モードで起動し直すと、移したデータが見え、同期できる
 * - PC-B: ローカルモードを選んで起動し直すと、元のローカルのデータに戻る（書き戻しはしない）
 *
 * フォルダを選ぶダイアログはメインプロセスで差し替える（OS のダイアログは操作できない）。
 * 再起動ボタン（`app.relaunch()`）は Playwright の外へ出てしまうので押さず、
 * 「あとで」を選んでから閉じて起動し直す。
 */
import { expect, type Page, test } from "@playwright/test"
import * as fs from "fs"
import * as os from "os"
import * as path from "path"

import { createExam } from "./helpers/fixtures"
import { launchApp, type LaunchedApp, loginAsAdmin } from "./helpers/launchApp"
import { E2E_BASE_URL } from "./helpers/rendererPort"

const TEST_ROOT = fs.mkdtempSync(
  path.join(os.tmpdir(), "score-at-once-e2e-modes-")
)
const DATA_A = path.join(TEST_ROOT, "pc-a")
const DATA_B = path.join(TEST_ROOT, "pc-b")
const SHARED_FOLDER = path.join(TEST_ROOT, "shared")

let launched: LaunchedApp | null = null

// 1本の試験でアプリを2度起動するので、既定の60秒では足りない
test.describe.configure({ mode: "serial", timeout: 240_000 })

test.beforeAll(() => {
  for (const directory of [DATA_A, DATA_B, SHARED_FOLDER]) {
    fs.mkdirSync(directory, { recursive: true })
  }
})

test.afterEach(async () => {
  if (launched) await launched.close()
  launched = null
})

test.afterAll(() => {
  fs.rmSync(TEST_ROOT, { recursive: true, force: true })
})

/** 起動している根をアプリ自身に訊く */
const runningStorage = (page: Page) =>
  page.evaluate(async () => (await window.electronAPI.sync.getConfig()).running)

/** フォルダを選ぶダイアログを、決まったフォルダを返すものに差し替える */
async function stubFolderDialog(app: LaunchedApp, folder: string) {
  await app.app.evaluate(({ dialog }, chosen) => {
    dialog.showOpenDialog = async () => ({
      canceled: false,
      filePaths: [chosen],
    })
  }, folder)
}

async function openSyncSettings(page: Page) {
  await page.goto(`${E2E_BASE_URL}/settings`, { waitUntil: "domcontentloaded" })
  await page.getByRole("tab", { name: /同期設定/ }).click()
  await expect(page.getByText("起動するデータ")).toBeVisible({
    timeout: 15_000,
  })
}

test("PC-A: ローカルモードのデータを空の共有フォルダへ移すと、その時点で同期の写しまで上がる", async () => {
  launched = await launchApp({ dataDir: DATA_A })
  const { page } = launched
  await loginAsAdmin(page)
  expect((await runningStorage(page)).mode).toBe("local")
  await createExam(page, "PC-A の期末考査")

  await stubFolderDialog(launched, SHARED_FOLDER)
  await openSyncSettings(page)
  await page.getByRole("button", { name: /共有フォルダを追加/ }).click()
  await expect(page.getByText("共有しているデータがありません")).toBeVisible()
  await page
    .getByRole("button", { name: "ローカルのデータを移して始める" })
    .click()
  await expect(page.getByText("再起動して切り替えますか？")).toBeVisible({
    timeout: 60_000,
  })
  await page.getByRole("button", { name: "あとで" }).click()
  // 設定を変えただけでは根は変わらない
  expect((await runningStorage(page)).mode).toBe("local")
  await expect(page.getByText(/再起動すると切り替わります/)).toBeVisible()
  // PC-A を再起動しなくても、写しは上がっている
  expect(
    fs
      .readdirSync(path.join(SHARED_FOLDER, "sync"))
      .some((entryName) => entryName.startsWith("client-"))
  ).toBe(true)
  // PC-A は再起動せずに閉じる（共有モードではまだ一度も起動していない）
})

test("PC-B: PC-A が再起動する前に合流でき、共有モードで起動し直すと PC-A の試験が見える", async () => {
  launched = await launchApp({ dataDir: DATA_B })
  const { page } = launched
  await loginAsAdmin(page)
  await createExam(page, "PC-B のローカルだけの試験")

  await stubFolderDialog(launched, SHARED_FOLDER)
  await openSyncSettings(page)
  await page.getByRole("button", { name: /共有フォルダを追加/ }).click()
  await expect(page.getByText(/統合しません/)).toBeVisible()
  await page.getByRole("button", { name: "合流する" }).click()
  await expect(page.getByText("再起動して切り替えますか？")).toBeVisible({
    timeout: 60_000,
  })
  await page.getByRole("button", { name: "あとで" }).click()
  await launched.close()

  launched = await launchApp({ dataDir: DATA_B })
  const restarted = launched.page
  await loginAsAdmin(restarted)
  expect((await runningStorage(restarted)).mode).toBe("shared")
  await restarted.goto(`${E2E_BASE_URL}/exams`, {
    waitUntil: "domcontentloaded",
  })
  await expect(restarted.getByText("PC-A の期末考査").first()).toBeVisible({
    timeout: 15_000,
  })
  await expect(restarted.getByText("PC-B のローカルだけの試験")).toHaveCount(0)
})

test("PC-A: 共有モードで起動し直すと、移したデータが見え、画像の置き場は共有フォルダになる", async () => {
  launched = await launchApp({ dataDir: DATA_A })
  const { page } = launched
  await loginAsAdmin(page)
  const running = await runningStorage(page)
  expect(running.mode).toBe("shared")
  expect(running.sharedFilesDirectory).toBe(path.join(SHARED_FOLDER, "files"))
  await page.goto(`${E2E_BASE_URL}/exams`, { waitUntil: "domcontentloaded" })
  await expect(page.getByText("PC-A の期末考査").first()).toBeVisible({
    timeout: 15_000,
  })

  await openSyncSettings(page)
  await page.getByRole("button", { name: /今すぐ同期/ }).click()
  await expect(page.getByText("同期が完了しました")).toBeVisible({
    timeout: 60_000,
  })
})

test("PC-B: ローカルモードを選んで起動し直すと、元のローカルのデータで起動する", async () => {
  launched = await launchApp({ dataDir: DATA_B })
  const { page } = launched
  await loginAsAdmin(page)
  await openSyncSettings(page)
  await page.getByRole("button", { name: "次回はこれで起動" }).first().click()
  await expect(page.getByText("再起動して切り替えますか？")).toBeVisible()
  await page.getByRole("button", { name: "あとで" }).click()
  await launched.close()

  launched = await launchApp({ dataDir: DATA_B })
  const restarted = launched.page
  await loginAsAdmin(restarted)
  expect((await runningStorage(restarted)).mode).toBe("local")
  await restarted.goto(`${E2E_BASE_URL}/exams`, {
    waitUntil: "domcontentloaded",
  })
  await expect(
    restarted.getByText("PC-B のローカルだけの試験").first()
  ).toBeVisible({ timeout: 15_000 })
  await expect(restarted.getByText("PC-A の期末考査")).toHaveCount(0)
})
