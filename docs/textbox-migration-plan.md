# 描画ツール総合移行計画（Drawing Tools Comprehensive Migration Plan）

## 目標
個別採点モードの全描画ツール（テキスト・直線・長方形・楕円）をデータベース連携型に移行し、textbox-on-canvas-v3の高度なMathJax処理をテキストツールに統合、PDF出力機能を実装する。

## 現状分析

### 1. 現在の描画システム全体像

#### A) 対応描画ツール（5種類）
```typescript
type DrawingTool = "hand" | "text" | "line" | "rectangle" | "ellipse" | "select"
```

#### B) 描画要素データ構造
```typescript
interface DrawingElement {
  id: string
  type: "text" | "line" | "rectangle" | "ellipse"
  x: number // 0.0 - 1.0 (相対座標)
  y: number // 0.0 - 1.0
  width?: number // 0.0 - 1.0
  height?: number // 0.0 - 1.0
  endX?: number // 直線終点
  endY?: number // 直線終点
  text?: string
  color: string
  strokeWidth: number
  lineStyle?: LineStyle // "solid" | "wave" | "zigzag" | "double" | "arrow" | "both_arrow"
  fontSize?: number
  textBoxWidth?: number
  textBoxHeight?: number
  displayX?: number // 逆ドラッグ対応
  displayY?: number
}
```

#### C) 各ツールの機能詳細

**テキストツール**:
- ドラッグでテキストボックス作成
- MathJax対応（`$...$`記法）
- Canvas + SVG ハイブリッドレンダリング
- リアルタイム編集（モーダル）
- カラー・フォントサイズ選択

**直線ツール**:
- 6種類の線スタイル（実線・波線・ジグザグ・二重線・矢印・両矢印）
- Shift+ドラッグで水平・垂直制約
- ストローク幅1-10px
- カラーパレット選択

**長方形ツール**:
- ストロークのみ描画
- Shift+ドラッグで正方形
- ストローク幅・カラー設定

**楕円ツール**:
- ストロークのみ描画  
- Shift+ドラッグで正円
- ストローク幅・カラー設定

**選択ツール**:
- 複数要素選択（矩形選択）
- 要素移動・削除
- ハンドル操作によるリサイズ
- 直線端点編集

#### D) 高度な機能
- **座標系**: 相対座標（0.0-1.0）による解像度非依存性
- **レンダリング**: CSS scale + scroll ズームシステム
- **インタラクション**: ヒットテスト、ハンドル編集、複数選択
- **キーボードショートカット**: Shift・Ctrl修飾キー対応

### 2. テストモジュール textbox-on-canvas-v3
- **場所**: `/app/textbox-on-canvas-v3/`
- **機能**: 高度なMathJax処理、精密なサイズ測定、配置制御
- **重要**: 既存システムより優秀なMathJax処理とSVG生成

### 3. データベース現状
- **重要**: 描画要素用テーブルが存在しない
- `QuestionScore`テーブルには基本的な採点情報のみ保存
- 全描画要素（テキスト・図形）の永続化機能なし

### 4. PDF出力現状
- **場所**: `/electron-src/lib/prisma/pdfExport.ts`
- 採点マークの出力のみ対応
- 描画要素（テキスト・図形）の出力機能なし

---

## 実装手順

### Phase 1: 包括的データベーススキーマ設計 🗄️

