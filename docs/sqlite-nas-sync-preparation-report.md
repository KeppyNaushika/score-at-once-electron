# sqlite-nas-sync 導入準備：現状調査報告書

## 現在のバージョン

**v0.4.10-alpha.0** → minor更新で **v0.5.0** 想定

---

## 概要

NASに弱いSQLiteで分散型協調採点を実現するため、sqlite-nas-sync ライブラリを新規開発し、本プロジェクトに導入する。

**基本アーキテクチャ:**

```
Client A: ローカルDB書き込み → NASにコピー (client_a.db)
Client B: ローカルDB書き込み → NASにコピー (client_b.db)

Sync時: Client AがNAS上のclient_b.dbを読み取り専用で開く → ローカルDBに反映
         Client BがNAS上のclient_a.dbを読み取り専用で開く → ローカルDBに反映
```

---

## sqlite-nas-sync の役割

sqlite-nas-sync は独立したnpmパッケージとして開発し、他プロジェクトでも流用可能にする。
アプリ側のコード変更は原則不要。

### 1. 条件チェック（バリデーション）

sync可能なDBかを検証する:

- 全対象テーブルのPKが UUID か
- 全対象テーブルに `updatedAt` カラムがあるか（更新検知に必須）
- tombstoneテーブル・トリガーが既に存在するか

### 2. トリガー作成（セットアップ）

SQLiteのトリガーを利用し、アプリのコード変更なしに削除を追跡する:

- `_tombstone` テーブルの作成
- 各対象テーブルに `AFTER DELETE` トリガーを作成
- 冪等（何回実行しても安全）

```sql
-- sqlite-nas-sync が自動生成するトリガーの例
CREATE TRIGGER IF NOT EXISTS _tombstone_after_delete_Project
AFTER DELETE ON Project
FOR EACH ROW
BEGIN
  INSERT INTO _tombstone (tableName, recordId, deletedAt)
  VALUES ('Project', OLD.id, datetime('now'));
END;
```

**重要**: SQLiteのトリガーは `onDelete: Cascade` による連鎖削除でも発火する。
Projectを物理削除すればCascadeで子レコードも削除され、各テーブルのトリガーが自動でtombstoneを記録する。

### 3. Sync発火（コア機能）

```
sync()
├─ ローカルDBをNASにコピー
├─ NAS上の他クライアントDBを列挙
├─ 各リモートDBを読み取り専用で開く
│  ├─ 新規レコード検知（UUIDがローカルに無い）→ INSERT
│  ├─ 更新レコード検知（updatedAt比較）→ UPDATE (Last-Write-Wins)
│  └─ 削除レコード検知（_tombstone読み取り）→ DELETE
├─ UNIQUE制約違反時の競合解決
└─ 古いtombstoneの掃除
```

### アプリ側の初期化イメージ

```typescript
import { setupSync } from 'sqlite-nas-sync'

setupSync({
  dbPath: './data/database.db',
  nasPath: '//nas/shared/score-at-once/',
  tables: ['Project', 'Student', 'Class', ...],
  primaryKey: 'id',
})
```

---

## 本プロジェクトの準備状況

### 1. PK：UUID化の現状

**結論：全テーブル対応済み。追加作業不要。**

全22モデルで既に `@id @default(uuid())` を使用している。

| モデル | PK定義 |
|--------|--------|
| User | `id String @id @default(uuid())` |
| Class | `id String @id @default(uuid())` |
| Student | `id String @id @default(uuid())` |
| Project | `id String @id @default(uuid())` |
| ProjectStudent | 同上 |
| ProjectPage | 同上 |
| MasterImage | 同上 |
| StudentAnswerImage | 同上 |
| CropRegion | 同上 |
| SubtotalGroup | 同上 |
| Subtotal | 同上 |
| CropSubtotal | 同上 |
| UserProject | 同上 |
| ProjectSubtotalGroup | 同上 |
| QuestionScore | 同上 |
| DrawingAnnotation | 同上 |
| ProjectClass | 同上 |
| Subject | 同上 |
| SubjectSubtotalGroup | 同上 |
| UserKeyboardShortcut | 同上 |
| UserScoringPreference | 同上 |
| ProjectMarkingFormat | 同上 |
| ProjectExportSettings | 同上 |
| CropRegionMarkingOverride | 同上 |
| StudentClassMembership | 同上 |

