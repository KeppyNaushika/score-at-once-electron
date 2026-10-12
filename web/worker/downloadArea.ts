/**
 * 保存ダイアログが返す保存先（`WEB_DOWNLOAD_AREA` の下）への書き込みを、画面への
 * ダウンロードにする。
 *
 * 出力の経路（Excel・CSV/JSON・解答用紙の PDF/PNG など）は、どれも保存先を決めてから
 * `fsPromises.writeFile` で1回で書き切る（`fileSaver.ts`・`rDataExporter.ts` など）。
 * だから「この領域への writeFile・copyFile・rename が終わった時点」を書き終わりとして、
 * そのまま画面へ渡す。FileHandle（`fsPromises.open`）で書いたものは、閉じた時点で渡す。
 *
 * 画面へは `Blob` で渡す。大きなもの（統合アーカイブ `.sao` など）は OPFS の置き場
 * （`DOWNLOAD_STAGING_DIRECTORY`）に書いてから、その `File`（ディスクにあるまま）を渡すので、
 * 全体をメモリに載せない。置き場のファイルは画面がダウンロードを読み終えるまで残し、しばらく
 * 経ってから消す（Worker を次に起こしたときにも、残りを消す）。ホストには何も送らない。
 *
 * 保存先から派生したパス（`withFileNameSuffix` で接尾辞を足したもの）も、この領域の下なら
 * 同じく渡る。ディレクトリは実体を持たず、mkdir・stat・access は常に「ある」と答える。
 */
import * as path from "path"

import type { WorkerToPageMessage } from "../ipcProtocol"
import { DOWNLOAD_STAGING_DIRECTORY, WEB_DOWNLOAD_AREA } from "./webPaths"

/** 置き場のファイルを残しておく時間（画面のダウンロードが読み終えるまで） */
const STAGED_DOWNLOAD_RETENTION_MS = 10 * 60_000

/** そのパスが保存ダイアログの領域の中か（領域そのものも含む） */
export function isInDownloadArea(filePath: string): boolean {
  const normalizedPath = path.normalize(filePath)
  return (
    normalizedPath === WEB_DOWNLOAD_AREA ||
    normalizedPath.startsWith(`${WEB_DOWNLOAD_AREA}/`)
  )
}

/** 保存ダイアログが返す保存先。呼ぶたびに別のディレクトリを切る */
export function createDownloadPath(defaultPath: string | undefined): string {
  const fileName = path.basename(defaultPath ?? "") || "download"
  return path.join(WEB_DOWNLOAD_AREA, crypto.randomUUID(), fileName)
}

/**
 * 開くダイアログでフォルダを選ぶ代わりに返す、保存の領域のディレクトリ。呼ぶたびに別の
 * ディレクトリを切る。この下へ書いたファイルは1つずつダウンロードとして渡る
 */
export function createDownloadDirectory(): string {
  return path.join(WEB_DOWNLOAD_AREA, crypto.randomUUID())
}

/** 書き終えた中身を画面へ渡す（Blob は写さずに渡る） */
export function deliverDownload(filePath: string, contents: Blob): void {
  const message: WorkerToPageMessage = {
    kind: "download",
    fileName: path.basename(filePath),
    contents,
  }
  postMessage(message)
}

let stagingDirectoryPromise: Promise<FileSystemDirectoryHandle> | null = null

/** 置き場。この Worker で初めて使うときに、前に起こしたときの残りを消してから作る */
const getStagingDirectory = (): Promise<FileSystemDirectoryHandle> =>
  (stagingDirectoryPromise ??= (async () => {
    const root = await navigator.storage.getDirectory()
    await root
      .removeEntry(DOWNLOAD_STAGING_DIRECTORY, { recursive: true })
      .catch(() => undefined)
    return root.getDirectoryHandle(DOWNLOAD_STAGING_DIRECTORY, {
      create: true,
    })
  })())

/** 置き場に新しいファイルを作る（書き終えたら `deliverStagedDownload`） */
export async function createStagedDownloadFile(): Promise<FileSystemFileHandle> {
  const stagingDirectory = await getStagingDirectory()
  return stagingDirectory.getFileHandle(crypto.randomUUID(), { create: true })
}

/** ファイルを別の場所へ動かせる（Chrome の OPFS は対応。写さずに済む） */
interface MovableFileHandle {
  move: (destination: FileSystemDirectoryHandle, name: string) => Promise<void>
}

const isMovable = (
  fileHandle: FileSystemFileHandle
): fileHandle is FileSystemFileHandle & MovableFileHandle =>
  "move" in fileHandle && typeof fileHandle.move === "function"

/**
 * OPFS のファイルを置き場へ移して、そのハンドルを返す（`rename` で保存先へ渡すとき）。
 * 動かせなければ写してから元を消す
 */
export async function moveIntoDownloadStaging(
  fileHandle: FileSystemFileHandle,
  removeSource: () => Promise<void>
): Promise<FileSystemFileHandle> {
  const stagingDirectory = await getStagingDirectory()
  const stagedName = crypto.randomUUID()
  if (isMovable(fileHandle)) {
    await fileHandle.move(stagingDirectory, stagedName)
    return stagingDirectory.getFileHandle(stagedName)
  }
  const stagedFile = await copyIntoDownloadStaging(await fileHandle.getFile())
  await removeSource()
  return stagedFile
}

/** 中身を置き場へ写す（メモリに載せず、流して書く） */
export async function copyIntoDownloadStaging(
  contents: Blob
): Promise<FileSystemFileHandle> {
  const stagedFile = await createStagedDownloadFile()
  await contents.stream().pipeTo(await stagedFile.createWritable())
  return stagedFile
}

/** 置き場のファイルを画面へ渡し、しばらく経ってから消す */
export async function deliverStagedDownload(
  filePath: string,
  stagedFile: FileSystemFileHandle
): Promise<void> {
  deliverDownload(filePath, await stagedFile.getFile())
  const stagingDirectory = await getStagingDirectory()
  setTimeout(() => {
    void stagingDirectory.removeEntry(stagedFile.name).catch(() => undefined)
  }, STAGED_DOWNLOAD_RETENTION_MS)
}