#### 1.1 全描画要素対応テーブル作成
```prisma
model DrawingAnnotation {
  id               String     @id @default(uuid())
  questionScoreId  String     // QuestionScore.idに紐づけ
  
  // 基本プロパティ（全要素共通）
  type            String     // "text", "line", "rectangle", "ellipse"
  x               Float      // 0.0 - 1.0 相対座標
  y               Float      // 0.0 - 1.0
  color           String     @default("#ef4444")
  strokeWidth     Int        @default(3)
  
  // サイズ（長方形・楕円・テキストボックス）
  width           Float      @default(0.0)     // 0.0 - 1.0
  height          Float      @default(0.0)     // 0.0 - 1.0
  
  // 直線専用プロパティ
  endX            Float      @default(0.0)     // 0.0 - 1.0 (直線終点)
  endY            Float      @default(0.0)     // 0.0 - 1.0
  lineStyle       String     @default("solid") // "solid", "wave", "zigzag", "double", "arrow", "both_arrow"
  
  // テキスト専用プロパティ
  text            String     @default("")      // テキスト内容（MathJax対応）
  fontSize        Int        @default(16)
  textBoxWidth    Float      @default(0.0)     // 0.0 - 1.0 (テキストボックス境界)
  textBoxHeight   Float      @default(0.0)     // 0.0 - 1.0
  horizontalAlign String     @default("left")  // "left", "center", "right"
  verticalAlign   String     @default("top")   // "top", "center", "bottom"
  
  // 表示プロパティ（逆ドラッグ対応）
  displayX        Float      @default(0.0)     // 0.0 - 1.0
  displayY        Float      @default(0.0)     // 0.0 - 1.0
  
  // メタデータ
  createdAt       DateTime   @default(now())
  updatedAt       DateTime   @updatedAt
  createdByUserId String?
  
  // リレーション
  questionScore   QuestionScore @relation(fields: [questionScoreId], references: [id], onDelete: Cascade)
  createdByUser   User?         @relation(fields: [createdByUserId], references: [id], onDelete: SetNull)
  
  @@index([questionScoreId])
  @@index([type])
  @@index([createdAt])
}
```

#### 1.2 既存モデルへの関連追加
```prisma
// QuestionScoreモデルに追加
model QuestionScore {
  // 既存フィールド...
  drawingAnnotations DrawingAnnotation[]
}

// Userモデルに追加（協調作業対応）
model User {
  // 既存フィールド...
  drawingAnnotations DrawingAnnotation[]
}
```

#### 1.3 データベースバックアップとマイグレーション実行
**⚠️ 重要: データベース操作前の必須手順**

```bash
# 1. データベースバックアップ作成（必須）
mkdir -p backups
cp prisma/database.db "backups/database_backup_$(date +%Y%m%d_%H%M%S).db"

# 2. バックアップ確認
ls -la backups/

# 3. マイグレーション実行（バックアップ確認後のみ）
npx prisma migrate dev --name add-drawing-annotations

# 4. マイグレーション確認
npx prisma studio
```

**データ保護ルール**:
- 🚫 **データベースファイルを絶対に削除しない**
- 📦 **全てのDB操作前に日時付きバックアップを作成**
- ✅ **マイグレーション前にバックアップが存在することを確認**
- 🔄 **失敗時はバックアップから即座に復元**

### Phase 2: 統合型定義システム 📝

#### 2.1 包括的型定義作成 (`/types/drawing-annotation.types.ts`)
```typescript
// 基本型定義
export type DrawingType = "text" | "line" | "rectangle" | "ellipse"
export type LineStyle = "solid" | "wave" | "zigzag" | "double" | "arrow" | "both_arrow"
export type HorizontalAlign = "left" | "center" | "right"
export type VerticalAlign = "top" | "center" | "bottom"

// データベース対応統合インターフェース
export interface DrawingAnnotation {
  id: string
  questionScoreId: string
  type: DrawingType
  
  // 基本プロパティ（全要素共通）
  x: number          // 0.0 - 1.0 相対座標
  y: number          // 0.0 - 1.0
  color: string
  strokeWidth: number
  
  // サイズプロパティ
  width: number      // 0.0 - 1.0
  height: number     // 0.0 - 1.0
  
  // 直線専用プロパティ
  endX: number       // 0.0 - 1.0
  endY: number       // 0.0 - 1.0
  lineStyle: LineStyle
  
  // テキスト専用プロパティ
  text: string
  fontSize: number
  textBoxWidth: number     // 0.0 - 1.0
  textBoxHeight: number    // 0.0 - 1.0
  horizontalAlign: HorizontalAlign
  verticalAlign: VerticalAlign
  
  // 表示プロパティ
  displayX: number    // 0.0 - 1.0
  displayY: number    // 0.0 - 1.0
  
  // メタデータ
  createdAt: Date
  updatedAt: Date
  createdByUserId?: string | null
}

// 作成用データ型
export interface DrawingCreateData {
  questionScoreId: string
  type: DrawingType
  x: number
  y: number
  color?: string
  strokeWidth?: number
  
  // 全プロパティ（デフォルト値はデータベース側で設定）
  width?: number
  height?: number
  endX?: number
  endY?: number
  lineStyle?: LineStyle
  text?: string
  fontSize?: number
  textBoxWidth?: number
  textBoxHeight?: number
  horizontalAlign?: HorizontalAlign
  verticalAlign?: VerticalAlign
  displayX?: number
  displayY?: number
}

// 更新用データ型
export interface DrawingUpdateData {
  x?: number
  y?: number
  color?: string
  strokeWidth?: number
  width?: number
  height?: number
  endX?: number
  endY?: number
  lineStyle?: LineStyle
  text?: string
  fontSize?: number
  textBoxWidth?: number
  textBoxHeight?: number
  horizontalAlign?: HorizontalAlign
  verticalAlign?: VerticalAlign
  displayX?: number
  displayY?: number
}

// 型ガード関数
export function isTextAnnotation(annotation: DrawingAnnotation): boolean {
  return annotation.type === "text"
}

export function isLineAnnotation(annotation: DrawingAnnotation): boolean {
  return annotation.type === "line"
}

export function isShapeAnnotation(annotation: DrawingAnnotation): boolean {
  return annotation.type === "rectangle" || annotation.type === "ellipse"
}

// 既存DrawingElementとの変換関数用型
export interface DrawingElementLegacy {
  id: string
  type: "text" | "line" | "rectangle" | "ellipse"
  x: number
  y: number
  width?: number
  height?: number
  endX?: number
  endY?: number
  text?: string
  color: string
  strokeWidth: number
  lineStyle?: LineStyle
  fontSize?: number
  textBoxWidth?: number
  textBoxHeight?: number
  displayX?: number
  displayY?: number
}
```

