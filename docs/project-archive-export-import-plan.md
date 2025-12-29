# プロジェクトインポート機能 実装計画

**作成日**: 2025-12-28
**ステータス**: 計画段階

## 概要

プロジェクト単位で採点データを書き出し・移動・読み込みする機能。
マシン間移行を主なユースケースとし、柔軟なマージ機能を提供。

## 設計方針

**全APIを先に設計してから実装する**アプローチを採用。
これにより、全体の整合性を確保し、後からの手戻りを防ぐ。

---

## Phase 1: エクスポート機能

### 1.1 エクスポート形式

```
project-export-[projectId]-[timestamp].zip
├── manifest.json           # バージョン、エクスポート日時、元DB情報
├── project.json            # Project, ProjectPage, CropRegion等
├── students.json           # 関連Student
├── classes.json            # Class, StudentClassMembership
├── users.json              # 関連User（採点者）
├── subtotals.json          # SubtotalGroup, Subtotal, CropSubtotal
├── scores.json             # QuestionScore, DrawingAnnotation
├── master-images/          # 模範解答画像
└── answer-sheets/          # 答案画像
```

### 1.2 実装ファイル

| ファイル | 責任 |
|---------|------|
| `electron-src/lib/export/project-archive/data-collector.ts` | 全関連データ収集 |
| `electron-src/lib/export/project-archive/json-serializer.ts` | JSON生成 |
| `electron-src/lib/export/project-archive/archive-creator.ts` | ZIP圧縮 |
| `electron-src/lib/export/project-archive/index.ts` | 統合エクスポート |
| `electron-src/ipc-handlers/archive-handlers.ts` | IPC通信 |

### 1.3 IPC API

```typescript
// エクスポート
ipcMain.handle("archive:exportProject", async (event, { projectId }) => {
  // 戻り値: { success, outputPath?, error? }
})
```

### 1.4 UI

- プロジェクト詳細画面に「エクスポート」ボタン追加
- 保存先選択ダイアログ
- プログレス表示（ExportProgressModalパターン流用）

---

## Phase 2: インポート機能（新規作成モード）

### 2.1 処理フロー

1. ZIPファイル選択
2. manifest.json検証
3. 全データを新規UUID生成して作成
4. 画像ファイルを新プロジェクトディレクトリにコピー

### 2.2 実装ファイル

| ファイル | 責任 |
|---------|------|
| `electron-src/lib/import/project-archive/archive-extractor.ts` | ZIP展開 |
| `electron-src/lib/import/project-archive/manifest-validator.ts` | バージョン検証 |
| `electron-src/lib/import/project-archive/id-remapper.ts` | UUID再マッピング |
| `electron-src/lib/import/project-archive/data-creator.ts` | データ作成 |
| `electron-src/lib/import/project-archive/index.ts` | 統合インポート |

### 2.3 IPC API

```typescript
// インポート（新規作成モード）
ipcMain.handle("archive:importProjectAsNew", async (event, { archivePath }) => {
  // 戻り値: { success, projectId?, error? }
})
```

### 2.4 UI

- ダッシュボードに「インポート」ボタン追加
- ファイル選択 → 確認ダイアログ → 実行

---

## Phase 3: プロジェクトインポートウィザード

### 3.1 UIフロー（5ステップ）

```
Step 1: ファイル選択・プレビュー
  └─ ZIPを選択、manifest表示、プロジェクト概要プレビュー

Step 2: インポートモード選択
  ├─ [新規作成] → Phase 2の処理へ
  └─ [統合] → Step 3へ

Step 3: マッチング設定
  ├─ データ種類ごとにマッチング方法を選択
  │   ├─ Student: [UUID] / [学籍番号] / [氏名]
  │   ├─ Class: [UUID] / [名前]
  │   ├─ User: [UUID] / [username]
  │   ├─ Project: [UUID] / [常に新規]
  │   └─ SubtotalGroup: [UUID] / [名前]
  └─ 競合解決ポリシー選択
      ├─ [タイムスタンプ比較] updatedAtが新しい方
      ├─ [インポート優先] 常に上書き
      └─ [既存優先] 既存維持、新規のみ追加

Step 4: 競合プレビュー・個別解決
  ├─ カテゴリ別の競合一覧表示
  │   ├─ Student: 一致25件 / 新規3件 / 競合2件
  │   ├─ QuestionScore: 一致120件 / 新規45件 / 競合8件
  │   └─ ...
  ├─ カテゴリ単位で一括解決（Windows風UI）
  │   ├─ [全てインポートデータで上書き]
  │   ├─ [全て既存を維持]
  │   └─ [個別に確認] → 競合アイテム一覧
  └─ 必要に応じて個別アイテムの解決

Step 5: 実行・完了
  └─ プログレス表示 → 完了サマリー
```

