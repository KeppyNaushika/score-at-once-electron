# sqlite-nas-sync 開発プロンプト

## プロジェクト概要

NASに弱いSQLiteで分散協調処理を実現するための汎用syncライブラリ。
独立したnpmパッケージとして開発し、ORM非依存（SQLiteレベルで動作）とする。

## アーキテクチャ

```
各クライアント:
  ローカルSQLite DB（読み書き）
    → 定期的にNAS上にフルコピー

NAS上:
  client_A.db  (AのフルDBコピー、_changelog含む)
  client_B.db
  ...
  client_N.db

Sync時:
  自分のDBをNASにコピー（書き込み）
  他クライアントのDBを読み取り専用で開く
  _changelogテーブルで差分を特定
  差分レコードをローカルDBに反映
```

## ライブラリの3つの責務

### 1. バリデーション（validate）

対象DBがsync可能かチェックする:
- 指定テーブルが存在するか
- 指定テーブルのPKが指定カラム（デフォルト: `id`）で、型がTEXT（UUID）か
- 指定テーブルに `updatedAt` カラムがあるか

### 2. セットアップ（setup）

SQLiteレベルでトリガーとテーブルを作成する（冪等）:

#### _changelog テーブル

```sql
CREATE TABLE IF NOT EXISTS _changelog (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  tableName TEXT    NOT NULL,
  recordId  TEXT    NOT NULL,
  operation TEXT    NOT NULL,  -- 'INSERT' | 'UPDATE' | 'DELETE'
  changedAt TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_changelog_id ON _changelog(id);
```

#### トリガー（対象テーブルごとに3つ）

```sql
-- INSERT追跡
CREATE TRIGGER IF NOT EXISTS _changelog_after_insert_{TableName}
AFTER INSERT ON {TableName} FOR EACH ROW
BEGIN
  INSERT INTO _changelog (tableName, recordId, operation)
  VALUES ('{TableName}', NEW.{primaryKey}, 'INSERT');
END;

-- UPDATE追跡
CREATE TRIGGER IF NOT EXISTS _changelog_after_update_{TableName}
AFTER UPDATE ON {TableName} FOR EACH ROW
BEGIN
  INSERT INTO _changelog (tableName, recordId, operation)
  VALUES ('{TableName}', NEW.{primaryKey}, 'UPDATE');
END;

-- DELETE追跡（onDelete: Cascadeによる連鎖削除でも発火する）
CREATE TRIGGER IF NOT EXISTS _changelog_after_delete_{TableName}
AFTER DELETE ON {TableName} FOR EACH ROW
BEGIN
  INSERT INTO _changelog (tableName, recordId, operation)
  VALUES ('{TableName}', OLD.{primaryKey}, 'DELETE');
END;
```

### 3. Sync（コア機能）

定期的に実行される同期処理:

```
sync()
├─ 1. ローカルDBをNASにコピー（アトミック: 一時ファイル→rename）
├─ 2. NAS上の他クライアントDBファイルを列挙
├─ 3. 各リモートDBを読み取り専用で開く（PRAGMA query_only = ON）
│     ├─ SELECT * FROM _changelog WHERE id > :lastSeenId
│     │  → 0件ならこのクライアントはスキップ
│     │  → M件なら以下を実行:
│     ├─ operation = 'INSERT':
│     │   リモートDBから該当レコードをSELECT
│     │   ローカルDBにINSERT（UNIQUE違反時はUPSERT）
│     ├─ operation = 'UPDATE':
│     │   リモートDBから該当レコードをSELECT
│     │   ローカルのupdatedAtと比較（LWW: Last-Write-Wins）
│     │   リモートが新しければローカルをUPDATE
│     └─ operation = 'DELETE':
│        ローカルDBから該当レコードをDELETE
│        （存在しなければスキップ）
├─ 4. lastSeenId を更新（クライアントごとに永続化）
└─ 5. 古い _changelog エントリを掃除
```

#### sync状態の永続化

```sql
-- ローカルDB内に作成
CREATE TABLE IF NOT EXISTS _sync_state (
  remoteClientId TEXT    PRIMARY KEY,
  lastSeenId     INTEGER NOT NULL DEFAULT 0,
  lastSyncedAt   TEXT
);
```

#### _changelog の掃除

```sql
-- デフォルト: 7日以上前のエントリを削除
DELETE FROM _changelog WHERE changedAt < datetime('now', '-{retentionDays} days')
```

掃除済みで lastSeenId が見つからない場合のフォールバック:
- updatedAt ベースのフルテーブルスキャンで完全sync
- 各テーブル: `SELECT * FROM {table} WHERE updatedAt > :lastSyncedAt`
- _changelog の operation = 'DELETE' に相当する情報がないため、削除は検知不可
  → 次回以降の _changelog で追跡される

## 公開API設計

