# 答案表示条件整理に関する状態管理と関数の調査結果

本ドキュメントは、採点システムにおいて答案表示の条件整理に使用されているstateと関数を包括的にまとめたものです。

## 概要

答案表示システムは以下の主要な要素で構成されています：

- **フィルタリング管理**: 採点状況による表示/非表示制御
- **ページ別表示**: 模範解答のページ番号に基づく答案フィルタリング
- **選択状態管理**: 複数答案の選択・操作
- **レイアウト制御**: グリッド表示の方向・サイズ管理
- **ナビゲーション**: キーボード・マウスによる答案移動

---

## 1. メインページ (`/app/projects/[projectId]/07-score-at-once/page.tsx`)

**ファイルパス**: `/app/projects/[projectId]/07-score-at-once/page.tsx`

**役割**: エントリーポイント。実際の状態管理はScoringMainViewコンポーネントに委譲。

**状態変数**: なし（ScoringMainViewコンポーネントに委譲）

**関数**: なし（ScoringMainViewコンポーネントに委譲）

---

## 2. 採点メインビュー (`/components/projects/07-score-at-once/components/scoring-main-view.tsx`)

**ファイルパス**: `/components/projects/07-score-at-once/components/scoring-main-view.tsx`

### 状態変数

```typescript
// 採点モード（グリッド表示 or 個別表示）
const [gradingMode, setGradingMode] = useState<GradingMode>("grid")

// 選択された答案のID群
const [selectedAnswers, setSelectedAnswers] = useState<Set<string>>(new Set())

// グリッド表示のサイズ設定
const [gridSize, setGridSize] = useState<{ columns: number; rows: number }>({
  columns: 4,
  rows: 3
})

// レイアウト方向（右下、左下、下右、下左）
const [layoutDirection, setLayoutDirection] = useState<LayoutDirection>("right-down")

// 実際の表示列数
const [effectiveColumns, setEffectiveColumns] = useState<number>(4)

// 現在の生徒インデックス
const [currentStudentIndex, setCurrentStudentIndex] = useState<number>(0)

// 現在の設問インデックス
const [currentQuestionIndex, setCurrentQuestionIndex] = useState<number>(0)
```

### 主要関数

```typescript
// 答案選択ハンドラー（模範解答除外、存在チェック付き）
const handleAnswerSelect = (answerId: string, isShiftSelect?: boolean) => {
  // 模範解答の選択を除外
  if (answerId.startsWith("master-")) return
  
  // 答案の存在チェック
  if (!answerSheets.some((sheet) => sheet.id === answerId)) return
  
  // 選択状態の更新処理
}

// 自動進行機能付き一括採点処理
const handleBatchScoreWithProgress = async (score: number, status: ScoringStatus) => {
  // 一括採点 + 自動進行ロジック
}
```

### 条件分岐ロジック

- **模範解答選択除外**: `answerId.startsWith("master-")`
- **答案存在チェック**: `answerSheets.some((sheet) => sheet.id === answerId)`
- **グリッドモード判定**: `gradingMode === "grid"`

---

## 3. フィルタリング管理 (`/components/projects/07-score-at-once/hooks/use-scoring-filter.ts`)

**ファイルパス**: `/components/projects/07-score-at-once/hooks/use-scoring-filter.ts`

**役割**: 答案表示の条件整理における中核コンポーネント。採点状況による表示制御を管理。

### 状態変数

```typescript
// フィルター設定（6つの採点状況別表示フラグ）
const [filterSettings, setFilterSettings] = useState<FilterSettings>({
  ungraded: true,    // 未採点
  correct: true,     // 正答
  incorrect: true,   // 誤答
  partial: true,     // 部分点
  pending: true,     // 保留
  no_answer: true    // 無答
})

// 表示対象答案のID群（フィルタリング結果）
const [visibleAnswers, setVisibleAnswers] = useState<Set<string>>(new Set())

// 最近採点した答案のID群（強制表示対象）
const [recentlyScoredAnswers, setRecentlyScoredAnswers] = useState<Set<string>>(new Set())

// 採点実行中フラグ
const [isScoringInProgress, setIsScoringInProgress] = useState(false)
```

### FilterSettings型定義

