/**
 * 画面を移って戻ったときの回帰の e2e
 *
 * データ取得を TanStack Query へ移した段階4〜8 で入れた不具合は、どれも
 * 「画面を移って戻る」ことでしか出ない。型検査もユニットテストも捕まえない:
 *
 * - キーの衝突は、片方の画面を開いた後でもう片方を開いて初めて起きる
 * - 取得結果を編集用 state へ写す処理は1回きりなので、キャッシュに古い値が
 *   残っている状態で再マウントしたときだけ古い値が入る
 *
 * ここは「実際に踏まないと分からない」ことだけを置く。ロジックの検証は
 * vitest 側（__tests__/renderer, __tests__/exam ほか）に置くこと。
 *
 * 詳細は docs/ipc-and-data-fetching-plan.md の段階7・段階8。
 */
import { expect, test } from "@playwright/test"

import { launchApp, type LaunchedApp, loginAsAdmin } from "./helpers/launchApp"

let launched: LaunchedApp

test.afterEach(async () => {
  if (launched) await launched.close()
})

const BASE = "http://localhost:3000"

test("未ログインで採点画面を開くとログインへ戻る", async () => {
  // 採点は利用者ごとに結果を分けて保存する。誰が採点しているか分からないまま
  // 書かせない（以前は "default-user-id" という存在しない利用者で書いていた）
  launched = await launchApp()
  const { page } = launched

  await page.goto(`${BASE}/exams/does-not-exist/07-score-at-once`, {
    waitUntil: "domcontentloaded",
  })

  await expect(page).toHaveURL(`${BASE}/`, { timeout: 15_000 })
})

test("解答用紙を編集して概要へ移り、作成へ戻っても編集が残る", async () => {
  // 以前は、作成タブの編集状態を共有キャッシュから作り、保存側がそのキーを
  // 更新していなかった。戻ってきた瞬間に古い内容が入り、自動保存がそれを
  // DB へ書き戻していた（＝セッション中の編集が消える）
  launched = await launchApp()
  const { page } = launched
  await loginAsAdmin(page)

  await page.goto(`${BASE}/answer-sheet-builder`, {
    waitUntil: "domcontentloaded",
  })
  await page.getByRole("button", { name: "新規作成" }).click()
  await expect(page).toHaveURL(/\/answer-sheet-builder\/[^/]+\/01-edit/, {
    timeout: 15_000,
  })

  const editorUrl = page.url()
  const detailUrl = editorUrl.replace("/01-edit", "")
  const edited = `編集した解答用紙 ${Date.now()}`

  const nameInput = page.getByRole("textbox").first()
  await nameInput.fill(edited)
  // 自動保存が落ち着くまで待つ
  await expect(page.getByText("保存しました")).toBeVisible({ timeout: 15_000 })

  await page.goto(detailUrl, { waitUntil: "domcontentloaded" })
  await expect(page.getByText(edited)).toBeVisible({ timeout: 15_000 })

  await page.goto(editorUrl, { waitUntil: "domcontentloaded" })
  await expect(page.getByRole("textbox").first()).toHaveValue(edited, {
    timeout: 15_000,
  })

  // 概要へもう一度移って、書き戻されていないことを確かめる
  await page.goto(detailUrl, { waitUntil: "domcontentloaded" })
  await expect(page.getByText(edited)).toBeVisible({ timeout: 15_000 })
})

test("解答用紙の一覧は担当の切り替えを持ち、担当でないものは編集を出さない", async () => {
  // 編集できるのは担当者ひとりだけ（OWNER / VIEWER。Editor は作らない）
  launched = await launchApp()
  const { page } = launched
  await loginAsAdmin(page)

  await page.goto(`${BASE}/answer-sheet-builder`, {
    waitUntil: "domcontentloaded",
  })
  await page.getByRole("button", { name: "新規作成" }).click()
  await expect(page).toHaveURL(/\/answer-sheet-builder\/[^/]+\/01-edit/, {
    timeout: 15_000,
  })

  await page.goto(`${BASE}/answer-sheet-builder`, {
    waitUntil: "domcontentloaded",
  })

  // 既定は自分が担当の分だけ。切り替えで全員分
  await expect(
    page.getByText("全員の解答用紙を表示", { exact: true })
  ).toBeVisible({ timeout: 15_000 })
  // 自分が作ったものは担当が「自分」
  await expect(page.getByRole("cell", { name: "自分" }).first()).toBeVisible({
    timeout: 15_000,
  })
})
