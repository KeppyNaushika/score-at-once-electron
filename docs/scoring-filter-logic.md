# 採点・フィルター・再表示ロジック仕様書

## 概要

Score at Once の採点システムは**一括採点（Grid Mode）を主軸**とした効率的な大量採点システムです。Python版「一括採点.py」の完全移植・機能向上版として、複数答案の同時採点、視覚的なグリッド管理、高度なフィルタリング機能を提供します。

**システムの特徴**:
- **一括採点優先**: デフォルトモードとして設計、キーボード処理も優先
- **効率重視**: 大量の答案を効率的に処理する教育現場向け設計
- **視覚的管理**: グリッド表示による直感的な採点状況把握

## 1. 採点データの流れ

### 1.1 データ構造

```typescript
// 採点データの中核
interface QuestionScore {
  id: string
  answerSheetId: string    // 答案ID
  layoutRegionId: string   // 採点領域ID
  score: number            // 点数
  status: ScoringStatus    // 採点状態
  comment?: string         // コメント
  scoredByUserId: string   // 採点者ID
  scoreVersion: number     // 楽観的ロック用
  updatedAt: Date         // 更新日時
}

// 採点状態の種類
type ScoringStatus = 
  | "ungraded"   // 未採点
  | "correct"    // 正答
  | "incorrect"  // 誤答
  | "partial"    // 部分点
  | "pending"    // 保留
  | "no_answer"  // 無答
  | "proposed"   // 提案済み（協調採点用）
  | "final"      // 確定済み
```

### 1.2 採点データの保存場所

- **データベース**: QuestionScore テーブル（永続化）
- **ローカルステート**: `scoringData` オブジェクト（UI用）

```typescript
// ローカルステートの構造
const scoringData: { [key: string]: ScoringData } = {
  // キー: "${answerSheetId}-${layoutRegionId}"
  "answer123-region456": {
    id: "score789",
    score: 8.5,
    status: "correct",
    version: 1,
    // ...
  }
}
```

## 2. 採点処理フロー

### 2.1 一括採点（Grid Mode）**【既定・優先】**

Score at Onceの**メイン機能**として設計されており、デフォルトモードです。

```
ユーザー操作（キーボード/ボタン）
    ↓
handleBatchScore()
    ↓
1. 選択された複数答案を処理
    ↓
2. 各答案について：
   - 既存スコア更新 or 新規作成
   - DB保存（並列処理）
   - ローカルステート更新
    ↓
3. 表示フィルタ更新（updateDisplayFilters）
```

**特徴**:
- **効率性**: 複数答案の同時採点
- **視覚性**: グリッド表示で全体把握
- **操作性**: WASD移動、ドラッグ選択、修飾キー対応
- **Python版互換**: 元の一括採点.pyの完全移植

### 2.2 個別採点（Individual Mode）

記述・作文問題など、詳細な検討が必要な場合のサブモードです。

```
ユーザー操作（Q/E/F/J/O/P） 
    ↓
handleSetScore()
    ↓
1. 新しい採点データを作成/更新
    ↓
2. electronAPI経由でDB保存
    ↓
3. ローカルステート更新（setScoringData）
    ↓
4. 表示フィルタ更新（updateDisplayFilters）
    ↓
5. 自動進行（次の答案へ移動）
```

**特徴**:
- **詳細性**: 1答案ずつの丁寧な採点
- **集中性**: 答案拡大表示
- **自動進行**: 採点後の自動移動

### 2.3 エラー処理

- **成功時**: ローカルステート即座更新
- **失敗時**: sonner トーストでエラー表示
- **競合時**: 楽観的ロックによる競合解決

## 3. フィルタリングシステム

### 3.1 2段階フィルタリング

Score at Once では効率的なUXのため、2段階のフィルタリングを採用：

```typescript
// フィルタ状態の管理
const [displayFilter, setDisplayFilter] = useState({
  ungraded: true,
  correct: true,
  incorrect: true,
  partial: true,
  pending: true,
  no_answer: true
})

const [appliedFilter, setAppliedFilter] = useState({...})
const [needsFilterRefresh, setNeedsFilterRefresh] = useState(false)
```

### 3.2 フィルタリングの段階

#### Phase 1: 表示フィルタ変更（即座）
```
チェックボックス操作 or Alt+採点キー
    ↓
handleToggleFilter() / handleToggleFilterByScoreKey()
    ↓
displayFilter 更新
    ↓
needsFilterRefresh = true（視覚的インジケータ）
```

#### Phase 2: フィルタ適用（手動 or 自動）
```
Rキー押下 or 採点完了
    ↓
handleRefreshFilter() / updateDisplayFilters()
    ↓
appliedFilter = displayFilter
    ↓
フィルタに基づく表示更新
    ↓
needsFilterRefresh = false
```

### 3.3 フィルタ操作方法

| 操作方法 | 機能 | タイミング |
|---------|------|-----------|
| チェックボックス | displayFilter切り替え | 即座 |
| 数字キー (1-6) | displayFilter切り替え | 即座 |
| Alt+採点キー | displayFilter切り替え | 即座 |
| Rキー | appliedFilter適用 | 手動 |
| 採点完了 | appliedFilter適用 | 自動 |

## 4. 表示更新ロジック

### 4.1 updateDisplayFilters() 関数

採点完了時に自動実行される中核関数：