```typescript
interface FilterSettings {
  ungraded: boolean    // 未採点
  correct: boolean     // 正答
  incorrect: boolean   // 誤答
  partial: boolean     // 部分点
  pending: boolean     // 保留
  no_answer: boolean   // 無答
}
```

### 主要関数

```typescript
// 表示対象答案の更新（フィルタリング + recent保持ロジック）
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

// 全答案データ取得（フィルタリングなし、ページ・順序考慮）
const getAllGridAnswerData = useMemo(() => {
  // targetPageNumberによるフィルタリング
  const filteredSheets = answerSheets.filter(sheet => 
    sheet.pageNumber === targetPageNumber
  )
  
  // 受験生徒順ソート
  return filteredSheets.sort((a, b) => {
    const orderA = a.projectStudent?.customOrder ?? 999999
    const orderB = b.projectStudent?.customOrder ?? 999999
    if (orderA !== orderB) return orderA - orderB
    
    // 同順序の場合は姓名でソート
    const nameA = (a.projectStudent?.student?.lastName || "") + 
                  (a.projectStudent?.student?.firstName || "")
    const nameB = (b.projectStudent?.student?.lastName || "") + 
                  (b.projectStudent?.student?.firstName || "")
    return nameA.localeCompare(nameB)
  })
}, [answerSheets, targetPageNumber])

// 表示用答案データ取得（visibleAnswersでフィルタリング）
const getGridAnswerData = useMemo(() => {
  return getAllGridAnswerData.filter(sheet => visibleAnswers.has(sheet.id))
}, [getAllGridAnswerData, visibleAnswers])

// 模範解答データ取得
const getMasterAnswerData = useMemo(() => {
  if (!currentMasterImage) return null
  return {
    id: `master-${currentMasterImage.id}`,
    imagePath: currentMasterImage.imagePath,
    studentName: "模範解答",
    pageNumber: currentMasterImage.pageNumber
  }
}, [currentMasterImage])

// フィルタ更新（選択・recent答案クリア）
const handleRefreshFilter = useCallback(() => {
  updateVisibleAnswers()
  setRecentlyScoredAnswers(new Set())
  
  // 選択をクリアして最初の答案を選択
  const firstAnswer = getGridAnswerData[0]
  if (firstAnswer && onAnswerSelect) {
    onAnswerSelect(firstAnswer.id)
  }
}, [updateVisibleAnswers, getGridAnswerData, onAnswerSelect])

// フィルタ切り替え
const handleToggleFilter = useCallback((filterType: keyof FilterSettings) => {
  setFilterSettings(prev => ({
    ...prev,
    [filterType]: !prev[filterType]
  }))
}, [])

// キーボードショートカットによるフィルタ切り替え
const handleToggleFilterByScoreKey = useCallback((scoreKey: string) => {
  const filterMap: Record<string, keyof FilterSettings> = {
    "1": "ungraded",
    "2": "correct", 
    "3": "incorrect",
    "4": "partial",
    "5": "pending",
    "6": "no_answer"
  }
  
  const filterType = filterMap[scoreKey]
  if (filterType) {
    handleToggleFilter(filterType)
  }
}, [handleToggleFilter])
```

### 表示条件決定ロジック

**基本フィルタリング**:
```typescript
// 通常のフィルター条件 OR 最近採点した答案は強制表示
if (activeFilterSettings[status] || recentlyScoredAnswers.has(sheet.id)) {
  newVisibleAnswers.add(sheet.id)
}
```

**答案順序決定**:
1. ページ番号によるフィルタリング: `sheet.pageNumber === targetPageNumber`
2. 受験生徒順ソート: `ProjectStudent.customOrder` 基準
3. 同順序の場合は姓名でソート: `lastName + firstName`

---

## 4. 採点データ管理 (`/components/projects/07-score-at-once/hooks/use-scoring-data.ts`)

**ファイルパス**: `/components/projects/07-score-at-once/hooks/use-scoring-data.ts`

### 状態変数

```typescript
// 採点データ（キー: `${answerSheetId}-${layoutRegionId}`）
const [scoringData, setScoringData] = useState<Record<string, ScoringData>>({})
```

### 主要関数

