/**
 * 起動時に根を決める（issue #1322）
 *
 * `appInitializer.ts` の最初に1度だけ呼び、結果を `fixStorageRoots` で確定する。
 * ここより前に DB や画像の置き場を参照してはならない。
 *
 * 1. 旧版（userData に同期の控えがある版）からの引き継ぎ（`legacyUserDataMigration.ts`）
 * 2. clientId がこのPCのものかを確かめ、違えば振り直す（data を別のPCへ写した場合）
 * 3. モードとプロファイルから根を決める。共有モードで使えないときは、ローカルモードで
 *    起動するかを利用者に尋ねる
 * 4. ローカルモードなら、`data/database.db` に残った同期の仕組みを取り除く
 */

import * as fs from "fs"

import {
  computeLocalRoots,
  computeSharedRoots,
  type StorageRoots,
} from "../storageRoots"
import {
  type LegacyMigrationOutcome,
  migrateLegacyUserDataReplica,
} from "./legacyUserDataMigration"
import {
  getSharedReplicaDatabasePath,
  inspectSharedFolder,
} from "./sharedFolder"
import {
  ensureClientIdOwnedBy,
  loadSyncConfig,
  saveSyncConfig,
} from "./syncConfig"
import { removeSyncMachinery } from "./syncInstanceFactory"
import type { ClientIdOwner, SharedProfile, SyncAppConfig } from "./types"

/** 起動を続けられない。`message` は利用者に見せる文 */
export class StorageStartupError extends Error {}

/** 起動の準備が外界とやり取りする口（試験では差し替える） */
export interface StartupStorageEnvironment {
  /** 実行ファイルの隣の data */
  localDataDirectory: string
  /**
   * 旧版の控えを探す userData。null なら引き継ぎを見ない（`SCORE_AT_ONCE_DATA_DIR` で
   * data を差し替えて起動したとき。userData の控えはその data のものではない）
   */
  legacyUserDataDirectory: string | null
  /** このPCの身元 */
  currentOwner: ClientIdOwner
  /** 利用者に知らせる（起動は続ける） */
  notify: (message: string) => Promise<void>
  /** 共有モードで起動できない。ローカルモードで起動するなら true、やめるなら false */
  confirmLocalFallback: (message: string) => Promise<boolean>
}

/**
 * 共有プロファイルで起動できるか。できなければ理由を返す。
 *
 * 共有フォルダに届かないだけなら起動する（手元の控えで作業でき、同期は届いたときに
 * 進む。画像は見えない）。届いているのに識別ファイルが違う・無いなら、そのパスは
 * もう別のフォルダなので起動しない。
 */
function findSharedStartupProblem(
  localDataDirectory: string,
  profile: SharedProfile
): string | null {
  const replicaPath = getSharedReplicaDatabasePath(
    localDataDirectory,
    profile.sharedFolderId
  )
  if (!fs.existsSync(replicaPath)) {
    return (
      `共有プロファイル（${profile.sharedFolderPath}）の手元の控えがありません（${replicaPath}）。` +
      `設定の同期タブで共有フォルダを選び直すと、作り直せます。`
    )
  }
  const inspection = inspectSharedFolder(profile.sharedFolderPath)
  if (inspection.kind === "unreachable") {
    console.warn(
      `Shared folder is unreachable; starting with the local replica: ${profile.sharedFolderPath} (${inspection.reason})`
    )
    return null
  }
  if (
    inspection.kind === "shared" &&
    inspection.sharedFolderId === profile.sharedFolderId
  ) {
    return null
  }
  return (
    `共有フォルダ（${profile.sharedFolderPath}）が、登録したときの共有フォルダではなくなっています。` +
    `設定の同期タブで、正しい共有フォルダを選び直してください。`
  )
}

