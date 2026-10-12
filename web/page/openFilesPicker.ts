import type { OpenFilesRequest } from "../ipcProtocol"

/**
 * 開くダイアログ（Worker の `dialog.showOpenDialog`）の代わりに、画面でファイルを選ばせる。
 *
 * ファイルの選択はユーザーの操作の直後（transient activation の間）でないと出せない。
 * 画面のボタンを押す → Worker へ invoke → Worker から `openFiles` が返る、の往復は短いので
 * 多くはそのまま出せる。出せないとき（操作から時間が経った・操作なしで呼ばれた）は黙って
 * 何も起きないので、先に `navigator.userActivation` で確かめ、切れていれば「ファイルを選ぶ」
 * ボタンの付いた案内を出して、押されたときに選ばせる。
 */

/** 選択を出せるか。`userActivation` の無いブラウザでは、出してみるしかない */
const canShowFilePicker = () => navigator.userActivation?.isActive ?? true

const acceptOf = (extensions: string[] | null) =>
  extensions === null
    ? ""
    : extensions.map((extension) => `.${extension}`).join(",")

/** `<input type="file">` で選ばせる。選ばずに閉じたら null */
const showFileInput = (request: OpenFilesRequest) =>
  new Promise<File[] | null>((resolve) => {
    const input = document.createElement("input")
    input.type = "file"
    input.multiple = request.multiple
    input.accept = acceptOf(request.extensions)
    input.style.display = "none"
    const settle = (files: File[] | null) => {
      input.remove()
      resolve(files)
    }
    input.addEventListener(
      "change",
      () => settle(input.files ? Array.from(input.files) : null),
      { once: true }
    )
    input.addEventListener("cancel", () => settle(null), { once: true })
    document.body.append(input)
    input.click()
  })

/** 選択を出せなかったときの案内。押されたらそのボタンの操作で選ばせる */
const showPickerNotice = (request: OpenFilesRequest) =>
  new Promise<File[] | null>((resolve) => {
    const notice = document.createElement("div")
    notice.setAttribute("role", "dialog")
    notice.setAttribute("aria-label", "ファイルを選ぶ")
    notice.style.cssText =
      "position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:2147483647;" +
      "display:flex;align-items:center;gap:12px;max-width:calc(100vw - 32px);padding:12px 16px;" +
      "border:1px solid #d4d4d8;border-radius:8px;background:#fff;color:#111;" +
      "box-shadow:0 4px 16px rgba(0,0,0,0.15);font:14px/1.5 sans-serif"
    const message = document.createElement("span")
    message.textContent = request.title
      ? `「${request.title}」のファイルを選んでください`
      : "ファイルを選んでください"
    const buttonStyle =
      "padding:4px 12px;border-radius:6px;font:inherit;cursor:pointer;white-space:nowrap"
    const chooseButton = document.createElement("button")
    chooseButton.type = "button"
    chooseButton.textContent = "ファイルを選ぶ"
    chooseButton.style.cssText = `${buttonStyle};border:1px solid #18181b;background:#18181b;color:#fff`
    const cancelButton = document.createElement("button")
    cancelButton.type = "button"
    cancelButton.textContent = "やめる"
    cancelButton.style.cssText = `${buttonStyle};border:1px solid #d4d4d8;background:#fff;color:#111`

    const close = () => {
      notice.remove()
      document.removeEventListener("keydown", cancelOnEscape, true)
    }
    const cancelOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return
      event.stopPropagation()
      close()
      resolve(null)
    }
    chooseButton.addEventListener("click", () => {
      close()
      void showFileInput(request).then(resolve)
    })
    cancelButton.addEventListener("click", () => {
      close()
      resolve(null)
    })
    document.addEventListener("keydown", cancelOnEscape, true)
    notice.append(message, chooseButton, cancelButton)
    document.body.append(notice)
    chooseButton.focus()
  })

/** ファイルを選ばせる。選ばずに閉じたら null */
export function pickFiles(request: OpenFilesRequest): Promise<File[] | null> {
  return canShowFilePicker()
    ? showFileInput(request)
    : showPickerNotice(request)
}