```typescript
// 採点状況取得
const getScoringStatus = useCallback((answerSheetId: string, layoutRegionId?: string): ScoringStatus => {
  if (!layoutRegionId) return "ungraded"
  
  const key = `${answerSheetId}-${layoutRegionId}`
  const scoreData = scoringData[key]
  return scoreData?.status || "ungraded"
}, [scoringData])

// 実際の得点計算
const getActualScore = useCallback((answerSheetId: string, layoutRegionId?: string): number => {
  if (!layoutRegionId) return 0
  
  const key = `${answerSheetId}-${layoutRegionId}`
  const scoreData = scoringData[key]
  const maxScore = questionRegions.find(q => q.id === layoutRegionId)?.maxScore || 0
  
  switch (scoreData?.status) {
    case "correct":
      return maxScore
    case "incorrect":
    case "no_answer":
      return 0
    case "partial":
    case "pending":
      return scoreData.score || 0
    default:
      return 0
  }
}, [scoringData, questionRegions])

// 設問別進捗計算
const calculateQuestionProgress = useCallback((layoutRegionId: string) => {
  const answerCount = answerSheets.length
  const scoredCount = answerSheets.filter(sheet => {
    const status = getScoringStatus(sheet.id, layoutRegionId)
    return status !== "ungraded"
  }).length
  
  return answerCount > 0 ? (scoredCount / answerCount) * 100 : 0
}, [answerSheets, getScoringStatus])

// 個別採点処理
const handleSetScore = useCallback(async (
  answerSheetId: string,
  layoutRegionId: string,
  score: number,
  status: ScoringStatus
) => {
  // 採点処理実装
}, [currentUserId, setScoringData])

// 一括採点処理
const handleBatchScore = useCallback(async (
  answerSheetIds: string[],
  layoutRegionId: string,
  score: number,
  status: ScoringStatus
) => {
  // 一括採点処理実装
}, [handleSetScore])
```

### 条件分岐ロジック

- **採点状況判定**: `scoreData?.status || "ungraded"`
- **得点計算**: statusに基づく分岐（correct→maxScore、incorrect→0、partial→scoreData.score等）

---

## 5. ナビゲーション管理 (`/components/projects/07-score-at-once/hooks/use-scoring-navigation.ts`)

**ファイルパス**: `/components/projects/07-score-at-once/hooks/use-scoring-navigation.ts`

### 状態変数

```typescript
// 画像ズーム倍率
const [imageZoom, setImageZoom] = useState<number>(1.0)

// 画像表示位置
const [imagePosition, setImagePosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 })

// 表示モード
const [viewMode, setViewMode] = useState<"question" | "full">("question")
```

### 主要関数

```typescript
// WASD移動ハンドラー（レイアウト方向対応）
const handleGridNavigation = useCallback((direction: 'up' | 'down' | 'left' | 'right') => {
  // レイアウト方向に応じた移動処理（4方向の詳細分岐）
}, [layoutDirection, selectedAnswers, gridAnswers, onAnswerSelect])

// 模範解答をスキップして次の有効答案を検索
const findNextValidAnswer = useCallback((startIndex: number, direction: 1 | -1): number => {
  for (let i = 0; i < gridAnswers.length; i++) {
    const index = (startIndex + direction * (i + 1) + gridAnswers.length) % gridAnswers.length
    // 模範解答をスキップ
    if (!gridAnswers[index].id.startsWith("master-")) {
      return index
    }
  }
  return startIndex
}, [gridAnswers])
```

### 条件分岐ロジック

- **模範解答スキップ**: `!gridAnswers[i].id.startsWith("master-")`
- **レイアウト方向別移動処理**: 4方向（right-down, left-down, down-right, down-left）の詳細分岐

---

## 6. 答案グリッドビュー (`/components/projects/07-score-at-once/AnswerGridView.tsx`)

**ファイルパス**: `/components/projects/07-score-at-once/AnswerGridView.tsx`

### 状態変数

```typescript
// 1行あたりの表示件数
const [itemsPerRow, setItemsPerRow] = useState<number[]>([])

// ドラッグ選択関連
const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null)
const [isDragging, setIsDragging] = useState(false)
const [dragCurrent, setDragCurrent] = useState<{ x: number; y: number } | null>(null)

// 自動スクロール設定
const [autoScroll, setAutoScroll] = useState<boolean>(true)

// 生徒名表示設定
const [showStudentNames, setShowStudentNames] = useState<boolean>(true)
```