```typescript
const updateDisplayFilters = () => {
  // 1. フィルタ状態を同期
  const newAppliedFilter = { ...displayFilter }
  setAppliedFilter(newAppliedFilter)
  
  // 2. 表示更新を強制
  setFilterUpdateKey(prev => prev + 1)
  
  // 3. 選択状態をリセット
  setSelectedAnswers(new Set())
  
  // 4. フィルタ適用後の最初の答案を選択
  setTimeout(() => {
    const filteredAnswers = getFilteredAnswers(newAppliedFilter)
    if (filteredAnswers.length > 0) {
      setSelectedAnswers(new Set([filteredAnswers[0].id]))
    }
  }, 100)
}
```

### 4.2 グリッド表示の計算

```typescript
// フィルタリング済み答案の取得
const getGridAnswerData = () => {
  return answerSheets
    .filter(sheet => appliedFilter[sheet.status])
    .map(sheet => ({
      id: sheet.id,
      studentName: sheet.student.name,
      status: getScoringStatus(sheet),
      imageUrl: sheet.imagePath,
      // ...
    }))
}

// 採点状況の判定
const getScoringStatus = (sheet) => {
  const scores = getScoresForSheet(sheet.id)
  if (scores.length === 0) return "ungraded"
  
  // 最新のスコア状態を返す
  return scores[scores.length - 1].status
}
```

### 4.3 表示件数の制御

```typescript
// localStorage による永続化
const [itemsPerRow, setItemsPerRow] = useState([5])

useEffect(() => {
  const stored = localStorage.getItem('answerGridView-itemsPerRow')
  if (stored) {
    const parsed = JSON.parse(stored)
    if (isValidItemsPerRow(parsed)) {
      setItemsPerRow(parsed)
    }
  }
}, [])

const handleItemsPerRowChange = (value) => {
  setItemsPerRow(value)
  localStorage.setItem('answerGridView-itemsPerRow', JSON.stringify(value))
}
```

## 5. キーボードショートカット

### 5.1 採点キー

| キー | 機能 | 状態 |
|-----|------|------|
| Q | 未採点 | ungraded |
| E | 正答 | correct |
| O | 誤答 | incorrect |
| F | 部分点 | partial |
| J | 保留 | pending |
| P | 無答 | no_answer |

### 5.2 フィルタ・ナビゲーションキー

| キー | 機能 | 動作 |
|-----|------|------|
| R | フィルタ更新 | 手動でappliedFilter適用 |
| Ctrl+R | ページリロード | ブラウザ標準動作（除外処理済み） |
| Alt+採点キー | フィルタ切り替え | displayFilter即座変更 |
| 1-6 | フィルタ切り替え | displayFilter即座変更 |
| WASD | グリッド移動 | 選択位置移動 |

## 6. 状態管理の設計思想

### 6.1 一括採点優先の設計

コードレベルで一括採点が優先されている証拠：

```typescript
// デフォルトモードが一括採点
const [gradingMode, setGradingMode] = useState<GradingMode>("grid")

// キーボードハンドラーも一括採点が先に処理
if (gradingMode === "grid") {
  // 一括採点用の処理（WASD、フィルタ、選択操作）
  // ...
  return // 個別採点の処理はスキップ
}

// 個別採点モードの処理（後回し）
const key = event.key.toLowerCase()
switch (key) {
  // 個別採点用の処理
}
```

**設計理念**:
- **効率重視**: 大量採点の現場ニーズに対応
- **Python版互換**: 既存ワークフローの継承
- **UI優先**: グリッド表示による視覚的な採点管理

### 6.2 データフローの原則

1. **Single Source of Truth**: DBが最終的な真実の源
2. **楽観的更新**: UI即座更新 → DB同期
3. **エラー分離**: DB失敗時もUI状態は維持
4. **イベント分離**: フィルタ変更と適用を分離

### 6.2 パフォーマンス最適化

- **ローカルキャッシュ**: scoringData でDB呼び出し削減
- **遅延評価**: setTimeout でDOMレンダリング後に選択更新
- **条件付き更新**: needsFilterRefresh フラグで不要な処理を回避

### 6.3 UX設計の考慮点

- **視覚的フィードバック**: フィルタ変更の即座表示
- **予測可能性**: Rキーでの手動制御
- **効率性**: 採点後の自動フィルタ適用
- **永続性**: localStorage でユーザー設定保持

## 7. トラブルシューティング

### 7.1 よくある問題

| 問題 | 原因 | 解決方法 |
|-----|------|---------|
| フィルタが反映されない | appliedFilter未更新 | Rキー押下 |
| 採点が保存されない | DB接続エラー | ネットワーク確認 |
| 表示件数がリセット | localStorage削除 | 再設定 |
| Ctrl+Rが効かない | キーハンドラー競合 | 修飾キーチェック |

### 7.2 デバッグ情報

```typescript
// デバッグ用の状態確認
console.log('Display Filter:', displayFilter)
console.log('Applied Filter:', appliedFilter)
console.log('Needs Refresh:', needsFilterRefresh)
console.log('Scoring Data:', scoringData)
console.log('Selected Answers:', selectedAnswers)
```

## 8. 今後の拡張可能性

### 8.1 パフォーマンス改善

- **仮想化**: 大量データ対応のためのVirtual Scrolling
- **メモ化**: React.memo, useMemo の活用
- **バックグラウンド同期**: Service Worker による非同期DB同期

### 8.2 機能拡張

- **カスタムフィルタ**: 点数範囲、採点者、日付での絞り込み
- **一括操作**: 複数フィルタ条件の組み合わせ
- **履歴管理**: 採点履歴の表示・復元

---

**更新日**: 2025年1月

**対象バージョン**: Score at Once v1.0

**関連ファイル**:
- `/app/projects/[projectId]/06-score-at-once/page.tsx`
- `/components/projects/06-score-at-once/AnswerGridView.tsx`
- `/electron-src/lib/prisma/questionScore.ts`