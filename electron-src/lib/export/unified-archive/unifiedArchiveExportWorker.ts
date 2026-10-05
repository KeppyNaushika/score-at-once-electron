/**
 * 統合アーカイブ（.sao）の書き出しと下見をする作業者の入り口
 *
 * main が Electron の utilityProcess として起こす（`unifiedArchiveHandlers.ts`）。ビルドでは
 * main と別の束として `main/electron-src/unifiedArchiveExportWorker.js` に出る
 * （`scripts/buildMain.js`）。依頼は main が1つずつ送るので、ここは届いた順にこなすだけ。
 */

import {
  type ArchiveExportWorkerRequest,
  runArchiveExportJob,
} from "./archiveExportJob"

const { parentPort } = process

parentPort.on("message", (messageEvent) => {
  // 依頼を送るのは同じビルドの main だけ（`ArchiveExportWorkerRequest` の形で送る）
  const request: ArchiveExportWorkerRequest = messageEvent.data
  void runArchiveExportJob(request, (response) =>
    parentPort.postMessage(response)
  )
})