### Phase 3: 包括的バックエンド実装 ⚙️

#### 3.1 統合描画サービス層 (`/electron-src/lib/prisma/drawingAnnotation.ts`)
```typescript
import { prisma } from './client'
import { execSync } from 'child_process'
import { existsSync } from 'fs'
import type { 
  DrawingAnnotation, 
  DrawingCreateData, 
  DrawingUpdateData,
  DrawingType 
} from '@/types/drawing-annotation.types'

// データベースバックアップ関数（全操作前に実行）
function createDatabaseBackup(): void {
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')
    const dateStr = timestamp[0]
    const timeStr = timestamp[1].split('.')[0]
    const backupName = `database_backup_${dateStr}_${timeStr}.db`
    
    // バックアップディレクトリ作成
    execSync('mkdir -p backups')
    
    // データベースファイル存在確認
    if (!existsSync('prisma/database.db')) {
      console.warn('⚠️  データベースファイルが見つかりません: prisma/database.db')
      return
    }
    
    // バックアップ作成
    execSync(`cp prisma/database.db "backups/${backupName}"`)
    console.log(`✅ データベースバックアップ作成: backups/${backupName}`)
    
    // バックアップ確認
    if (!existsSync(`backups/${backupName}`)) {
      throw new Error('バックアップファイルの作成に失敗しました')
    }
  } catch (error) {
    console.error('🚫 データベースバックアップに失敗:', error)
    throw new Error('データベースバックアップが必要です。操作を中止します。')
  }
}

// 基本CRUD操作（全てバックアップ付き）
export async function createDrawingAnnotation(data: DrawingCreateData): Promise<DrawingAnnotation> {
  // 🔒 データベースバックアップ（必須）
  createDatabaseBackup()
  
  return await prisma.drawingAnnotation.create({
    data: {
      ...data,
      color: data.color || '#ef4444',
      strokeWidth: data.strokeWidth || 3,
      // テキスト要素のデフォルト値
      ...(data.type === 'text' && {
        fontSize: data.fontSize || 16,
        horizontalAlign: data.horizontalAlign || 'left',
        verticalAlign: data.verticalAlign || 'top',
      }),
      // 直線要素のデフォルト値
      ...(data.type === 'line' && {
        lineStyle: data.lineStyle || 'solid',
      }),
    }
  })
}

export async function getDrawingAnnotationsByQuestionScore(
  questionScoreId: string,
  type?: DrawingType
): Promise<DrawingAnnotation[]> {
  // 読み取り専用操作のためバックアップ不要
  return await prisma.drawingAnnotation.findMany({
    where: { 
      questionScoreId,
      ...(type && { type })
    },
    orderBy: { createdAt: 'asc' }
  })
}

export async function updateDrawingAnnotation(
  id: string, 
  data: DrawingUpdateData
): Promise<DrawingAnnotation> {
  // 🔒 データベースバックアップ（必須）
  createDatabaseBackup()
  
  return await prisma.drawingAnnotation.update({
    where: { id },
    data: {
      ...data,
      updatedAt: new Date()
    }
  })
}

export async function deleteDrawingAnnotation(id: string): Promise<void> {
  // 🔒 データベースバックアップ（必須）- 削除操作は特に重要
  createDatabaseBackup()
  
  await prisma.drawingAnnotation.delete({
    where: { id }
  })
}

export async function deleteDrawingAnnotationsByQuestionScore(
  questionScoreId: string,
  type?: DrawingType
): Promise<void> {
  // 🔒 データベースバックアップ（必須）- 一括削除は特に重要
  createDatabaseBackup()
  
  await prisma.drawingAnnotation.deleteMany({
    where: { 
      questionScoreId,
      ...(type && { type })
    }
  })
}

// バッチ操作（全てバックアップ付き）
export async function batchCreateDrawingAnnotations(
  annotations: DrawingCreateData[]
): Promise<DrawingAnnotation[]> {
  // 🔒 データベースバックアップ（必須）- バッチ作成前に一度だけ
  createDatabaseBackup()
  
  const results = await Promise.all(
    annotations.map(async (data) => {
      // バッチ内の個別作成ではバックアップをスキップ（既に作成済み）
      return await prisma.drawingAnnotation.create({
        data: {
          ...data,
          color: data.color || '#ef4444',
          strokeWidth: data.strokeWidth || 3,
          ...(data.type === 'text' && {
            fontSize: data.fontSize || 16,
            horizontalAlign: data.horizontalAlign || 'left',
            verticalAlign: data.verticalAlign || 'top',
          }),
          ...(data.type === 'line' && {
            lineStyle: data.lineStyle || 'solid',
          }),
        }
      })
    })
  )
  return results
}

export async function batchUpdateDrawingAnnotations(
  updates: Array<{ id: string; data: DrawingUpdateData }>
): Promise<DrawingAnnotation[]> {
  // 🔒 データベースバックアップ（必須）- バッチ更新前に一度だけ
  createDatabaseBackup()
  
  const results = await Promise.all(
    updates.map(async ({ id, data }) => {
      // バッチ内の個別更新ではバックアップをスキップ（既に作成済み）
      return await prisma.drawingAnnotation.update({
        where: { id },
        data: {
          ...data,
          updatedAt: new Date()
        }
      })
    })
  )
  return results
}

// 統計・分析用
export async function getDrawingAnnotationStats(questionScoreId: string) {
  const annotations = await prisma.drawingAnnotation.findMany({
    where: { questionScoreId },
    select: { type: true }
  })
  
  return {
    total: annotations.length,
    byType: annotations.reduce((acc, { type }) => {
      acc[type] = (acc[type] || 0) + 1
      return acc
    }, {} as Record<string, number>)
  }
}
```