```typescript
export interface SyncConfig {
  /** ローカルSQLite DBのパス */
  dbPath: string
  /** NAS上の共有ディレクトリパス */
  nasPath: string
  /** このクライアントの一意識別子（UUID推奨） */
  clientId: string
  /** sync対象テーブル名の配列 */
  tables: string[]
  /** PKカラム名（デフォルト: 'id'） */
  primaryKey?: string
  /** sync間隔（ミリ秒、デフォルト: 30000） */
  intervalMs?: number
  /** _changelog保持期間（日数、デフォルト: 7） */
  changelogRetentionDays?: number
}

export interface SyncInstance {
  /** 手動でsyncを即時実行 */
  syncNow(): Promise<SyncResult>
  /** 定期syncを開始 */
  start(): void
  /** 定期syncを停止 */
  stop(): void
  /** sync状態を取得 */
  getStatus(): SyncStatus
  /** イベントリスナー登録 */
  on(event: SyncEvent, callback: SyncEventCallback): void
}

export interface SyncResult {
  /** syncしたクライアント数 */
  clientsSynced: number
  /** 挿入したレコード数 */
  inserted: number
  /** 更新したレコード数 */
  updated: number
  /** 削除したレコード数 */
  deleted: number
  /** スキップしたレコード数（LWWでローカルが新しかった） */
  skipped: number
  /** UNIQUE競合で解決したレコード数 */
  conflictsResolved: number
  /** エラー（致命的でないもの） */
  warnings: string[]
}

export type SyncStatus = {
  /** 現在syncが実行中か */
  isSyncing: boolean
  /** 最後のsync完了時刻 */
  lastSyncedAt: Date | null
  /** 最後のsync結果 */
  lastResult: SyncResult | null
  /** 定期syncが有効か */
  isRunning: boolean
}

export type SyncEvent =
  | 'sync:start'
  | 'sync:complete'
  | 'sync:error'
  | 'sync:conflict'

/** メインのエントリーポイント */
export function setupSync(config: SyncConfig): SyncInstance
```

## 技術要件

### 依存関係

- **better-sqlite3**: SQLiteアクセス（同期API、読み取り専用オープン対応）
- Node.js の fs モジュール: ファイルコピー、ディレクトリ列挙

### ORM非依存

- Prisma、TypeORM、Drizzle等に依存しない
- SQLiteレベルで直接操作（better-sqlite3 の raw SQL）
- アプリ側はどのORMを使っていても動作する

### NASファイル操作

- DBコピーはアトミックに行う: 一時ファイルに書き込み → rename
- リモートDBは `PRAGMA query_only = ON` で読み取り専用オープン
- ファイルオープン失敗（NAS切断等）はスキップして次のクライアントへ
- 全クライアント失敗してもローカルDBには影響しない

### 競合解決

- **LWW（Last-Write-Wins）**: updatedAt が新しい方を採用
- **UNIQUE違反**: INSERT失敗時にUPSERTにフォールバック
  - 同一自然キー（例: studentNumber）を持つ別UUIDのレコード → 既存レコードを更新
- **DELETE競合**: リモートで削除されたレコードがローカルに存在 → ローカルも削除

### エラーハンドリング

- 個別クライアントのsync失敗は他クライアントに影響しない
- NAS接続不可時: 警告を出してスキップ（ローカルDBは正常動作を継続）
- DBファイル破損: SQLite整合性チェック（`PRAGMA integrity_check`）でスキップ

## テスト戦略

### ユニットテスト

- _changelog テーブル・トリガーの作成と動作
- INSERT / UPDATE / DELETE 時の _changelog 記録
- Cascade削除時の _changelog 記録
- LWW競合解決ロジック
- UNIQUE違反時の競合解決ロジック
- _changelog 掃除とフォールバック

### 統合テスト

- 2クライアント間の双方向sync
- 40クライアントシミュレーション
- NAS切断時のエラーハンドリング
- 長期間未syncクライアントのフォールバック

### テスト環境

- テスト用に一時ディレクトリをNASの代わりに使用
- better-sqlite3 でインメモリDBまたは一時ファイルDB

## ディレクトリ構成案

```
sqlite-nas-sync/
├── src/
│   ├── index.ts              # 公開API（setupSync）
│   ├── validator.ts          # バリデーション（DB構造チェック）
│   ├── setup.ts              # セットアップ（テーブル・トリガー作成）
│   ├── sync.ts               # Syncコアロジック
│   ├── changelog.ts          # _changelog 操作（読み取り・掃除）
│   ├── conflict.ts           # 競合解決（LWW、UNIQUE違反）
│   ├── nas.ts                # NASファイル操作（コピー、列挙、読み取り）
│   └── types.ts              # 型定義
├── __tests__/
│   ├── validator.test.ts
│   ├── setup.test.ts
│   ├── sync.test.ts
│   ├── changelog.test.ts
│   ├── conflict.test.ts
│   └── integration.test.ts   # 統合テスト（複数クライアント）
├── package.json
├── tsconfig.json
├── vitest.config.ts
└── README.md
```

## 実装上の注意点

### _changelog の肥大化防止

- 同一レコードの連続UPDATE: _changelog には全て記録される（圧縮しない）
  - sync時に同一recordIdの最新operationだけ処理すれば効率的
  - 掃除（retentionDays）で古いエントリは自動削除

### トリガー数

- 対象テーブル数 × 3（INSERT/UPDATE/DELETE）
- 22テーブルなら66トリガー
- SQLiteのトリガーは軽量なのでパフォーマンス影響は軽微

### NASへのDBコピー時の整合性

- SQLiteの `.backup()` API または ファイルコピー（WALチェックポイント後）を使用
- better-sqlite3 の `backup()` メソッドが利用可能

### 定期sync中の書き込み

- syncはローカルDBへの書き込みを伴う（リモートの変更を反映）
- アプリ側の書き込みと競合する可能性
- SQLiteのWALモードなら読み書き並行可能
- sync処理はトランザクション内で実行し、アトミック性を保証

## 想定利用規模

- クライアント数: ~40名同時
- DB サイズ: 数MB〜数十MB
- sync間隔: 30秒（ユーザー設定可能）
- NAS: 一般的な学校/オフィスNAS（1Gbps LAN）
