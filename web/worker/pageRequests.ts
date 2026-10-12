/**
 * Worker から画面へ、画面でしかできないこと（ファイルを選ばせる・印刷する）を頼み、返事を待つ。
 * 通信の型は `web/ipcProtocol.ts`。
 *
 * 頼みには通し番号を付け、画面は同じ番号で返事をする。返事は Worker の入口（`backend.ts`）が
 * 受けて `settlePageRequest` に渡す。
 */
import type {
  OpenFilesRequest,
  PageToWorkerMessage,
  PrintHtmlRequest,
  WorkerToPageMessage,
} from "../ipcProtocol"

/** 画面からの返事 */
export type PageReplyMessage = Extract<
  PageToWorkerMessage,
  { kind: "filesOpened" | "htmlPrinted" }
>

const pendingRequests = new Map<number, (reply: PageReplyMessage) => void>()
let lastRequestId = 0

const requestPage = (
  buildMessage: (requestId: number) => WorkerToPageMessage
): Promise<PageReplyMessage> => {
  lastRequestId += 1
  const requestId = lastRequestId
  return new Promise((resolve) => {
    pendingRequests.set(requestId, resolve)
    postMessage(buildMessage(requestId))
  })
}

/** 画面からの返事を、待っている頼みに渡す */
export function settlePageRequest(reply: PageReplyMessage): void {
  const settle = pendingRequests.get(reply.requestId)
  pendingRequests.delete(reply.requestId)
  settle?.(reply)
}

/** 画面にファイルを選ばせ、結び付けた仮想パスを返す。選ばずに閉じたら null */
export async function requestOpenFiles(
  request: OpenFilesRequest
): Promise<string[] | null> {
  const reply = await requestPage((requestId) => ({
    kind: "openFiles",
    requestId,
    request,
  }))
  if (reply.kind !== "filesOpened") {
    throw new Error(`[web] openFiles に ${reply.kind} が返った`)
  }
  return reply.filePaths
}

/** 画面で HTML を印刷する。印刷ダイアログが閉じたら返る */
export async function requestPrintHtml(
  request: PrintHtmlRequest
): Promise<void> {
  const reply = await requestPage((requestId) => ({
    kind: "printHtml",
    requestId,
    request,
  }))
  if (reply.kind !== "htmlPrinted") {
    throw new Error(`[web] printHtml に ${reply.kind} が返った`)
  }
  if (reply.failure !== null) {
    throw new Error(reply.failure)
  }
}
