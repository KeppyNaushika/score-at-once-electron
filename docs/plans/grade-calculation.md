# 成績算出機能 実装計画

## Context

一括採点アプリに「成績算出」機能を追加する。複数の試験プロジェクトの採点結果と外部成績（提出物・授業態度等）を統合し、観点別評価や総合成績を算出する。成績は数値（3/5/10段階等）・文字列（A/B/C, 優/秀等）の両方に対応。

## 要件まとめ

- **UI**: サイドバーに「成績算出」を新規追加
- **対象生徒**: 学級ベース（学級を選択→その学級の全生徒）
- **データソース**: 試験プロジェクト（自動スコア取得）+ 外部成績（手動入力、点数のみ配点あり）
- **重み付け**: 各データソースの満点→傾斜配点（例: 100点満点→30点扱い）
- **観点別評価**: SubtotalGroup単位で成績算出（Subtotalごとに集計）
- **成績境界**: パーセンテージ閾値（例: 80%以上=A）、Subtotalごと+総合
- **出力**: Excel

---

## Phase 1: データベーススキーマ

### `prisma/schema.prisma` に追加

```
GradeProject (id, name, classId→Class, subtotalGroupId→SubtotalGroup, description?, timestamps)
GradeDataSource (id, gradeProjectId→GradeProject, type["exam"|"manual"], examProjectId?→Project, subtotalId→Subtotal, name, maxScore:Decimal, weight:Decimal, order:Int, timestamps)
  @@unique([gradeProjectId, examProjectId, subtotalId])
ManualScore (id, gradeDataSourceId→GradeDataSource, studentId→Student, score:Decimal?, timestamps)
  @@unique([gradeDataSourceId, studentId])
GradeBoundarySet (id, gradeProjectId→GradeProject, targetType["subtotal"|"overall"], subtotalId?→Subtotal, timestamps)
  @@unique([gradeProjectId, targetType, subtotalId])
GradeBoundary (id, gradeBoundarySetId→GradeBoundarySet, label:String, minPercentage:Decimal, order:Int, timestamps)
```

既存モデルに逆リレーション追加: `Class`, `SubtotalGroup`, `Project`, `Subtotal`, `Student`

### 実行: `npx prisma migrate dev --name add_grade_calculation`

---

## Phase 2: バックエンド（DB関数）

| ファイル                                              | 関数                                                                                                               |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `electron-src/lib/prisma/gradeProject.ts` (~120行)    | `getAllGradeProjects`, `getGradeProjectById`, `createGradeProject`, `updateGradeProject`, `deleteGradeProject`     |
| `electron-src/lib/prisma/gradeDataSource.ts` (~130行) | `getDataSourcesByGradeProjectId`, `createDataSource`, `updateDataSource`, `deleteDataSource`, `reorderDataSources` |
| `electron-src/lib/prisma/manualScore.ts` (~80行)      | `getManualScoresByDataSourceId`, `upsertManualScore`, `batchUpsertManualScores`                                    |
| `electron-src/lib/prisma/gradeBoundary.ts` (~100行)   | `getBoundarySetsByGradeProjectId`, `upsertBoundarySet`, `deleteBoundarySet`                                        |

パターン参考: `electron-src/lib/prisma/subject.ts`, `electron-src/lib/prisma/subtotalGroup.ts`

---

## Phase 3: 成績算出エンジン + IPC

### `electron-src/lib/shared/calculations/gradeCalculator.ts` (~180行)

```typescript
// 主要関数
calculateGrades(gradeProjectId: string): Promise<{ students: StudentGradeResult[] }>

// 計算ロジック（各生徒）:
// 1. StudentClassMembershipから学級の生徒一覧取得
// 2. 各GradeDataSourceについて:
//    - type="exam": calculateSubtotalScoreBySubtotalId() を再利用（subtotalCalculator.ts:224行目）
//      → rawScore / maxScore * weight で重み付けスコア算出
//    - type="manual": ManualScoreから取得、同様に重み付け
// 3. subtotalIdごとに重み付けスコアを集計
// 4. GradeBoundarySetを適用して成績ラベル決定（% >= minPercentageで降順マッチ）
// 5. 全subtotalの合計で総合成績を算出
```

