/**
 * NAS同期機能の型定義
 */

/**
 * どこを正本として動くか。**起動時に1度だけ決まり、動いている間は変わらない**
 * （`../../storageRoots.ts`）。
 *
 * - `local`: 実行ファイルの隣の `data` の DB と画像だけを使う。同期はしない
 * - `shared`: 共有プロファイルの1つを使う。DB は `data/shared/<識別id>/` の手元の控え、
 *   画像と同期の写しは共有フォルダに置く
 *
 * 2つのモードは別々の世界で、データを暗黙に行き来させない。移すのは利用者が
 * 「移行」を選んだときだけで、移行先が空のときに限る（`sharedProfileSetup.ts`）。
 */
export type StorageMode = "local" | "shared"

/**
 * 共有プロファイル1つ（＝接続先の共有フォルダ1つ）。
 *
 * 共有フォルダは**パスでなく識別ファイルの id で見分ける**。PCごとにドライブ文字や
 * UNC の表記が違うので、パスでは同じフォルダと分からない。手元の控えの置き場は
 * id から決まる（`data/shared/<sharedFolderId>/`）ので、ここには持たない。
 */
export interface SharedProfile {
  /** 共有フォルダの識別ファイルに書かれた id（uuidv4）。プロファイルの鍵 */
  sharedFolderId: string
  /** このPCから見た共有フォルダのパス。同じ共有フォルダを別の表記で選び直すと書き換わる */
  sharedFolderPath: string
}

/**
 * clientId を振ったPC。data を丸ごと別のPCへ写すと clientId も写るので、
 * 起動時にこれと今のPCを比べて、違えば振り直す（`machineIdentity.ts`）。
 */
export interface ClientIdOwner {
  /** userData に置いた、このPC（OSの利用者）ごとの id（uuidv4）。data と一緒には写らない */
  installationId: string
  /** OS のホスト名。移動プロファイルで userData ごと別のPCへ渡った場合を見分ける */
  hostname: string
}

/**
 * 同期とモードの設定。`data/sync-config.json` に置く（`syncConfig.ts`）。
 *
 * **userData には置かない。** アプリの更新で利用者が data を写せば、設定も一緒に移る。
 */
export interface SyncAppConfig {
  /** 次に起動したときのモード（動いている間のモードは `StorageRoots.mode`） */
  mode: StorageMode
  /** 共有モードで使うプロファイルの `sharedFolderId`。ローカルモードでは使わない */
  activeSharedFolderId: string | null
  /** 登録済みの共有プロファイル */
  sharedProfiles: SharedProfile[]
  /** このPCの同期クライアントの id（uuidv4）。PCで1つで、全プロファイルが共有する */
  clientId: string
  /** `clientId` を振ったPC */
  clientIdOwner: ClientIdOwner | null
  intervalMs: number
  changelogRetentionDays: number
}

/** スキーマバージョン不一致でスキップされたリモートクライアント */
export interface VersionMismatchRemote {
  clientId: string
  remoteVersion: string | null
  /**
   * リモートの方が新しいかどうか（= このPCのアプリ更新が必要）。
   * マイグレーション名はタイムスタンプ接頭辞のため辞書順比較で判定できる。
   */
  remoteIsNewer: boolean
}

/**
 * 別id・同一ユニークキーでかぶった行のうち、片方が**隠れた**（または隠れなくなった）記録。
 *
 * ライブラリの `RecordFold`（sqlite-nas-sync）と同じ形をアプリ側で名指ししたもの。
 * renderer は electron-src から型しか引けず、ライブラリ本体（better-sqlite3 を抱える）を
 * renderer の型空間へ持ち込みたくないのでここに置く。**中身は加工しない**ので、
 * `RecordFold[]` をそのまま代入でき、形がずれれば tsc が止める。
 *
 * v0.20.0 から、かぶった行は**1つへ畳まれない**。版の順序の弱い方がアプリの表に
 * 置かれなくなる（隠れる）だけで、その行の事実はライブラリの帳簿に残り続け、重なりが
 * 解ければ次の同期で表へ戻る。ただし v0.21.0 から、表示している方を**削除**したときは
 * 隠れている方にも削除が書かれる（利用者から見れば1行なので）ので、そのときは戻らない。
 * 戻るのは、名前が変わるなどして重なりが解けたときである。
 *
 * v0.19.0 までの「消えた行」「子の付け替え」「引き継げず失った子」はどれも起きなく
 * なったので、それを数える欄も無い。
 */