### 主要関数

```typescript
// レイアウト方向に応じた答案並び替え
const sortedAnswers = useMemo(() => {
  // 4方向のレイアウトに応じた並び替えアルゴリズム
}, [gridAnswers, layoutDirection, effectiveColumns])

// マウス選択処理
const handleMouseDown = (answerId: string, event: React.MouseEvent) => {
  // Ctrl、Shift、通常クリックの処理分岐
}

// Shift選択処理
const handleShiftSelect = (answerId: string) => {
  // 範囲選択の実装
}

// ドラッグによる矩形選択
const handleDragSelection = (startPos: { x: number; y: number }, endPos: { x: number; y: number }) => {
  // 矩形内の答案を選択
}
```

### 条件分岐ロジック

- **模範解答判定**: `answerId.startsWith("master-")`
- **レイアウト方向別ソート**: 4方向の並び替えアルゴリズム
- **選択状態判定**: `selectedAnswers.has(answer.id)`

---

## 7. データローダー (`/components/projects/07-score-at-once/hooks/use-scoring-data-loader.ts`)

**ファイルパス**: `/components/projects/07-score-at-once/hooks/use-scoring-data-loader.ts`

### 状態変数

```typescript
// データ読み込み中フラグ
const [loading, setLoading] = useState<boolean>(true)

// プロジェクトデータ
const [project, setProject] = useState<any>(null)

// 答案データ配列
const [answerSheets, setAnswerSheets] = useState<any[]>([])

// 設問領域データ配列
const [questionRegions, setQuestionRegions] = useState<any[]>([])

// 現在のユーザーID
const [currentUserId, setCurrentUserId] = useState<string | null>(null)

// エラー状態
const [error, setError] = useState<string | null>(null)
```

### 主要関数

```typescript
// 非同期データ読み込み処理
const loadData = useCallback(async () => {
  try {
    setLoading(true)
    // プロジェクト、答案、設問領域データの読み込み
  } catch (err) {
    setError('データの読み込みに失敗しました')
  } finally {
    setLoading(false)
  }
}, [projectId])
```

### 条件分岐ロジック

- **設問領域フィルタリング**: `region.type === "QUESTION_ANSWER"`

---

## 8. 設定管理 (`/components/projects/07-score-at-once/hooks/use-scoring-settings.ts`)

**ファイルパス**: `/components/projects/07-score-at-once/hooks/use-scoring-settings.ts`

### 状態変数

```typescript
// 1行あたりの表示件数
const [itemsPerRow, setItemsPerRow] = useState<number[]>([])

// 自動スクロール設定
const [autoScroll, setAutoScroll] = useState<boolean>(true)

// 生徒名表示設定
const [showStudentNames, setShowStudentNames] = useState<boolean>(true)
```

### 主要関数

```typescript
// localStorage永続化
const saveItemsPerRow = (newItemsPerRow: number[]) => {
  setItemsPerRow(newItemsPerRow)
  localStorage.setItem('scoring-items-per-row', JSON.stringify(newItemsPerRow))
}

const saveAutoScroll = (value: boolean) => {
  setAutoScroll(value)
  localStorage.setItem('scoring-auto-scroll', value.toString())
}

const saveShowStudentNames = (value: boolean) => {
  setShowStudentNames(value)
  localStorage.setItem('scoring-show-student-names', value.toString())
}
```

---

## 答案表示の主要な条件整理ロジック

### 1. 基本フィルタリング
`use-scoring-filter.ts`の`updateVisibleAnswers()`が中核となる条件整理処理を実行：

```typescript
// 通常のフィルター条件 OR 最近採点した答案は強制表示
if (activeFilterSettings[status] || recentlyScoredAnswers.has(sheet.id)) {
  newVisibleAnswers.add(sheet.id)
}
```

### 2. ページ別表示
masterImageIdから取得したpageNumberでフィルタリング：

```typescript
const filteredSheets = answerSheets.filter(sheet => 
  sheet.pageNumber === targetPageNumber
)
```

### 3. 採点状況別表示
FilterSettingsの6つのフラグで制御：
- ungraded（未採点）
- correct（正答）
- incorrect（誤答）
- partial（部分点）
- pending（保留）
- no_answer（無答）