### 2. 削除追跡：Tombstoneテーブル方式

**結論：アプリ側のスキーマ変更・コード変更は不要。sqlite-nas-syncが全て管理する。**

#### 従来案（各モデルに deletedAt 追加）の問題

- 全22テーブルにカラム追加
- 48箇所の delete → update 書き換え
- 28箇所の onDelete: Cascade → 手動論理削除チェーンに変更
- 全クエリに `where: { deletedAt: null }` フィルタ追加

#### 採用方式（SQLiteトリガー + Tombstoneテーブル）

- アプリの既存コードは **一切変更不要**
- 物理削除も `onDelete: Cascade` もそのまま維持
- sqlite-nas-sync がSQLiteレベルでトリガーを作成し、削除を自動追跡
- Cascade削除でもトリガーが発火するため、全ての削除が記録される

```
アプリ側:  prisma.project.delete({ where: { id } })
                    │
          (いつも通りPrismaで削除するだけ)
                    │
SQLite側:  onDelete: Cascade → 子レコード連鎖削除
                    │
トリガー:  各テーブルの AFTER DELETE トリガーが自動発火
                    │
結果:     _tombstone テーブルに Project + 全子レコードが記録
```

### 3. UNIQUE制約：現状分析

**結論：UNIQUE制約は維持。sync時の競合解決はsqlite-nas-syncが担当する。**

#### 全UNIQUE制約の一覧（14個）

| # | モデル | 制約 | 使用箇所数 | sync衝突リスク |
|---|--------|------|----------|--------------|
| 1 | User.username | `@unique` | 3 | **高** - 別クライアントで同名ユーザー作成 |
| 2 | Class.name | `@unique` | 4 | **高** - 別クライアントで同名学級作成 |
| 3 | Student.studentNumber | `@unique` | 5 | **高** - 同一生徒を別クライアントで登録 |
| 4 | Subject.name | `@unique` | 2 | **中** - 同名教科の重複 |
| 5 | UserScoringPreference.userId | `@unique` | 3 | **低** - 1:1リレーション |
| 6 | ProjectExportSettings.projectId | `@unique` | 2 | **低** - 1:1リレーション |
| 7 | ProjectStudent @@unique([projectId, studentId]) | 複合 | 1 | **中** |
| 8 | UserProject @@unique([userId, projectId]) | 複合 | 5 | **低** |
| 9 | ProjectClass @@unique([projectId, classId]) | 複合 | 3 | **中** |
| 10 | Subtotal @@unique([subtotalGroupId, name]) | 複合 | 1 | **中** |
| 11 | UserKeyboardShortcut @@unique([userId, action]) | 複合 | 2 | **低** |
| 12 | ProjectMarkingFormat @@unique([projectId, markType]) | 複合 | 3 | **低** |
| 13 | SubjectSubtotalGroup @@unique([subjectId, subtotalGroupId]) | 複合 | 1 | **低** |
| 14 | CropRegionMarkingOverride @@unique([cropRegionId, markType]) | 複合 | 3 | **低** |

#### UNIQUE制約の分類

**カテゴリA：ビジネスキー（自然キー）**

| 制約 | sync衝突時の意味 |
|------|----------------|
| User.username | 同じ人物が別クライアントで登録 → 同一レコードとみなすべき |
| Student.studentNumber | 同上 |
| Class.name | 同上 |
| Subject.name | 同上 |

→ sync時にUNIQUE違反が発生した場合、同一エンティティとみなしてマージ（UPSERTまたはLWW）。

**カテゴリB：1:1リレーション保証**

| 制約 | 理由 |
|------|------|
| UserScoringPreference.userId | 1ユーザー1設定 |
| ProjectExportSettings.projectId | 1プロジェクト1設定 |

→ 親レコードのsyncに連動。LWWで上書き。

**カテゴリC：多対多の重複防止**

