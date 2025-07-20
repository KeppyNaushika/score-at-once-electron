# visibleScoreのstate調査結果

## 調査結果サマリー

**結論**: `visibleScore`という名前のstateは存在しません。

しかし、答案表示や採点に関連する類似のstateが複数存在するため、以下に整理します。

---

## 関連するstate一覧

### 1. `visibleAnswers` - 表示対象答案の管理 ⭐ **最重要**

**ファイル**: `/components/projects/07-score-at-once/hooks/use-scoring-filter.ts:48`

```typescript
const [visibleAnswers, setVisibleAnswers] = useState<Set<string>>(new Set())
```

**役割**:
- フィルタリング結果に基づいて実際に表示される答案のIDセット
- 採点状況フィルタ（未採点・正答・誤答・部分点・保留・無答）の適用結果
- 最近採点した答案の強制表示機能

**更新タイミング**:
- フィルタ設定変更時
- 採点実行時（recent答案追加）
- データ初期化時

**使用箇所**:
- `getGridAnswerData()` - 表示用答案データのフィルタリング
- 答案選択の自動管理（useEffect）
- ナビゲーション制御

---

### 2. `showScoreComparison` - 採点比較モーダル表示

**ファイル**: `/components/projects/07-score-at-once/components/scoring-main-view.tsx:78`

```typescript
const [showScoreComparison, setShowScoreComparison] = useState(false)
```

**役割**:
- 複数教員採点時の採点結果比較モーダルの表示制御
- 採点競合解決時に使用

---

### 3. `showScoreForStatus` - PDF出力時の採点マーク表示制御

**ファイル**: `/components/projects/08-export/ScoringMarkSettings.tsx:50`

```typescript
showScoreForStatus: Record<ScoringStatus, boolean>
```

**役割**:
- PDF出力時に各採点状況（正答・誤答等）で採点マークを表示するかの設定
- 出力機能でのみ使用

**デフォルト設定**:
```typescript
showScoreForStatus: {
  ungraded: false,
  correct: true,
  incorrect: true, 
  partial: true,
  pending: true,
  no_answer: false
}
```

---

### 4. `recentlyScoredAnswers` - 最近採点した答案の管理

**ファイル**: `/components/projects/07-score-at-once/hooks/use-scoring-filter.ts:49`

```typescript
const [recentlyScoredAnswers, setRecentlyScoredAnswers] = useState<Set<string>>(new Set())
```

**役割**:
- 最近採点した答案のIDを一時的に保持
- フィルタ条件に関係なく強制表示するための管理

---

### 5. `selectedAnswers` - 選択中の答案管理

**ファイル**: 複数箇所で使用

```typescript
const [selectedAnswers, setSelectedAnswers] = useState<Set<string>>(new Set())
```

**役割**:
- 現在選択されている答案のIDセット
- 一括採点の対象となる答案群

---

## 最も重要な`visibleAnswers`の詳細

### 更新ロジック

```typescript
// use-scoring-filter.ts:69-126
const updateVisibleAnswers = useCallback(() => {
  const newVisibleAnswers = new Set<string>()
  
  answerSheets.forEach((sheet) => {
    const status = getScoringStatus(sheet.id, currentLayoutRegion?.id)
    
    // 通常のフィルター条件 OR 最近採点した答案は強制表示
    if (activeFilterSettings[status] || recentlyScoredAnswers.has(sheet.id)) {
      newVisibleAnswers.add(sheet.id)
    }
  })
  
  setVisibleAnswers(newVisibleAnswers)
}, [answerSheets, currentLayoutRegion, activeFilterSettings, recentlyScoredAnswers, getScoringStatus])
```

### 使用箇所

1. **表示用データ取得**:
```typescript
const getGridAnswerData = useMemo(() => {
  return getAllGridAnswerData.filter(sheet => visibleAnswers.has(sheet.id))
}, [getAllGridAnswerData, visibleAnswers])
```

2. **選択状態管理**:
```typescript
useEffect(() => {
  if (selectedAnswers.size === 0 && visibleAnswers.size > 0) {
    const firstAnswerId = Array.from(visibleAnswers)[0]
    if (firstAnswerId && answerSheets.some(sheet => sheet.id === firstAnswerId)) {
      setSelectedAnswers(new Set([firstAnswerId]))
    }
  }
}, [visibleAnswers, selectedAnswers, ...])
```

3. **表示件数カウント**:
```typescript
// scoring-main-view.tsx:630
visibleAnswersCount={visibleAnswers.size}
```

---

## まとめ

**`visibleScore`というstateは存在しませんが**、答案表示の制御は主に以下のstateで管理されています：

1. **`visibleAnswers`** - 表示対象答案の中核管理（最重要）
2. **`selectedAnswers`** - 選択中答案の管理
3. **`recentlyScoredAnswers`** - 最近採点答案の一時管理
4. **`showScoreComparison`** - 採点比較UI制御
5. **`showScoreForStatus`** - PDF出力時の採点マーク表示制御

このうち、**`visibleAnswers`が答案表示の条件整理における最も重要なstate**で、フィルタリング結果と表示制御の中核を担っています。