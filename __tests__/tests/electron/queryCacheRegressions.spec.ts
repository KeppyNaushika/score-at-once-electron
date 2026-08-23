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

import {
  createCoursework,
  createExam,
  uploadMasterPage,
} from "./helpers/fixtures"
import { launchApp, type LaunchedApp, loginAsAdmin } from "./helpers/launchApp"
import { E2E_BASE_URL } from "./helpers/rendererPort"

let launched: LaunchedApp

test.afterEach(async () => {
  if (launched) await launched.close()
})

test("未ログインで採点画面を開くとログイン画面へ送られる", async () => {
  // 採点は利用者ごとに結果を分けて保存する。誰が採点しているか分からないまま
  // 書かせない（以前は "default-user-id" という存在しない利用者で書いていた）
  launched = await launchApp()
  const { page } = launched

  await page.goto(`${E2E_BASE_URL}/exams/does-not-exist/07-score-at-once`, {
    waitUntil: "domcontentloaded",
  })

  await expect(page).toHaveURL(`${E2E_BASE_URL}/login`, { timeout: 15_000 })
})

test("未ログインなら、関門の無かった画面もログイン画面へ送られる", async () => {
  // 関門はページごとに置いていたので 40ページ中16ページにしか付いておらず、
  // 試験のワークフローでは 06・07 と試験詳細だけが守られていた
  launched = await launchApp()
  const { page } = launched

  await page.goto(`${E2E_BASE_URL}/exams/does-not-exist/02-template`, {
    waitUntil: "domcontentloaded",
  })

  await expect(page).toHaveURL(`${E2E_BASE_URL}/login`, { timeout: 15_000 })
})