### 4. 最近採点答案の強制表示
recentlyScoredAnswersによる例外処理で、フィルタ条件に関係なく表示。

### 5. 模範解答の特別扱い
各所で`master-`接頭辞による判定：
- 選択対象から除外
- ナビゲーション時にスキップ
- 特別なスタイリング適用

### 6. 受験生徒順ソート
ProjectStudent.customOrderを基準とした順序制御：

```typescript
const orderA = a.projectStudent?.customOrder ?? 999999
const orderB = b.projectStudent?.customOrder ?? 999999
if (orderA !== orderB) return orderA - orderB

// 同順序の場合は姓名でソート
const nameA = (a.projectStudent?.student?.lastName || "") + 
              (a.projectStudent?.student?.firstName || "")
const nameB = (b.projectStudent?.student?.lastName || "") + 
              (b.projectStudent?.student?.firstName || "")
return nameA.localeCompare(nameB)
```

---

## 答案表示に関連するuseEffect一覧

### 1. `/components/projects/07-score-at-once/components/scoring-main-view.tsx`

#### useEffect 1 (91-93行目)
```typescript
// プラットフォーム固有のキーラベル初期化
useEffect(() => {
  setPlatformKeyLabels(getPlatformKeyLabels())
}, []) // マウント時のみ
```

#### useEffect 2 (330-344行目)
```typescript
// 採点データの初期化 - 既存の採点データをロード
useEffect(() => {
  if (projectId && !loading && project) {
    loadExistingScoringData(projectId).then(setScoringData)
  }
}, [projectId, loading, project, loadExistingScoringData, setScoringData])
```

#### useEffect 3 (347-350行目)
```typescript
// 設定の初期化 - itemsPerRowから実際の列数を更新
useEffect(() => {
  if (itemsPerRow.length > 0) {
    setEffectiveColumns(itemsPerRow[0])
  }
}, [itemsPerRow])
```

### 2. `/components/projects/07-score-at-once/hooks/use-scoring-filter.ts`

#### useEffect 1 (132-140行目)
```typescript
// 初期化時と設問変更時の表示対象設定・選択クリア
useEffect(() => {
  if (answerSheets.length > 0 && questionRegions.length > 0) {
    updateVisibleAnswers()
    setSelectedAnswers(new Set())
  }
}, [answerSheets.length, questionRegions.length, currentQuestionIndex, setSelectedAnswers, updateVisibleAnswers])
```

#### ⭐ useEffect 2 (143-189行目) **重要**
```typescript
// 答案選択の自動管理 - visibleAnswers更新時の適切な答案選択
useEffect(() => {
  // 採点中は選択更新をスキップ
  if (isScoringInProgress) return
  
  // 選択が空の場合のみ最初の答案を自動選択
  if (selectedAnswers.size === 0 && visibleAnswers.size > 0) {
    const firstAnswerId = Array.from(visibleAnswers)[0]
    if (firstAnswerId && answerSheets.some(sheet => sheet.id === firstAnswerId)) {
      setSelectedAnswers(new Set([firstAnswerId]))
    }
  }
}, [visibleAnswers, selectedAnswers, setSelectedAnswers, answerSheets, recentlyScoredAnswers, isScoringInProgress])
```

### 3. `/components/projects/07-score-at-once/hooks/use-scoring-data-loader.ts`

#### useEffect 1 (23-78行目)
```typescript
// データロードの統合管理 - プロジェクト、答案、設問領域、ユーザー情報の読み込み
useEffect(() => {
  const loadData = async () => {
    try {
      setLoading(true)
      // プロジェクト、答案、設問領域データの並列読み込み
      // エラーハンドリング付き
    } catch (err) {
      setError('データの読み込みに失敗しました')
    } finally {
      setLoading(false)
    }
  }
  
  if (projectId) {
    loadData()
  }
}, [projectId])
```

### 4. `/components/projects/07-score-at-once/hooks/use-scoring-settings.ts`