| 制約 | sync衝突シナリオ |
|------|----------------|
| ProjectStudent(projectId, studentId) | クライアントA・Bが同時に同じ生徒を追加 |
| UserProject(userId, projectId) | 同時参加 |
| ProjectClass(projectId, classId) | 同時追加 |
| Subtotal(subtotalGroupId, name) | 同名小計の同時作成 |
| UserKeyboardShortcut(userId, action) | 設定の同時変更 |
| ProjectMarkingFormat(projectId, markType) | 設定の同時変更 |
| SubjectSubtotalGroup(subjectId, subtotalGroupId) | 同時追加 |
| CropRegionMarkingOverride(cropRegionId, markType) | 設定の同時変更 |

→ sync時にUNIQUE違反が発生した場合、UPSERT（既存レコードを更新）で解決。

#### UNIQUE制約に依存する主要コード（参考）

**upsert操作（16箇所）**

| ファイル | 使用するUNIQUE制約 |
|---------|-------------------|
| `databaseSetup.ts:73` | User.username |
| `databaseSetup.ts:85` | Class.name |
| `databaseSetup.ts:126` | Student.studentNumber |
| `userSettings.ts:39,58` | UserKeyboardShortcut(userId, action) |
| `userSettings.ts:145,207` | UserScoringPreference.userId |
| `projectSettings.ts:40,62` | ProjectMarkingFormat(projectId, markType) |
| `projectSettings.ts:111` | ProjectExportSettings.projectId |
| `projectClass.ts:355` | ProjectClass(projectId, classId) |
| `cropRegionMarkingOverride.ts:49,76` | CropRegionMarkingOverride(cropRegionId, markType) |
| `dataCreator.ts:156` | Subject.name |

**findUnique操作（20箇所）**

| ファイル | 使用するUNIQUE制約 |
|---------|-------------------|
| `auth.ts:50,99,150` | User.username |
| `uniqueNameGenerators.ts:29,42` | Student.studentNumber |
| `uniqueNameGenerators.ts:65,77` | Class.name |
| `subject.ts:77` | Subject.name |
| `userSettings.ts:131,184` | UserScoringPreference.userId |
| `projectSettings.ts:29` | ProjectMarkingFormat(projectId, markType) |
| `projectSettings.ts:95` | ProjectExportSettings.projectId |
| `userProject.ts:60,147,191,236` | UserProject(userId, projectId) |
| `cropRegionMarkingOverride.ts:35` | CropRegionMarkingOverride(cropRegionId, markType) |
| `dataCreator.ts:183` | SubjectSubtotalGroup(subjectId, subtotalGroupId) |

### 4. テーブル構造：sync観点での評価

**結論：現在のスキーマはsync観点でのテーブル分割は不要。**

LWW（Last-Write-Wins）方式では、行単位で上書きされるため、「別の人が同じ行の別カラムを独立に変更する」ケースが問題になる。

現在のスキーマを検証した結果:

| テーブル | 判定 | 理由 |
|---------|------|------|
| QuestionScore (status + partialScore) | **OK** | 採点行為は一体。部分点→正答上書きは意図通り |
| Student (名前 + 学籍番号) | **OK** | 生徒マスタは一人の管理者が編集 |
| CropRegion (座標 + 配点 + ラベル) | **OK** | テンプレート定義は一体で変更 |
| DrawingAnnotation (各種属性) | **OK** | 1アノテーション = 1変更単位 |
| ProjectStudent (status + customOrder) | **OK** | 受験生徒一覧画面で同じ管理者が一体で操作 |
| UserScoringPreference (各種設定) | **OK** | 各ユーザーが自分の設定のみ変更 |
| UserKeyboardShortcut (action + key) | **OK** | 各ユーザーが自分の設定のみ変更 |
| ProjectMarkingFormat (各種設定) | **OK** | プロジェクト設定として一体管理 |

---

## データ損失リスクの分析

### リスクなし（sqlite-nas-sync で安全に処理可能）

| シナリオ | 処理 |
|---------|------|
| 別々のレコードを同時編集 | 両方反映される |
| 同じエンティティを別クライアントで作成（UUID異なる、自然キー同一） | UNIQUE制約でsync層が検知 → マージ |
| 片方だけが削除、もう片方は無関係な作業 | tombstoneでsync |
| NASコピー中のクラッシュ/ネットワーク断 | リモートDBは読み取り専用なのでローカルに影響なし。次回リトライ |

### 許容可能なリスク（LWW の特性）