### `electron-src/ipc-handlers/gradeProjectHandlers.ts` (~190行)

IPCハンドラー（`grade-project:` プレフィックス）:

- CRUD: `getAll`, `getById`, `create`, `update`, `delete`
- データソース: `getDataSources`, `createDataSource`, `updateDataSource`, `deleteDataSource`, `reorderDataSources`
- 外部成績: `getManualScores`, `batchUpsertManualScores`
- 境界: `getBoundarySets`, `upsertBoundarySet`, `deleteBoundarySet`
- 算出: `calculateGrades`
- 補助: `getExamProjectCandidates`（同一SubtotalGroupを持つ試験プロジェクト一覧）
- 出力: `exportExcel`

### 修正ファイル

- `electron-src/ipc-handlers/index.ts`: `setupGradeProjectHandlers()` 追加
- `electron-src/preload.ts`: `gradeProject: { ... }` ネームスペース追加
- `types/electron.d.ts`: MyAPIに `gradeProject` 追加
- `types/gradeProject.types.ts` (新規, ~80行): 共有型定義

---

## Phase 4: フロントエンド - 一覧 + レイアウト

### ナビゲーション

`components/layout/Navigation.tsx` の `navItems` に追加（「小計点管理」の下）:

```typescript
{ href: "/grade-projects", label: "成績算出", icon: BarChart3 }
```

### 一覧ページ

| ファイル                                                                | 内容                                              |
| ----------------------------------------------------------------------- | ------------------------------------------------- |
| `app/grade-projects/page.tsx` (~20行)                                   | PageHeader + GradeProjectListContainer            |
| `components/grade-projects/list/GradeProjectListContainer.tsx` (~150行) | プロジェクト一覧カード表示、新規作成ダイアログ    |
| `components/grade-projects/list/GradeProjectCard.tsx` (~60行)           | 名前、学級、データソース数表示                    |
| `components/grade-projects/list/GradeProjectCreateDialog.tsx` (~120行)  | 作成フォーム（名前、学級選択、SubtotalGroup選択） |

### ワークフローレイアウト

`app/grade-projects/[gradeProjectId]/layout.tsx` (~120行)

パターン参考: `app/projects/[projectId]/layout.tsx`

```typescript
const workflowSteps = [
  { id: "01-setup", label: "1. 基本設定", path: "01-setup" },
  { id: "02-data-sources", label: "2. データソース", path: "02-data-sources" },
  { id: "03-manual-scores", label: "3. 外部成績", path: "03-manual-scores" },
  { id: "04-boundaries", label: "4. 成績境界", path: "04-boundaries" },
  { id: "05-results", label: "5. 結果", path: "05-results" },
]
```

---

## Phase 5: フロントエンド - ワークフロー各ステップ

### Step 1: 基本設定

- `app/grade-projects/[gradeProjectId]/01-setup/page.tsx`
- `components/grade-projects/01-setup/SetupContainer.tsx` (~150行): 名前・学級・SubtotalGroup編集

### Step 2: データソース

- `app/grade-projects/[gradeProjectId]/02-data-sources/page.tsx`
- `components/grade-projects/02-data-sources/DataSourcesContainer.tsx` (~180行): Subtotalごとにグループ化表示
- `components/grade-projects/02-data-sources/DataSourceRow.tsx` (~80行)
- `components/grade-projects/02-data-sources/AddExamSourceDialog.tsx` (~120行): 互換試験プロジェクト選択
- `components/grade-projects/02-data-sources/AddManualSourceDialog.tsx` (~100行): 名前・配点・重み・Subtotal設定
- `hooks/grade-projects/useDataSources.ts` (~100行)

### Step 3: 外部成績入力