#### 3.2 IPCハンドラー統合 (`/electron-src/ipc-handlers/drawing-handlers.ts`)
```typescript
import { ipcMain } from 'electron'
import * as drawingService from '../lib/prisma/drawingAnnotation'

export function setupDrawingHandlers() {
  // 基本CRUD
  ipcMain.handle('drawing:create', async (_, data) => {
    return await drawingService.createDrawingAnnotation(data)
  })

  ipcMain.handle('drawing:getByQuestionScore', async (_, questionScoreId, type) => {
    return await drawingService.getDrawingAnnotationsByQuestionScore(questionScoreId, type)
  })

  ipcMain.handle('drawing:update', async (_, id, data) => {
    return await drawingService.updateDrawingAnnotation(id, data)
  })

  ipcMain.handle('drawing:delete', async (_, id) => {
    return await drawingService.deleteDrawingAnnotation(id)
  })

  ipcMain.handle('drawing:deleteByQuestionScore', async (_, questionScoreId, type) => {
    return await drawingService.deleteDrawingAnnotationsByQuestionScore(questionScoreId, type)
  })

  // バッチ操作
  ipcMain.handle('drawing:batchCreate', async (_, annotations) => {
    return await drawingService.batchCreateDrawingAnnotations(annotations)
  })

  ipcMain.handle('drawing:batchUpdate', async (_, updates) => {
    return await drawingService.batchUpdateDrawingAnnotations(updates)
  })

  // 統計
  ipcMain.handle('drawing:getStats', async (_, questionScoreId) => {
    return await drawingService.getDrawingAnnotationStats(questionScoreId)
  })
}
```