| シナリオ | 結果 | 許容理由 |
|---------|------|---------|
| 同じ行を同時に更新（updatedAt比較） | 後の更新で上書き | 現在のスキーマでは同じ行を独立に変更するケースがない |

### アプリ層の問題（sqlite-nas-sync の責務外）

| シナリオ | 結果 | 備考 |
|---------|------|------|
| Delete-Update 競合（削除と更新の同時発生） | 削除側が勝つ | ローカル操作でも同じ問題。アプリのUI/UXで対処すべき |

---

## 物理削除の全箇所一覧（参考）

### A. スキーマの `onDelete: Cascade` 設定（28箇所）

**※ sqlite-nas-sync のトリガーがCascade削除も自動追跡するため、変更不要**

| 親モデル | 子モデル | リレーション |
|---------|---------|-----------|
| Student | StudentClassMembership | studentId → id |
| Class | StudentClassMembership | classId → id |
| Project | ProjectStudent | projectId → id |
| Student | ProjectStudent | studentId → id |
| Project | ProjectPage | projectId → id |
| ProjectPage | MasterImage | projectPageId → id |
| ProjectPage | StudentAnswerImage | projectPageId → id |
| Student | StudentAnswerImage | studentId → id |
| ProjectPage | CropRegion | projectPageId → id |
| SubtotalGroup | Subtotal | subtotalGroupId → id |
| CropRegion | CropSubtotal | cropRegionId → id |
| Subtotal | CropSubtotal | subtotalId → id |
| User | UserProject | userId → id |
| Project | UserProject | projectId → id |
| Project | ProjectSubtotalGroup | projectId → id |
| SubtotalGroup | ProjectSubtotalGroup | subtotalGroupId → id |
| CropRegion | QuestionScore | cropRegionId → id |
| Student | QuestionScore | studentId → id |
| QuestionScore | DrawingAnnotation | questionScoreId → id |
| Project | ProjectClass | projectId → id |
| Class | ProjectClass | classId → id |
| Subject | SubjectSubtotalGroup | subjectId → id |
| SubtotalGroup | SubjectSubtotalGroup | subtotalGroupId → id |
| User | UserKeyboardShortcut | userId → id |
| User | UserScoringPreference | userId → id |
| Project | ProjectMarkingFormat | projectId → id |
| Project | ProjectExportSettings | projectId → id |
| CropRegion | CropRegionMarkingOverride | cropRegionId → id |

### B. 明示的な delete / deleteMany 呼び出し（48箇所）

**※ sqlite-nas-sync のトリガーが自動追跡するため、変更不要**