- `app/grade-projects/[gradeProjectId]/03-manual-scores/page.tsx`
- `components/grade-projects/03-manual-scores/ManualScoresContainer.tsx` (~150行): テーブル（行=生徒、列=手動データソース）
- `components/grade-projects/03-manual-scores/ScoreCell.tsx` (~60行): 編集可能セル（0〜maxScore検証）
- `hooks/grade-projects/useManualScores.ts` (~80行): バッチ保存

### Step 4: 成績境界

- `app/grade-projects/[gradeProjectId]/04-boundaries/page.tsx`
- `components/grade-projects/04-boundaries/BoundariesContainer.tsx` (~180行): Subtotalごと+総合タブ
- `components/grade-projects/04-boundaries/BoundaryEditor.tsx` (~120行): ラベル・閾値入力
- `components/grade-projects/04-boundaries/BoundaryPresetSelector.tsx` (~60行): プリセット（5段階、3段階ABC等）
- `hooks/grade-projects/useBoundaries.ts` (~80行)

### Step 5: 結果・出力

- `app/grade-projects/[gradeProjectId]/05-results/page.tsx`
- `components/grade-projects/05-results/ResultsContainer.tsx` (~180行): calculateGrades呼び出し、テーブル表示
- `components/grade-projects/05-results/ResultsTable.tsx` (~150行): ソート可能、成績ラベル色分け
- `components/grade-projects/05-results/GradeDistributionChart.tsx` (~80行): 分布棒グラフ
- `hooks/grade-projects/useGradeResults.ts` (~60行)

---

## Phase 6: Excel出力

| ファイル                                                             | 内容                                                       |
| -------------------------------------------------------------------- | ---------------------------------------------------------- |
| `electron-src/lib/export/gradeExcel/gradeExcelExportMain.ts` (~80行) | メイン関数                                                 |
| `electron-src/lib/export/gradeExcel/gradeDataFetcher.ts` (~60行)     | calculateGrades + プロジェクト詳細取得                     |
| `electron-src/lib/export/gradeExcel/gradeSheetCreator.ts` (~150行)   | 成績一覧シート + データソース別詳細シート + 境界設定シート |
| `electron-src/lib/export/gradeExcel/index.ts` (~5行)                 | re-export                                                  |

パターン参考: `electron-src/lib/export/excel/`

---

## Phase 7: 成績算出専用アーカイブ（Import/Export）

既存の`.score`アーカイブ（試験プロジェクト用）とは別に、成績算出プロジェクト専用の`.grade`アーカイブを作成する。

### アーカイブ形式

`.grade`ファイル（ZIP形式、既存`.score`と同パターン）:

```
manifest.json          → バージョン、メタ情報、データ件数
grade-project.json     → GradeProject基本情報 + GradeDataSource一覧
manual-scores.json     → ManualScore全データ
boundaries.json        → GradeBoundarySet + GradeBoundary全データ
```

**manifest.json** の構造:

```typescript
{
  version: "1.0.0",           // 成績算出アーカイブ独自バージョン
  appVersion: string,
  exportedAt: string,
  gradeProjectId: string,
  gradeProjectName: string,
  counts: { dataSources, manualScores, boundarySets, boundaries }
}
```

**参照データの扱い**:

- `classId`: Class名を含めて保存（インポート時にname照合で再リンク）
- `subtotalGroupId`: SubtotalGroup名+Subtotal一覧を含めて保存（name照合で再リンク）
- `examProjectId`: Project.examName + examDate を含めて保存（examName照合で再リンク、見つからなければnull）
- `studentId`: Student.studentNumber + name を含めて保存（studentNumber照合で再リンク）

### 型定義

`types/gradeArchive.types.ts` (新規, ~100行):