### 3.2 競合解決UI（Windows風）

```
┌─────────────────────────────────────────────────────────────┐
│ プロジェクトインポート                                        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ 📋 QuestionScore: 8件の競合があります                         │
│                                                             │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ ○ 全てインポートデータで置き換える                         │ │
│ │   インポートファイルの採点結果で上書きします                 │ │
│ ├─────────────────────────────────────────────────────────┤ │
│ │ ○ 全て既存データを維持する                                │ │
│ │   現在のデータを保持し、新規データのみ追加します             │ │
│ ├─────────────────────────────────────────────────────────┤ │
│ │ ○ タイムスタンプで自動判定                                │ │
│ │   更新日時が新しい方を採用します                           │ │
│ ├─────────────────────────────────────────────────────────┤ │
│ │ ○ 1件ずつ確認する                                        │ │
│ │   各競合を個別に確認して選択します                         │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ [詳細を表示 ▼]                                               │
│                                                             │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ # | 生徒      | 設問  | 既存     | インポート | 選択      │ │
│ │---|----------|-------|---------|-----------|----------│ │
│ │ 1 | 山田太郎  | 問1   | 5点     | 3点       | ○既存 ○新 │ │
│ │ 2 | 山田太郎  | 問3   | 未採点  | 8点       | ○既存 ○新 │ │
│ │ 3 | 鈴木花子  | 問2   | 4点     | 4点       | (同一)    │ │
│ │ ...                                                     │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│                              [キャンセル]  [次へ]             │
└─────────────────────────────────────────────────────────────┘
```

### 3.3 実装ファイル

| ファイル | 責任 |
|---------|------|
| `electron-src/lib/import/merge/conflict-detector.ts` | 競合検出 |
| `electron-src/lib/import/merge/matcher.ts` | マッチングロジック |
| `electron-src/lib/import/merge/conflict-resolver.ts` | 競合解決 |
| `electron-src/lib/import/merge/data-merger.ts` | データ統合 |
| `components/import/ImportWizardModal.tsx` | ウィザードUI |
| `components/import/steps/FileSelectStep.tsx` | Step 1 |
| `components/import/steps/ModeSelectStep.tsx` | Step 2 |
| `components/import/steps/MatchingConfigStep.tsx` | Step 3 |
| `components/import/steps/ConflictResolveStep.tsx` | Step 4 |
| `components/import/steps/ExecuteStep.tsx` | Step 5 |
| `components/import/ConflictResolutionPanel.tsx` | 競合解決パネル |
| `hooks/import/useImportWizard.ts` | ウィザード状態管理 |

### 3.4 IPC API

```typescript
// アーカイブ解析（プレビュー用）
ipcMain.handle("archive:analyzeArchive", async (event, { archivePath }) => {
  // 戻り値: { success, manifest, summary, error? }
})

// 競合検出（ドライラン）
ipcMain.handle("archive:detectConflicts", async (event, {
  archivePath,
  matchingConfig
}) => {
  // 戻り値: { success, conflicts, matches, newItems, error? }
})

// 統合インポート実行
ipcMain.handle("archive:mergeImport", async (event, {
  archivePath,
  matchingConfig,
  conflictResolutions
}) => {
  // 戻り値: { success, projectId?, summary?, error? }
})
```

---

## バージョン互換性戦略

### 方針

- **後方互換のみ**: 新バージョンは古いデータを読めるが、逆はエラー
- **欠損データ**: デフォルト値で補完

### manifest.json のバージョン管理

```typescript
interface ArchiveManifest {
  version: string              // アーカイブ形式バージョン "1.0.0"
  schemaVersion: string        // Prismaスキーマバージョン（マイグレーション名等）
  appVersion: string           // アプリバージョン "0.2.18"
  // ...
}
```

### インポート時の検証フロー