test("解答用紙を編集して概要へ移り、作成へ戻っても編集が残る", async () => {
  // 以前は、作成タブの編集状態を共有キャッシュから作り、保存側がそのキーを
  // 更新していなかった。戻ってきた瞬間に古い内容が入り、自動保存がそれを
  // DB へ書き戻していた（＝セッション中の編集が消える）
  launched = await launchApp()
  const { page } = launched
  await loginAsAdmin(page)

  await page.goto(`${E2E_BASE_URL}/answer-sheet-builder`, {
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
  await expect(page.getByText("保存されました")).toBeVisible({
    timeout: 15_000,
  })

  await page.goto(detailUrl, { waitUntil: "domcontentloaded" })
  await expect(page.getByRole("heading", { name: edited })).toBeVisible({
    timeout: 15_000,
  })

  await page.goto(editorUrl, { waitUntil: "domcontentloaded" })
  await expect(page.getByRole("textbox").first()).toHaveValue(edited, {
    timeout: 15_000,
  })

  // 概要へもう一度移って、書き戻されていないことを確かめる
  await page.goto(detailUrl, { waitUntil: "domcontentloaded" })
  await expect(page.getByRole("heading", { name: edited })).toBeVisible({
    timeout: 15_000,
  })
})

test("解答用紙の一覧は担当の切り替えを持ち、担当でないものは編集を出さない", async () => {
  // 編集できるのは担当者ひとりだけ（OWNER / VIEWER。Editor は作らない）
  launched = await launchApp()
  const { page } = launched
  await loginAsAdmin(page)

  await page.goto(`${E2E_BASE_URL}/answer-sheet-builder`, {
    waitUntil: "domcontentloaded",
  })
  await page.getByRole("button", { name: "新規作成" }).click()
  await expect(page).toHaveURL(/\/answer-sheet-builder\/[^/]+\/01-edit/, {
    timeout: 15_000,
  })

  await page.goto(`${E2E_BASE_URL}/answer-sheet-builder`, {
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

test("04 を開いた後に 03 へ移っても、ページと採点領域の画面が出る", async () => {
  // 03 と 04 は同じ試験の別の複合ペイロードを取る。以前は同じキーだったので、
  // 04 を開いた後に 03 を開くと 04 のデータで描き始めていた
  launched = await launchApp()
  const { page } = launched
  await loginAsAdmin(page)

  const examId = await createExam(page, `キー分離の試験 ${Date.now()}`)
  await uploadMasterPage(page, examId)

  await page.goto(`${E2E_BASE_URL}/exams/${examId}/04-question-group`, {
    waitUntil: "domcontentloaded",
  })
  await expect(page.getByRole("heading", { name: /小計/ })).toBeVisible({
    timeout: 30_000,
  })

  await page.goto(`${E2E_BASE_URL}/exams/${examId}/03-region-info`, {
    waitUntil: "domcontentloaded",
  })
  await expect(
    page.getByRole("heading", { name: "領域情報テーブル（全ページ統一順序）" })
  ).toBeVisible({ timeout: 30_000 })
  // 04 の画面ではなく 03 の画面が出ていること
  await expect(page.getByRole("heading", { name: /小計/ })).toHaveCount(0)
})

test("09 で変えた出力設定は、07 へ移って戻っても残る", async () => {
  // 出力設定は取得結果を編集用 state へ写して使う。保存側が同じキーを更新しないと、
  // 戻ってきたときに保存前の値が種になり、そのまま上書き保存される
  launched = await launchApp()
  const { page } = launched
  await loginAsAdmin(page)

  const examId = await createExam(page, `出力設定の試験 ${Date.now()}`)

  // 採点マーク設定の「未採点にマークを付けるか」を使う（保存対象の設定）
  const openExport = async () => {
    await page.goto(`${E2E_BASE_URL}/exams/${examId}/09-export`, {
      waitUntil: "domcontentloaded",
    })
    const markUnscored = page.locator("#mark-unscored")
    await expect(markUnscored).toBeVisible({ timeout: 30_000 })
    return markUnscored
  }

  const markUnscored = await openExport()
  const before = await markUnscored.getAttribute("aria-checked")
  await markUnscored.click()
  await expect(markUnscored).not.toHaveAttribute("aria-checked", before ?? "")
  const after = await markUnscored.getAttribute("aria-checked")

  // 保存の debounce を跨いで 07 へ移る
  await page.goto(`${E2E_BASE_URL}/exams/${examId}/07-score-at-once`, {
    waitUntil: "domcontentloaded",
  })
  await page.waitForTimeout(2_000)

  const markUnscoredAgain = await openExport()
  await expect(markUnscoredAgain).toHaveAttribute("aria-checked", after ?? "")
})

test("資料の概要と評価項目を往復しても、どちらの画面も出る", async () => {
  // 概要と評価項目は同じ資料を同じ queryFn で取る。以前は評価項目の画面が
  // 同じキーへ項目の配列だけを書いていたので、概要へ戻ると資料本体が消えていた
  launched = await launchApp()
  const { page } = launched
  await loginAsAdmin(page)

  const name = `往復する資料 ${Date.now()}`
  const courseworkId = await createCoursework(page, name)

  const openDetail = async () => {
    await page.goto(`${E2E_BASE_URL}/coursework/${courseworkId}`, {
      waitUntil: "domcontentloaded",
    })
    await expect(page.getByRole("heading", { name })).toBeVisible({
      timeout: 30_000,
    })
  }

  await openDetail()

  await page.goto(`${E2E_BASE_URL}/coursework/${courseworkId}/03-items`, {
    waitUntil: "domcontentloaded",
  })
  await expect(page.getByRole("heading", { name: /評価項目/ })).toBeVisible({
    timeout: 30_000,
  })

  // 戻っても資料本体が出る（項目の配列で上書きされていない）
  await openDetail()
})

test("関門は画面遷移のたびに効き直す（レイアウトに置いても固まらない）", async () => {
  // 関門はレイアウトに1つだけ置いてある。Next.js の「レイアウトはナビゲーションで
  // 再実行されない」はサーバー側の話で、この関門は usePathname と認証コンテキストを
  // 購読するクライアントコンポーネントなので、画面を移るたびに評価し直される。
  // 固まっていれば、ここで中身が出ずに「読み込み中...」のままになる
  launched = await launchApp()
  const { page } = launched
  await loginAsAdmin(page)

  await page.goto(`${E2E_BASE_URL}/exams`, { waitUntil: "domcontentloaded" })
  await expect(page.getByRole("heading", { name: "試験一覧" })).toBeVisible({
    timeout: 30_000,
  })

  // サイドバーから画面内遷移する（ページ全体の読み込みではない）
  await page.getByRole("link", { name: "解答用紙作成" }).click()
  await expect(page).toHaveURL(`${E2E_BASE_URL}/answer-sheet-builder`, {
    timeout: 15_000,
  })
  await expect(page.getByRole("button", { name: "新規作成" })).toBeVisible({
    timeout: 15_000,
  })

  await page.getByRole("link", { name: "試験一覧" }).click()
  await expect(page).toHaveURL(`${E2E_BASE_URL}/exams`, { timeout: 15_000 })
  await expect(page.getByRole("heading", { name: "試験一覧" })).toBeVisible({
    timeout: 15_000,
  })
})