#### useEffect 1 (9-34行目)
```typescript
// 設定の初期化 - localStorageから設定値を読み込み
useEffect(() => {
  try {
    const savedItemsPerRow = localStorage.getItem('scoring-items-per-row')
    const savedAutoScroll = localStorage.getItem('scoring-auto-scroll')
    const savedShowStudentNames = localStorage.getItem('scoring-show-student-names')
    
    if (savedItemsPerRow) setItemsPerRow(JSON.parse(savedItemsPerRow))
    if (savedAutoScroll) setAutoScroll(savedAutoScroll === 'true')
    if (savedShowStudentNames) setShowStudentNames(savedShowStudentNames === 'true')
  } catch (error) {
    console.error('設定の読み込みに失敗:', error)
  }
}, []) // マウント時のみ
```

### 5. `/components/projects/07-score-at-once/AnswerGridView.tsx`

#### useEffect 1 (174-205行目)
```typescript
// 列数設定の管理 - 外部設定またはlocalStorageから列数を設定し親に通知
useEffect(() => {
  if (externalItemsPerRow && externalItemsPerRow.length > 0) {
    setItemsPerRow(externalItemsPerRow)
    if (onEffectiveColumnsChange) {
      onEffectiveColumnsChange(externalItemsPerRow[0])
    }
  }
}, [externalItemsPerRow, onEffectiveColumnsChange])
```

#### useEffect 2 (234-253行目)
```typescript
// キーボードショートカット - Option+Plus/Minusで列数増減
useEffect(() => {
  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.altKey && event.key === '=') {
      incrementItemsPerRow()
    } else if (event.altKey && event.key === '-') {
      decrementItemsPerRow()
    }
  }
  
  window.addEventListener('keydown', handleKeyDown)
  return () => window.removeEventListener('keydown', handleKeyDown)
}, [incrementItemsPerRow, decrementItemsPerRow])
```

#### useEffect 3 (299-323行目)
```typescript
// 採点キーボードショートカット処理 (Q,E,F,J,O,P)
useEffect(() => {
  const handleScoreKeyPress = (status: ScoringStatus) => {
    if (selectedAnswers.size > 0) {
      onAnswerScore(Array.from(selectedAnswers), status as ScoringStatus)
    }
  }
  
  // キーボードリスナーの登録
}, [selectedAnswers, onAnswerScore])
```

#### ⭐ useEffect 4 (326-362行目) **重要**
```typescript
// 自動スクロール機能 - 選択された答案を画面中央に表示
useEffect(() => {
  if (!autoScroll || selectedAnswers.size === 0) return
  
  const firstSelectedId = Array.from(selectedAnswers)[0]
  const element = document.querySelector(`[data-answer-id="${firstSelectedId}"]`)
  
  if (element) {
    element.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
      inline: 'center'
    })
  }
}, [selectedAnswers, layoutDirection, autoScroll])
```

## 📝 答案表示条件に関する重要なuseEffect

### **最も重要**: `use-scoring-filter.ts`の143-189行目のuseEffect
- **役割**: 答案の選択状態を自動管理
- **機能**: フィルタ変更時の選択保持/クリア制御
- **特徴**: 採点中の選択更新スキップ機能、空選択時の最初答案自動選択

### **データ基盤**: `use-scoring-data-loader.ts`の23-78行目のuseEffect
- **役割**: 全ての表示データの読み込み管理
- **機能**: エラーハンドリング付きの並列データ取得

### **表示制御**: `AnswerGridView.tsx`の326-362行目のuseEffect
- **役割**: 選択答案の自動スクロール表示
- **機能**: 選択変更時の画面中央表示

これらのuseEffectが連携して、答案表示の条件整理と選択管理を実現しています。

---

## システム設計の特徴

このシステムでは、フィルタリング条件と表示対象の決定が`use-scoring-filter.ts`に集約されており、他のコンポーネントは`visibleAnswers`と`getGridAnswerData()`を通じて表示対象を取得する設計となっています。

**責任分離**:
- **フィルタリング**: `use-scoring-filter.ts`
- **データ管理**: `use-scoring-data.ts`
- **ナビゲーション**: `use-scoring-navigation.ts`
- **設定管理**: `use-scoring-settings.ts`
- **UI表示**: `AnswerGridView.tsx`
- **メイン制御**: `scoring-main-view.tsx`

この設計により、各機能が独立して変更可能で、テストとメンテナンスが容易な構造を実現しています。