```
1. manifest.version チェック
   ├─ 現在より新しい → エラー「新しいバージョンのアプリが必要です」
   └─ 現在以下 → 続行

2. schemaVersion チェック
   ├─ 不明なスキーマ → 警告「一部データが欠損している可能性があります」
   └─ 既知のスキーマ → 続行

3. データ検証
   ├─ 必須フィールド欠損 → デフォルト値で補完 + 警告ログ
   ├─ 不明フィールド → 無視（将来の拡張性）
   └─ 型不一致 → 可能なら変換、不可なら警告
```

### スキーマ変更時のマイグレーション

**新フィールド追加時の対応**:
```typescript
// data-creator.ts
function createStudent(importData: unknown): StudentCreateInput {
  const data = importData as Record<string, unknown>
  return {
    id: data.id as string,
    studentId: data.studentId as string,
    lastName: data.lastName as string,
    firstName: data.firstName as string,
    // 新フィールド: 欠損時はデフォルト値
    enrollmentYear: (data.enrollmentYear as number) ?? null,
    // ...
  }
}
```

**フィールド削除時**:
- 古いエクスポートにあるフィールドは単に無視

**型変更時**:
- 可能な限り変換（String→Int等）
- 変換不可なら警告 + デフォルト値

### 互換性テーブル

| アーカイブver | アプリver | 読み込み可否 |
|-------------|----------|------------|
| 1.0.0 | 0.3.0+ | ✓ |
| 1.0.0 | 0.2.x | ✓（同バージョン） |
| 1.1.0 | 0.2.x | ✗ エラー |

---

## 型定義

```typescript
// manifest.json
interface ArchiveManifest {
  version: string           // "1.0.0"
  exportedAt: string        // ISO8601
  sourceDbId?: string       // 元DBの識別子（任意）
  projectId: string
  projectName: string
  exportedBy?: string
  counts: {
    students: number
    pages: number
    regions: number
    scores: number
    images: number
  }
}

// マッチング設定
interface MatchingConfig {
  student: "uuid" | "studentId" | "name"
  class: "uuid" | "name"
  user: "uuid" | "username"
  project: "uuid" | "always_new"
  subtotalGroup: "uuid" | "name"
}

// 競合解決ポリシー
type ConflictPolicy = "import_wins" | "existing_wins" | "timestamp" | "manual"

// 競合情報
interface ConflictItem {
  id: string
  category: "Student" | "QuestionScore" | "DrawingAnnotation" | ...
  importData: Record<string, unknown>
  existingData: Record<string, unknown>
  resolution?: "import" | "existing" | "skip"
}

// 競合解決設定
interface ConflictResolutions {
  [category: string]: {
    policy: ConflictPolicy
    manualResolutions?: Record<string, "import" | "existing">
  }
}
```

---

## 既存パターンの活用

| 機能 | 参照パターン |
|-----|------------|
| データ収集 | `electron-src/lib/export/excel/data-fetcher.ts` |
| ZIP処理 | Node.js `archiver` / `adm-zip` ライブラリ |
| プログレス | `components/projects/08-export/components/ExportProgressModal.tsx` |
| ウィザードUI | `hooks/useWorkflowData.ts` + `components/projects/detail/PhaseCard.tsx` |
| タブ型選択 | `components/projects/05-students/components/project-student-add-modal/` |
| 競合UI | `components/common/BaseModal.tsx` + カスタムパネル |
| トランザクション | `electron-src/lib/prisma/subtotalGroup.ts` |

---

## 実装順序

### Step 1: 全API設計（型定義・IPC設計）

まず全てのAPIと型定義を設計し、整合性を確認する。

```typescript
// types/import-export.types.ts に全型定義を集約
// electron.d.ts にIPC型定義を追加
```

### Step 2: エクスポート機能実装

- データ収集 → JSON生成 → ZIP圧縮
- プロジェクト詳細画面にボタン追加

### Step 3: インポート機能実装（新規作成モード）

- ZIP展開 → UUID再生成 → データ作成
- ダッシュボードにボタン追加

### Step 4: 統合インポート機能実装

- マッチング・競合検出ロジック
- 5ステップウィザードUI
- 競合解決パネル

---

## 注意事項

- 画像ファイルのパス変換が必要（絶対パス → 相対パス → 新絶対パス）
- 大量データの場合はバッチ処理とプログレス表示
- トランザクションで原子性を保証
- エラー時のロールバック処理
