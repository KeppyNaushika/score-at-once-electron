/**
 * 試験用に、データの根をローカルモードで確定する。
 *
 * アプリは起動時に1度だけ根を決める（`electron-src/lib/storageRoots.ts`）。画像の置き場
 * （`getSharedFilesDirectory`）や DB の場所はそこから読むので、本物の `dataManager` を
 * 通す試験は、読む前にこれを呼ぶ。vitest は試験ファイルごとにモジュールを読み直すので、
 * 1ファイルにつき1度呼べる。
 */
import {
  computeLocalRoots,
  fixStorageRoots,
} from "../../electron-src/lib/storageRoots"

export const fixLocalStorageRootsForTest = (localDataDirectory: string): void =>
  fixStorageRoots(computeLocalRoots(localDataDirectory))