/**
 * ローカルモードの DB に同期の仕組みが残っていれば取り除く（Prisma が DB を開く前）。
 *
 * 旧版で同期を切った利用者の `data/database.db` には、書き戻した控えにあった
 * トリガーと内部の表が残っている。ローカルモードは同期と切り分けた世界なので、
 * 1度だけ取り除く（取り除けば次からは何も残っていない）。何も残っていない DB では、
 * ライブラリは `sqlite_master` を1度読むだけで何もしない。DB がまだ無ければ開かない
 * （開くと空のファイルができる）。
 *
 * 取り除いたことはログに残すだけで、利用者には知らせない。データは変わらず、
 * 利用者がすることも無いので。**失敗しても起動は続ける。** 取り除けなくても
 * データは失われず（1つのトランザクションなので半端にもならない）、次の起動でまた試す。
 */
async function removeLeftoverSyncMachinery(
  databasePath: string
): Promise<void> {
  if (!fs.existsSync(databasePath)) return
  try {
    const removed = await removeSyncMachinery(databasePath)
    if (removed.length > 0) {
      console.info(
        `Removed sync machinery left in the local-mode database (${removed.length} objects): ${databasePath}`
      )
    }
  } catch (error) {
    console.error(
      `Failed to remove sync machinery from the local-mode database; continuing: ${databasePath}`,
      error
    )
  }
}

/** 旧版からの引き継ぎの結果を、起動の続け方に変える */
async function handleLegacyOutcome(
  outcome: LegacyMigrationOutcome,
  config: SyncAppConfig,
  environment: StartupStorageEnvironment
): Promise<SyncAppConfig> {
  if (outcome.kind === "none") return config
  if (outcome.kind === "failed") {
    // 起動を続けると、移しきれていない data/database.db で作業させることになる。
    // 次の起動で引き継ぎをやり直すと、その作業が控えで置き換わってしまうので、止める
    throw new StorageStartupError(outcome.message)
  }
  await environment.notify(
    "以前の版で同期に使っていたデータを、このアプリの data フォルダへ移しました。ローカルモードで起動します。" +
      (outcome.leftoverDirectory === null
        ? ""
        : `\n（移し終えた古いデータ ${outcome.leftoverDirectory} を消せませんでした。手で消してかまいません）`)
  )
  return { ...config, mode: "local" }
}

/**
 * 起動時の根を決める。設定を変えたら保存する。
 *
 * @throws StorageStartupError 起動を続けられないとき（利用者がやめることを選んだときも）
 */
export async function prepareStorageAtStartup(
  environment: StartupStorageEnvironment
): Promise<StorageRoots> {
  const { localDataDirectory } = environment
  fs.mkdirSync(localDataDirectory, { recursive: true })
  const loaded = loadSyncConfig(localDataDirectory)

  let config = loaded
  if (environment.legacyUserDataDirectory !== null) {
    const outcome = await migrateLegacyUserDataReplica({
      userDataDirectory: environment.legacyUserDataDirectory,
      localDataDirectory,
    })
    config = await handleLegacyOutcome(outcome, config, environment)
  }

  const owned = ensureClientIdOwnedBy(config, environment.currentOwner)
  if (owned.reissued) {
    console.warn(
      `clientId was issued on another PC; reissued: ${config.clientId} -> ${owned.config.clientId}`
    )
  }
  config = owned.config

  let roots = computeLocalRoots(localDataDirectory)
  const profile =
    config.mode === "shared"
      ? config.sharedProfiles.find(
          (candidate) =>
            candidate.sharedFolderId === config.activeSharedFolderId
        )
      : undefined
  if (profile !== undefined) {
    const problem = findSharedStartupProblem(localDataDirectory, profile)
    if (problem === null) {
      roots = computeSharedRoots(localDataDirectory, profile)
    } else {
      const fallback = await environment.confirmLocalFallback(problem)
      if (!fallback) throw new StorageStartupError(problem)
      config = { ...config, mode: "local" }
    }
  } else if (config.mode === "shared") {
    config = { ...config, mode: "local" }
  }

  if (JSON.stringify(config) !== JSON.stringify(loaded)) {
    saveSyncConfig(config, localDataDirectory)
  }
  if (roots.mode === "local") {
    await removeLeftoverSyncMachinery(roots.databasePath)
  }
  return roots
}