#### 3.3 ElectronAPI型定義統合 (`/types/electron.d.ts`)
```typescript
interface ElectronAPI {
  // 既存のAPI...
  drawing: {
    create: (data: DrawingCreateData) => Promise<DrawingAnnotation>
    getByQuestionScore: (questionScoreId: string, type?: DrawingType) => Promise<DrawingAnnotation[]>
    update: (id: string, data: DrawingUpdateData) => Promise<DrawingAnnotation>
    delete: (id: string) => Promise<void>
    deleteByQuestionScore: (questionScoreId: string, type?: DrawingType) => Promise<void>
    batchCreate: (annotations: DrawingCreateData[]) => Promise<DrawingAnnotation[]>
    batchUpdate: (updates: Array<{ id: string; data: DrawingUpdateData }>) => Promise<DrawingAnnotation[]>
    getStats: (questionScoreId: string) => Promise<{ total: number; byType: Record<string, number> }>
  }
}
```

### Phase 4: 包括的描画システム統合 🎨

#### 4.1 textbox-on-canvas-v3の高度ロジック移植
**移植対象**:
- `/app/textbox-on-canvas-v3/utils/textConversionUtils.ts` → `/components/projects/07-score-at-once/ScoringIndividual/utils/`
  - 高度なMathJax処理とSVG生成
  - 多行テキスト対応
  - 配置制御ロジック
- `/app/textbox-on-canvas-v3/utils/mathJaxUtils.ts` → 同上
  - 精密なサイズ測定
  - SVG最適化

#### 4.2 描画ツール統合アーキテクチャ
```typescript
// /components/projects/07-score-at-once/ScoringIndividual/UnifiedDrawingCanvas.tsx
export interface UnifiedDrawingCanvasProps {
  imageUrl: string
  cropRegion: CropRegion
  questionScoreId: string
  isReadOnly?: boolean
  onDrawingChange?: (annotations: DrawingAnnotation[]) => void
}

export function UnifiedDrawingCanvas({
  imageUrl,
  cropRegion, 
  questionScoreId,
  isReadOnly = false,
  onDrawingChange
}: UnifiedDrawingCanvasProps) {
  // 統合描画システム:
  // 1. 既存の全描画ツール（直線・長方形・楕円）機能維持
  // 2. テキストツールにtextbox-on-canvas-v3の高度処理統合
  // 3. データベース自動同期
  // 4. 選択・編集・削除機能
}
```

#### 4.3 既存システムからの段階的移行
**段階1**: データベース連携追加（既存UI保持）
**段階2**: テキストツールの高度化
**段階3**: 全描画ツールの最適化
**段階4**: 既存インメモリシステムの削除

### Phase 5: 統合フロントエンドシステム 🔧