| ファイル | モデル | 削除の文脈 |
|---------|--------|----------|
| `electron-src/lib/prisma/subtotal.ts:37` | Subtotal | 小計項目を単一削除 |
| `electron-src/lib/prisma/userSettings.ts:78` | UserKeyboardShortcut | ショートカット一括削除（1アクション） |
| `electron-src/lib/prisma/userSettings.ts:88` | UserKeyboardShortcut | ショートカット一括削除（1ユーザー） |
| `electron-src/lib/prisma/subjectSubtotalGroup.ts:46` | SubjectSubtotalGroup | 関連付けを単一削除 |
| `electron-src/lib/prisma/subjectSubtotalGroup.ts:57` | SubjectSubtotalGroup | 関連付けを一括削除（教科削除時） |
| `electron-src/lib/prisma/questionGroupItem.ts:37` | Subtotal | 設問グループアイテムを削除 |
| `electron-src/lib/prisma/cropRegionMarkingOverride.ts:104` | CropRegionMarkingOverride | マーク上書き設定を一括削除（領域削除時） |
| `electron-src/lib/prisma/cropRegionMarkingOverride.ts:113` | CropRegionMarkingOverride | マーク上書き設定を一括削除（複数領域） |
| `electron-src/lib/prisma/subject.ts:68` | Subject | 教科を単一削除 |
| `electron-src/lib/prisma/subtotalDefinition.ts:29` | Subtotal | 小計定義を削除 |
| `electron-src/lib/prisma/drawingAnnotation.ts:347` | DrawingAnnotation | アノテーションを単一削除 |
| `electron-src/lib/prisma/drawingAnnotation.ts:367` | DrawingAnnotation | アノテーションを一括削除 |
| `electron-src/lib/prisma/subtotalGroup.ts:98` | Subtotal | 既存小計を全削除（再作成） |
| `electron-src/lib/prisma/subtotalGroup.ts:204` | ProjectSubtotalGroup | プロジェクト関連付けを削除 |
| `electron-src/lib/prisma/subtotalGroup.ts:209` | SubtotalGroup | 小計グループを削除 |
| `electron-src/lib/prisma/subtotalGroup.ts:386` | ProjectSubtotalGroup | プロジェクト関連付けを削除 |
| `electron-src/lib/prisma/studentClassMembership.ts:79` | StudentClassMembership | メンバーシップを単一削除 |
| `electron-src/lib/prisma/studentAnswer/placement.ts:36` | StudentAnswerImage | 答案画像を単一削除 |
| `electron-src/lib/prisma/student.ts:109` | Student | 生徒を削除 |
| `electron-src/lib/prisma/student.ts:204` | Class | 学級を削除 |
| `electron-src/lib/prisma/projectSettings.ts:85` | ProjectMarkingFormat | 採点マーク形式を一括削除 |
| `electron-src/lib/prisma/projectSettings.ts:119` | ProjectExportSettings | 出力設定を一括削除 |
| `electron-src/lib/prisma/studentAnswer/crud.ts:168` | StudentAnswerImage | 答案画像を単一削除 |
| `electron-src/lib/prisma/class.ts:103` | Class | 学級を削除 |
| `electron-src/lib/prisma/masterAnswer.ts:128` | MasterImage | 模範解答画像を削除 |
| `electron-src/lib/prisma/masterAnswer.ts:140` | ProjectPage | プロジェクトページを削除 |
| `electron-src/lib/prisma/masterAnswer.ts:381` | MasterImage | 模範解答画像を一括削除 |
| `electron-src/lib/prisma/masterAnswer.ts:397` | ProjectPage | 空ページを一括削除 |
| `electron-src/lib/prisma/questionScore.ts:276` | QuestionScore | 採点を単一削除 |
| `electron-src/lib/prisma/projectClass.ts:247` | ProjectClass | プロジェクト学級を削除 |
| `electron-src/lib/prisma/projectClass.ts:264` | ProjectClass | プロジェクト学級を削除（複数） |
| `electron-src/lib/prisma/projectStudent.ts:117` | ProjectStudent | プロジェクト生徒を一括削除 |
| `electron-src/lib/prisma/projectStudent.ts:125` | StudentAnswerImage | 答案画像を一括削除 |
| `electron-src/lib/prisma/project.ts:189` | Project | プロジェクト全体を削除 |
| `electron-src/lib/prisma/questionGroup.ts:35` | SubtotalGroup | 設問グループを削除 |
| `electron-src/lib/prisma/cropRegion.ts:86` | CropRegion | 採点領域を削除 |
| `electron-src/lib/prisma/questionSubtotalAssignment.ts:29` | CropSubtotal | 設問小計を単一削除 |
| `electron-src/lib/prisma/questionSubtotalAssignment.ts:38` | CropSubtotal | 設問小計を一括削除（複数） |
| `electron-src/lib/prisma/questionSubtotalAssignment.ts:47` | CropSubtotal | 設問小計を一括削除（すべて） |
| `electron-src/lib/prisma/projectPage.ts:47` | ProjectPage | プロジェクトページを単一削除 |
| `electron-src/lib/prisma/cropSubtotal.ts:134` | CropSubtotal | 採点領域小計を単一削除 |
| `electron-src/lib/prisma/cropSubtotal.ts:143` | CropSubtotal | 採点領域小計を一括削除 |
| `electron-src/lib/prisma/userProject.ts:205` | UserProject | ユーザープロジェクトを削除 |
| `electron-src/lib/prisma/gradingData.ts:100` | QuestionScore | 採点結果を一括削除 |
| `electron-src/lib/prisma/gradingData.ts:112` | StudentAnswerImage | 答案画像を一括削除 |
| `electron-src/lib/prisma/questionScore.ts:347` | QuestionScore | 採点を一括削除 |
| `electron-src/lib/prisma/studentAnswer/batch.ts:69` | QuestionScore | 採点結果を一括削除 |
| `electron-src/lib/prisma/studentAnswer/batch.ts:84` | StudentAnswerImage | 答案画像を一括削除 |