```typescript
export interface GradeArchiveManifest { version, appVersion, exportedAt, gradeProjectId, gradeProjectName, counts }
export interface GradeArchiveData { manifest, gradeProjectData, manualScoresData, boundariesData }
export interface ArchiveGradeProjectData { gradeProject, dataSources[], classRef, subtotalGroupRef, examProjectRefs[] }
export interface ArchiveManualScoresData { manualScores[], studentRefs[] }
export interface ArchiveBoundariesData { boundarySets[], boundaries[] }
```

### エクスポート

| ファイル                                                                      | 内容                                                                    |
| ----------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| `electron-src/lib/export/grade-archive/gradeArchiveDataCollector.ts` (~120行) | GradeProject + DataSources + ManualScores + Boundaries + 参照データ収集 |
| `electron-src/lib/export/grade-archive/gradeArchiveCreator.ts` (~80行)        | ZIP作成（既存archiveCreator.tsと同パターン）                            |
| `electron-src/lib/export/grade-archive/index.ts` (~5行)                       | re-export                                                               |

### インポート

| ファイル                                                                 | 内容                    |
| ------------------------------------------------------------------------ | ----------------------- |
| `electron-src/lib/import/grade-archive/gradeArchiveExtractor.ts` (~60行) | ZIP展開 + JSON解析      |
| `electron-src/lib/import/grade-archive/gradeArchiveImporter.ts` (~180行) | 参照データ照合 + DB挿入 |
| `electron-src/lib/import/grade-archive/index.ts` (~5行)                  | re-export               |

**インポートロジック**:

1. Class照合: name一致で既存Classにリンク（なければエラー）
2. SubtotalGroup照合: name一致で既存SubtotalGroupにリンク（なければエラー）
3. Student照合: studentNumber一致で既存Studentにリンク（なければスキップ）
4. ExamProject照合: examName一致で候補表示、ユーザー選択（なければDataSource.examProjectId=null）
5. GradeProject作成 → DataSource作成 → ManualScore挿入 → BoundarySet/Boundary挿入

### IPC追加

`gradeProjectHandlers.ts` に追加:

- `grade-project:exportArchive`: アーカイブエクスポート
- `grade-project:importArchive`: アーカイブインポート
- `grade-project:previewArchive`: インポート前プレビュー（照合結果表示）

### UI

一覧ページ（`GradeProjectListContainer.tsx`）にエクスポート/インポートボタンを追加。
インポート時はシンプルなダイアログ（照合結果確認→実行）。

---

## 設計上のポイント

1. **オンザフライ計算**: 成績は保存せず毎回算出。常に最新の採点結果を反映
2. **SubtotalGroup共有制約**: 登録可能な試験プロジェクトは同一SubtotalGroupを持つもののみ（観点の整合性保証）
3. **既存関数の再利用**: `calculateSubtotalScoreBySubtotalId()`（subtotalCalculator.ts）で試験スコア取得
4. **Decimal型**: maxScore, weight, minPercentage, scoreはDecimal（既存QuestionScore.partialScoreと同一パターン）
5. **ファイルサイズ**: 全ファイル200行以下

## ファイル数

- **新規**: ~41ファイル
  - Phase 1: 1 migration
  - Phase 2: 4 DB関数
  - Phase 3: 1 calculator + 1 handler + 1 types
  - Phase 4: 5 (1 page + 3 components + 1 layout)
  - Phase 5: 5 pages + 11 components + 4 hooks
  - Phase 6: 4 Excel export
  - Phase 7: 1 types + 3 export + 3 import
- **修正**: 5ファイル（schema.prisma, index.ts, preload.ts, electron.d.ts, Navigation.tsx）

## 検証方法

1. Phase 1完了後: `npx prisma studio` でテーブル確認
2. Phase 2-3完了後: Vitestでバックエンドテスト
3. Phase 4-5完了後: `npm run dev` → サイドバーから成績算出→全ワークフロー動作確認
4. Phase 6完了後: Excel出力→内容検証
5. Phase 7完了後: エクスポート→インポート→データ整合性検証
6. 全Phase完了後: `npm run check-all` でlint+型チェック