#### 5.1 統合描画管理フック
```typescript
// /components/projects/07-score-at-once/ScoringIndividual/hooks/useDrawingAnnotations.ts
export function useDrawingAnnotations(questionScoreId: string | null) {
  const [annotations, setAnnotations] = useState<DrawingAnnotation[]>([])
  const [selectedAnnotations, setSelectedAnnotations] = useState<Set<string>>(new Set())
  
  // データベース連携
  const loadAnnotations = useCallback(async (type?: DrawingType) => {
    if (!questionScoreId) return
    const data = await window.electronAPI.drawing.getByQuestionScore(questionScoreId, type)
    setAnnotations(data)
  }, [questionScoreId])
  
  // CRUD操作
  const createAnnotation = useCallback(async (annotationData: DrawingCreateData) => {
    const newAnnotation = await window.electronAPI.drawing.create(annotationData)
    setAnnotations(prev => [...prev, newAnnotation])
    return newAnnotation
  }, [])
  
  const updateAnnotation = useCallback(async (id: string, updateData: DrawingUpdateData) => {
    const updatedAnnotation = await window.electronAPI.drawing.update(id, updateData)
    setAnnotations(prev => prev.map(ann => ann.id === id ? updatedAnnotation : ann))
    return updatedAnnotation
  }, [])
  
  const deleteAnnotation = useCallback(async (id: string) => {
    await window.electronAPI.drawing.delete(id)
    setAnnotations(prev => prev.filter(ann => ann.id !== id))
    setSelectedAnnotations(prev => {
      const newSet = new Set(prev)
      newSet.delete(id)
      return newSet
    })
  }, [])
  
  // 選択管理
  const selectAnnotation = useCallback((id: string, multiSelect = false) => {
    setSelectedAnnotations(prev => {
      const newSet = multiSelect ? new Set(prev) : new Set()
      if (newSet.has(id)) {
        newSet.delete(id)
      } else {
        newSet.add(id)
      }
      return newSet
    })
  }, [])
  
  const clearSelection = useCallback(() => {
    setSelectedAnnotations(new Set())
  }, [])
  
  // バッチ操作
  const batchUpdate = useCallback(async (updates: Array<{id: string, data: DrawingUpdateData}>) => {
    const updatedAnnotations = await window.electronAPI.drawing.batchUpdate(updates)
    setAnnotations(prev => {
      const updatedMap = new Map(updatedAnnotations.map(ann => [ann.id, ann]))
      return prev.map(ann => updatedMap.get(ann.id) || ann)
    })
  }, [])
  
  const deleteSelected = useCallback(async () => {
    const ids = Array.from(selectedAnnotations)
    await Promise.all(ids.map(id => window.electronAPI.drawing.delete(id)))
    setAnnotations(prev => prev.filter(ann => !selectedAnnotations.has(ann.id)))
    setSelectedAnnotations(new Set())
  }, [selectedAnnotations])
  
  // 型別フィルタリング
  const getAnnotationsByType = useCallback((type: DrawingType) => {
    return annotations.filter(ann => ann.type === type)
  }, [annotations])
  
  // 初期ロード
  useEffect(() => {
    loadAnnotations()
  }, [loadAnnotations])
  
  return {
    annotations,
    selectedAnnotations,
    loadAnnotations,
    createAnnotation,
    updateAnnotation,
    deleteAnnotation,
    selectAnnotation,
    clearSelection,
    batchUpdate,
    deleteSelected,
    getAnnotationsByType,
    // 統計情報
    stats: {
      total: annotations.length,
      byType: annotations.reduce((acc, ann) => {
        acc[ann.type] = (acc[ann.type] || 0) + 1
        return acc
      }, {} as Record<DrawingType, number>)
    }
  }
}
```

#### 5.2 レガシーシステムとの互換性
```typescript
// 既存DrawingElementからの変換
export function convertLegacyToAnnotation(
  element: DrawingElementLegacy, 
  questionScoreId: string
): DrawingCreateData {
  return {
    questionScoreId,
    type: element.type,
    x: element.x,
    y: element.y,
    color: element.color,
    strokeWidth: element.strokeWidth,
    ...(element.width !== undefined && { width: element.width }),
    ...(element.height !== undefined && { height: element.height }),
    ...(element.endX !== undefined && { endX: element.endX }),
    ...(element.endY !== undefined && { endY: element.endY }),
    ...(element.lineStyle && { lineStyle: element.lineStyle }),
    ...(element.text && { text: element.text }),
    ...(element.fontSize && { fontSize: element.fontSize }),
    ...(element.textBoxWidth && { textBoxWidth: element.textBoxWidth }),
    ...(element.textBoxHeight && { textBoxHeight: element.textBoxHeight }),
    ...(element.displayX !== undefined && { displayX: element.displayX }),
    ...(element.displayY !== undefined && { displayY: element.displayY }),
  }
}

// データベースからレガシーシステムへの変換（移行期間中）
export function convertAnnotationToLegacy(annotation: DrawingAnnotation): DrawingElementLegacy {
  return {
    id: annotation.id,
    type: annotation.type,
    x: annotation.x,
    y: annotation.y,
    color: annotation.color,
    strokeWidth: annotation.strokeWidth,
    ...(annotation.width !== undefined && { width: annotation.width }),
    ...(annotation.height !== undefined && { height: annotation.height }),
    ...(annotation.endX !== undefined && { endX: annotation.endX }),
    ...(annotation.endY !== undefined && { endY: annotation.endY }),
    ...(annotation.lineStyle && { lineStyle: annotation.lineStyle }),
    ...(annotation.text && { text: annotation.text }),
    ...(annotation.fontSize && { fontSize: annotation.fontSize }),
    ...(annotation.textBoxWidth && { textBoxWidth: annotation.textBoxWidth }),
    ...(annotation.textBoxHeight && { textBoxHeight: annotation.textBoxHeight }),
    ...(annotation.displayX !== undefined && { displayX: annotation.displayX }),
    ...(annotation.displayY !== undefined && { displayY: annotation.displayY }),
  }
}
```