export interface SyncRecordFold {
  /** かぶりが起きたテーブル名（Prisma のモデル名） */
  tableName: string
  /** 隠れた側（隠れなくなった記録では、表示に戻った側）のid */
  losingId: string
  /** 表示されている側（隠れなくなった記録では、隠れていたときに表示されていた側）のid */
  winningId: string
}

/**
 * 1回の同期で、かぶりによって見え方が変わった行の一覧（renderer へ押し出す形）。
 *
 * 隠れた行と戻った行は、同じ回に両方起きうる。1つの押し出しにまとめるのは、
 * 同期1回ぶんの出来事を renderer が一度に受け取れるようにするため。
 */
export interface SyncRecordFoldReport {
  /** この回に新しく隠れた行（ライブラリの `SyncResult.folds`） */
  folds: SyncRecordFold[]
  /** この回に隠れなくなって表示に戻った行（ライブラリの `SyncResult.restores`） */
  restores: SyncRecordFold[]
}

/**
 * 親の行が削除されているために**アプリの表に入らなくなった**（または再び入った）行の記録。
 *
 * ライブラリの `ParentDeletedRecord`（sqlite-nas-sync v0.21.0）と同じ形をアプリ側で
 * 名指ししたもの。`SyncRecordFold` と同じ理由でここに置く（renderer にライブラリ本体を
 * 持ち込まず、形がずれれば tsc が止める）。**中身は加工しない**。
 *
 * 他のPCで親を消したのと並行に、こちらで子を書き足していた場合に起きる。子の版は
 * 帳簿に残り続けるので、**物理的に消えてはいない**。親が同じ id で作り直されれば、
 * 子は元の形で表へ戻る（そのときは `parentReturned` に出る）。
 */
export interface SyncParentDeleted {
  /** 表から外れた（戻った）子の行のテーブル名 */
  tableName: string
  /** 表から外れた（戻った）子の行のid */
  recordId: string
  /** 子の行の中身。列名から値への対応 */
  content: Record<string, unknown>
  /** 削除されている親のテーブル名。孫なら、大元で削除された行のテーブル名 */
  causeTable: string
  /** 削除されている親のid。孫なら、大元で削除された行のid */
  causeId: string
}

/**
 * 1回の同期で、親の削除によって見え方が変わった行の一覧（renderer へ押し出す形）。
 *
 * 外れた行と戻った行は、同じ回に両方起きうる。どちらも**前回の同期からの差分**で、
 * 状態はライブラリの内部表に残っているので、押し出しを取りこぼしても中身は失われない。
 */
export interface SyncParentDeletedReport {
  /** この回に親の削除で表から外れた行（ライブラリの `SyncResult.parentDeleted`） */
  parentDeleted: SyncParentDeleted[]
  /** この回に親が作り直されて表へ戻った行（ライブラリの `SyncResult.parentReturned`） */
  parentReturned: SyncParentDeleted[]
}

/** syncステータス（ランタイム状態） */
export interface SyncAppStatus {
  state: "idle" | "syncing" | "error" | "disabled"
  lastSyncTime: string | null
  lastError: string | null
  syncCount: number
  /** 直近のsyncでスキーマバージョン不一致によりスキップされたリモート */
  versionMismatches: VersionMismatchRemote[]
  /**
   * 直近の同期が出した注意書きの全文（ライブラリの `SyncResult.warnings` の原文）。
   *
   * トーストは流れて消えるので、**消えない置き場**として状態に持つ。同じ注意は
   * 同期のたびに出るから、履歴ではなく直近1回ぶんだけを保つ（溜めると、直っていない
   * のか昔の話なのかが読めなくなる）。
   *
   * **文面はライブラリの原文のまま**で、利用者向けの言い換えと「新しく出たか」の
   * 見分けは renderer が行う（`src/lib/shared/syncWarningMessages.ts`）。main は
   * 出来事を加工しない。
   */
  lastWarnings: string[]
}

/** 設定ファイルが無いとき（新規インストール）の設定 */
export const DEFAULT_SYNC_CONFIG: SyncAppConfig = {
  mode: "local",
  activeSharedFolderId: null,
  sharedProfiles: [],
  clientId: "",
  clientIdOwner: null,
  intervalMs: 30000,
  changelogRetentionDays: 7,
}
