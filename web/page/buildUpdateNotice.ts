import { newerBuildIdOf, WEB_BUILD_ID } from "../webBuild"
import { WEB_BUILD_INFO_PATH } from "./webAssetPaths"

/**
 * 開いている間に新しい版が配られたことを知らせる（`web/webBuild.ts`）。
 *
 * 画面と Worker は開いたときの版のまま動き続けるので、壊れはしない。新しい版を使うには
 * 再読み込みが要り、migration もそのとき（Worker の起動）に走る。再読み込みすると作業中の
 * 入力が消えるので、**勝手には再読み込みしない**。知らせを出し、利用者が選ぶ。
 *
 * 確かめるのは、タブが見えるようになったときと、見えている間の一定の間隔ごと。読めなかった
 * とき（オフラインなど）は黙って次を待つ。
 *
 * Service Worker は画像を OPFS から返すだけで、キャッシュを持たない
 * （`web/serviceWorker/serviceWorker.ts`）。新しい版は再読み込みのときの登録で入れ替わり、
 * 待たずに受け持つ（`skipWaiting`）ので、ここでは扱わない。
 */

/** 見えている間に確かめる間隔 */
const CHECK_INTERVAL_MS = 15 * 60 * 1000

const NOTICE_ELEMENT_ID = "score-at-once-new-build-notice"

/** 一度閉じられた版。同じ版ではもう出さない（さらに新しい版が出たら出す） */
let dismissedBuildId: string | null = null

const createButton = (label: string, onClick: () => void) => {
  const button = document.createElement("button")
  button.type = "button"
  button.textContent = label
  button.style.cssText =
    "padding:6px 14px;border:1px solid #888;border-radius:6px;background:#fff;" +
    "color:#111;font:inherit;cursor:pointer"
  button.addEventListener("click", onClick)
  return button
}

/** 再読み込みのボタン。押されたときだけ再読み込みする */
export const createReloadButton = () =>
  createButton("再読み込み", () => window.location.reload())

/**
 * 画面の隅に、新しい版があることを出す。作業を遮らないよう、フォーカスは奪わない
 * （キー操作での採点を止めない）
 */
const showNewBuildNotice = (newBuildId: string) => {
  if (document.getElementById(NOTICE_ELEMENT_ID)) return
  const notice = document.createElement("div")
  notice.id = NOTICE_ELEMENT_ID
  notice.setAttribute("role", "status")
  notice.setAttribute("aria-live", "polite")
  notice.style.cssText =
    "position:fixed;right:16px;bottom:16px;z-index:2147483646;max-width:min(28em,calc(100vw - 32px));" +
    "display:flex;flex-direction:column;gap:10px;padding:14px 16px;border:1px solid #c9c9c9;" +
    "border-radius:10px;background:#fff;color:#111;font:14px/1.6 sans-serif;" +
    "box-shadow:0 6px 24px rgba(0,0,0,0.18)"
  const message = document.createElement("p")
  message.style.cssText = "margin:0"
  message.textContent =
    "新しい版があります。保存していない作業が無いことを確かめて再読み込みしてください。"
  const actions = document.createElement("div")
  actions.style.cssText = "display:flex;gap:8px;justify-content:flex-end"
  actions.append(
    createButton("あとで", () => {
      dismissedBuildId = newBuildId
      notice.remove()
    }),
    createReloadButton()
  )
  notice.append(message, actions)
  document.body.append(notice)
}

const checkForNewBuild = async () => {
  let buildInfo: unknown
  try {
    const response = await fetch(WEB_BUILD_INFO_PATH, { cache: "no-store" })
    if (!response.ok) return
    buildInfo = await response.json()
  } catch {
    return
  }
  const newBuildId = newerBuildIdOf(buildInfo, WEB_BUILD_ID)
  if (newBuildId === null || newBuildId === dismissedBuildId) return
  showNewBuildNotice(newBuildId)
}

/** 新しい版が配られたかを見張り始める。起動が済んでから呼ぶ */
export function watchForNewBuild() {
  const checkIfVisible = () => {
    if (document.visibilityState === "visible") void checkForNewBuild()
  }
  document.addEventListener("visibilitychange", checkIfVisible)
  window.setInterval(checkIfVisible, CHECK_INTERVAL_MS)
}