### C. Cascade削除の連鎖影響（Project削除時）

```
Project (DELETE)
├─ ProjectPage (Cascade)
│  ├─ MasterImage (Cascade)              ← トリガーで tombstone 記録
│  ├─ StudentAnswerImage (Cascade)       ← トリガーで tombstone 記録
│  └─ CropRegion (Cascade)              ← トリガーで tombstone 記録
│     ├─ CropSubtotal (Cascade)          ← トリガーで tombstone 記録
│     ├─ QuestionScore (Cascade)         ← トリガーで tombstone 記録
│     │  └─ DrawingAnnotation (Cascade)  ← トリガーで tombstone 記録
│     └─ CropRegionMarkingOverride       ← トリガーで tombstone 記録
├─ ProjectStudent (Cascade)              ← トリガーで tombstone 記録
├─ ProjectSubtotalGroup (Cascade)        ← トリガーで tombstone 記録
├─ UserProject (Cascade)                 ← トリガーで tombstone 記録
├─ ProjectClass (Cascade)                ← トリガーで tombstone 記録
├─ ProjectMarkingFormat (Cascade)        ← トリガーで tombstone 記録
└─ ProjectExportSettings (Cascade)       ← トリガーで tombstone 記録
```

---

## Import/Export機能への影響

### エクスポート対象モデル

**必須データ**: Project, ProjectPage, CropRegion, Student, Class, StudentClassMembership, User, SubtotalGroup, Subtotal

**v1.2.0+**: MasterImage, StudentAnswerImage

**v1.4.0+**: ProjectMarkingFormat, ProjectExportSettings, CropRegionMarkingOverride, Subject, SubjectSubtotalGroup, ProjectClass

**採点データ**: QuestionScore, DrawingAnnotation（ログインユーザーのみ）

### sqlite-nas-sync 導入による影響

Tombstoneテーブル方式を採用したため、Import/Export機能への影響はない。

- エクスポート: 変更不要（_tombstoneテーブルはエクスポート対象外）
- インポート: 変更不要（既存のIDリマッピング・temp-value方式がそのまま機能）

### 既知バグ（B1-B11）との関係

sqlite-nas-sync の導入は既知バグに影響しない。バグ修正は独立して進められる。

---

## 結論：本プロジェクト側で必要な作業

| 項目 | 作業内容 | 工数 |
|------|---------|------|
| PK (UUID) | **不要** - 全テーブル対応済み | - |
| 論理削除 (deletedAt) | **不要** - Tombstoneテーブル方式を採用 | - |
| UNIQUE制約 | **不要** - 維持。sync層で競合解決 | - |
| テーブル分割 | **不要** - 現在のスキーマはsync適合 | - |
| Cascade設定 | **不要** - 維持。トリガーが自動追跡 | - |
| Import/Export | **不要** - 影響なし | - |
| sqlite-nas-sync 初期化コード | **必要** - setupSync() 呼び出しの追加 | 小 |
| sync UIの実装 | **必要** - sync状態表示・手動sync発火ボタン等 | 中 |
| バージョン更新 | **必要** - v0.4.10 → v0.5.0 | 小 |

**本プロジェクトのスキーマ変更・既存コード変更は不要。**
主な作業は sqlite-nas-sync ライブラリの開発と、本プロジェクトへの統合（初期化 + UI）のみ。

---

## Sync設計

### 方式: 変更ログ（_changelog）+ 定期sync

#### 変更ログテーブル

tombstone（DELETE追跡のみ）を拡張し、INSERT / UPDATE / DELETE の全操作を記録する `_changelog` テーブルを使用する。これにより tombstone テーブルは不要になり、_changelog に統合される。

```sql
-- sqlite-nas-sync が自動作成
CREATE TABLE IF NOT EXISTS _changelog (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  tableName TEXT    NOT NULL,
  recordId  TEXT    NOT NULL,
  operation TEXT    NOT NULL,  -- 'INSERT' | 'UPDATE' | 'DELETE'
  changedAt TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_changelog_id ON _changelog(id);
```

#### トリガー（テーブルごとに3つ）

