/**
 * e2e が使う下ごしらえ（試験・模範解答・資料）。
 *
 * 全て画面から作る。DB へ直接書くと、画面が実際に通る経路を確かめられない。
 */
import { expect, type Page } from "@playwright/test"
import * as fs from "fs"
import * as os from "os"
import * as path from "path"

import { E2E_BASE_URL } from "./rendererPort"

const ROOT = path.resolve(__dirname, "../../../..")

/** 試験を1件作り、その id を返す */
export async function createExam(page: Page, name: string): Promise<string> {
  await page.goto(`${E2E_BASE_URL}/exams`, { waitUntil: "domcontentloaded" })
  await page.getByRole("button", { name: "新規試験作成" }).click()
  await page.getByLabel("試験名").fill(name)
  await page.getByRole("button", { name: "作成", exact: true }).click()

  // 一覧に現れたら「詳細」から開く（名前をクリックすると行の選択になる）
  await expect(page.getByText(name, { exact: true }).first()).toBeVisible({
    timeout: 15_000,
  })
  await page.getByRole("button", { name: "詳細" }).first().click()
  await expect(page).toHaveURL(/\/exams\/[0-9a-f-]{36}/, { timeout: 15_000 })
  const examId = /\/exams\/([0-9a-f-]{36})/.exec(page.url())?.[1]
  if (!examId)
    throw new Error(`試験の id を URL から取れなかった: ${page.url()}`)
  return examId
}

/** 模範解答を1枚アップロードする（PDF変換を避けたいので画像を使う） */
export async function uploadMasterPage(
  page: Page,
  examId: string
): Promise<void> {
  await page.goto(`${E2E_BASE_URL}/exams/${examId}/01-upload`, {
    waitUntil: "domcontentloaded",
  })

  const source = path.join(ROOT, "public/icons/icon_256x256.png")
  const fallback = path.join(ROOT, "public/icons/icon.iconset/icon_256x256.png")
  const imagePath = fs.existsSync(source) ? source : fallback
  const uploaded = path.join(
    fs.mkdtempSync(path.join(os.tmpdir(), "score-at-once-fixture-")),
    "master.png"
  )
  fs.copyFileSync(imagePath, uploaded)

  await page.locator('input[type="file"]').first().setInputFiles(uploaded)

  // 取り込みが終わるとページが1枚出る。
  //
  // かつては「次へ」が出たことを合図にしていたが、**「次へ」はヘッダーが常に
  // 出す**ようになったので合図にならない（取り込み前から見えている）。
  // 枚数の見出しで数える。
  await expect(page.getByText("模範解答 (1ページ)")).toBeVisible({
    timeout: 60_000,
  })
}

/** 試験外成績資料を1件作り、その id を返す */
export async function createCoursework(
  page: Page,
  name: string
): Promise<string> {
  await page.goto(`${E2E_BASE_URL}/coursework`, {
    waitUntil: "domcontentloaded",
  })
  await page.getByRole("button", { name: "新規作成" }).click()
  await page.getByLabel("資料名").fill(name)
  await page.getByRole("button", { name: "作成", exact: true }).click()

  // 作成すると、基本設定のモーダルを開いた状態でその資料へ移る
  await expect(page).toHaveURL(/\/coursework\/[0-9a-f-]{36}/, {
    timeout: 15_000,
  })
  const courseworkId = /\/coursework\/([0-9a-f-]{36})/.exec(page.url())?.[1]
  if (!courseworkId) {
    throw new Error(`資料の id を URL から取れなかった: ${page.url()}`)
  }
  return courseworkId
}