### Phase 6: PDF出力機能の拡張 📄

#### 6.1 PDF出力の拡張 (`/electron-src/lib/prisma/pdfExport.ts`)
```typescript
import { convertTextToSvg } from '../export/textbox/textboxPdfUtils'

const renderTextboxAnnotations = async (
  page: PDFPage,
  textboxes: TextboxAnnotation[],
  imageWidth: number,
  imageHeight: number
) => {
  for (const textbox of textboxes) {
    // textbox-on-canvas-v3のSVG生成ロジックを使用
    const svgElement = await convertTextToSvg(
      textbox.text,
      imageWidth * textbox.width,
      imageHeight * textbox.height,
      textbox.horizontalAlign,
      textbox.verticalAlign
    )
    
    if (svgElement) {
      // SVG → PNG変換
      const pngBytes = await convertSvgToPng(svgElement)
      const textImage = await pdfDoc.embedPng(pngBytes)
      
      // 絶対座標に変換
      const absoluteX = textbox.x * imageWidth
      const absoluteY = (1 - textbox.y - textbox.height) * imageHeight
      const absoluteWidth = textbox.width * imageWidth  
      const absoluteHeight = textbox.height * imageHeight
      
      page.drawImage(textImage, {
        x: absoluteX,
        y: absoluteY,
        width: absoluteWidth,
        height: absoluteHeight,
      })
    }
  }
}

export async function exportIndividualResultsPDF(
  projectId: string,
  options: { includeTextboxAnnotations?: boolean } = {}
): Promise<string> {
  // 既存のロジック + テキストボックス描画
  if (options.includeTextboxAnnotations) {
    const textboxes = await getTextboxAnnotationsByQuestionScore(questionScore.id)
    await renderTextboxAnnotations(page, textboxes, imageWidth, imageHeight)
  }
}
```

### Phase 7: テスト・検証 ✅

#### 7.1 機能テスト項目
- [ ] テキストボックス作成・編集・削除
- [ ] MathJax数式の正確な描画
- [ ] データベース保存・読み込み
- [ ] PDF出力でのテキストボックス描画
- [ ] 複数生徒間でのデータ独立性
- [ ] パフォーマンステスト（大量テキストボックス）

#### 7.2 マイグレーション検証
- [ ] 既存システムとの互換性
- [ ] データ損失なしでの移行
- [ ] 既存ワークフローの維持

---

## 実装優先順位

### 🔴 最優先（Week 1-2）
1. **データベーススキーマ追加** - データ永続化の基盤
2. **バックエンドサービス実装** - CRUD操作の完成
3. **型定義の統合** - 全体の型安全性確保

### 🟡 中優先（Week 3-4）
1. **textbox-on-canvas-v3ロジック移植** - コア機能の実装
2. **フロントエンド統合** - UI/UXの完成
3. **既存システムからの移行** - 互換性の確保

### 🟢 低優先（Week 5-6）
1. **PDF出力機能拡張** - 高品質出力の実現
2. **パフォーマンス最適化** - 大量データ対応
3. **高度な機能追加** - 配置制御、フォーマット機能

---

## 重要な考慮事項

### 📊 データ設計
- `QuestionScore.id`との紐づけによる明確な関連性
- 相対座標（0.0-1.0）による画面サイズ非依存性
- 複数生徒での独立したテキストボックス管理

### 🔧 技術統合
- textbox-on-canvas-v3の高度なMathJax処理の完全移植
- SVG生成ロジックの品質維持
- PDF出力でのレンダリング品質確保

### 🚀 パフォーマンス
- データベースクエリの最適化
- 大量テキストボックスでのメモリ管理
- リアルタイム編集でのレスポンス性

### 🔄 移行戦略
- 段階的実装によるリスク最小化
- 既存機能との同時運用期間の確保
- データ損失防止とバックアップ戦略

この計画により、textbox-on-canvas-v3の高機能なテキストボックスシステムを採点システムに完全統合し、データベース連携とPDF出力機能を実現できます。