```sql
-- INSERT追跡
CREATE TRIGGER IF NOT EXISTS _changelog_after_insert_Student
AFTER INSERT ON Student FOR EACH ROW
BEGIN
  INSERT INTO _changelog (tableName, recordId, operation)
  VALUES ('Student', NEW.id, 'INSERT');
END;

-- UPDATE追跡
CREATE TRIGGER IF NOT EXISTS _changelog_after_update_Student
AFTER UPDATE ON Student FOR EACH ROW
BEGIN
  INSERT INTO _changelog (tableName, recordId, operation)
  VALUES ('Student', NEW.id, 'UPDATE');
END;

-- DELETE追跡（Cascade削除でも発火）
CREATE TRIGGER IF NOT EXISTS _changelog_after_delete_Student
AFTER DELETE ON Student FOR EACH ROW
BEGIN
  INSERT INTO _changelog (tableName, recordId, operation)
  VALUES ('Student', OLD.id, 'DELETE');
END;
```

#### 方式選定の根拠

| 方式 | 40名規模での評価 |
|------|----------------|
| タイムスタンプ方式（updatedAt比較） | 変更なしでも全テーブルスキャン必要。40クライアント×22テーブル=880クエリ/sync |
| **変更ログ方式（_changelog）** | **変更なしなら1クエリで終了。40クライアント×1テーブル=40クエリ/sync** |
| 差分ファイル方式 | DBが数MB程度なら過剰。実装複雑度に見合わない |

#### sync時の動作

```
sync()
├─ 1. ローカルDBをNASにコピー（フルDB、_changelog含む）
├─ 2. NAS上の他クライアントDBを列挙
├─ 3. 各リモートDB（39個）を読み取り専用で開く
│     ├─ SELECT * FROM _changelog WHERE id > lastSeenId
│     │  → 変更なし: 0件 → このクライアントは終了（1クエリで済む）
│     │  → 変更あり: M件の変更レコードIDとテーブル名を取得
│     └─ 変更ありの場合のみ:
│        ├─ operation = 'INSERT' or 'UPDATE':
│        │   → 該当レコードを同じDB内から SELECT して取得
│        │   → ローカルDBに INSERT or UPDATE (LWW: updatedAt比較)
│        └─ operation = 'DELETE':
│           → ローカルDBから該当レコードを DELETE
├─ 4. UNIQUE制約違反時の競合解決（UPSERT or マージ）
├─ 5. lastSeenId を更新（クライアントごとに記録）
└─ 6. 古い _changelog の掃除
```

### Sync間隔

**定期sync（デフォルト30秒間隔、ユーザー設定可能）**

書き込み時syncは不採用:
- 採点中は秒単位でQuestionScoreがINSERT/UPDATEされる
- 40人が毎書き込みでNASコピーすると帯域を圧迫
- 一括処理（バッチ操作）との相性も悪い

40名同時使用時のI/O見積もり（30秒間隔）:

```
NAS書き込み: 40回/30秒 = 1.3回/秒（DB 5MBとして 6.5MB/s）
NAS読み取り: 40クライアント × 39ファイルオープン / 30秒
            = 52ファイルオープン/秒
            _changelogクエリは軽量（ほとんど0件）
```

一般的な学校NAS（1Gbps）で十分処理可能。

### _changelog の掃除

時間ベースの自動掃除を採用:

```sql
DELETE FROM _changelog WHERE changedAt < datetime('now', '-7 days')
```

7日以上syncしていないクライアントが復帰した場合:
- _changelog に lastSeenId 以降のエントリがある → changelog方式（高速）
- _changelog が掃除済みで lastSeenId が無い → updatedAt方式にフォールバック（遅いが確実）

changelogはあくまで高速化のための最適化。なくても updatedAt で完全syncできる。

### アプリ側の初期化イメージ（更新）

```typescript
import { setupSync } from 'sqlite-nas-sync'

const sync = setupSync({
  dbPath: './data/database.db',
  nasPath: '//nas/shared/score-at-once/',
  clientId: 'client-uuid',
  tables: ['Project', 'Student', 'Class', ...],
  primaryKey: 'id',
  intervalMs: 30000,             // デフォルト30秒、ユーザー設定可能
  changelogRetentionDays: 7,     // _changelog保持期間
})

// 手動sync
await sync.syncNow()

// sync停止
sync.stop()
```
