# Textbox-on-Canvas-v3 Migration Plan

## 目標
textbox-on-canvas-v3のロジックを採点システム（ScoringMainView.tsx）の個別表示モードに完全移植し、データベース連携とPDF出力機能を実装する。

## 現状分析

### 1. 現在のテキストボックス実装

#### A) 採点システム内のテキストボックス
- **場所**: `/components/projects/07-score-at-once/AnswerIndividualView.tsx`
- **データ構造**: `DrawingElement` interface（type: "text"）
- **保存**: インメモリのみ、データベース連携なし
- **機能**: MathJax対応、SVGレンダリング、相対座標（0.0-1.0）

```typescript
interface DrawingElement {
  id: string
  type: "text" | "line" | "rectangle" | "ellipse"
  x: number // 0.0 - 1.0 (相対座標)
  y: number // 0.0 - 1.0
  text?: string
  color: string
  fontSize?: number
  textBoxWidth?: number // 0.0 - 1.0
  textBoxHeight?: number // 0.0 - 1.0
}
```

#### B) テストモジュール textbox-on-canvas-v3
- **場所**: `/app/textbox-on-canvas-v3/`
- **データ構造**: `TextBox` interface
- **保存**: データベース連携なし
- **機能**: 高度なMathJax処理、精密なサイズ測定、配置制御

```typescript
interface TextBox {
  id: string
  x: number
  y: number
  width: number
  height: number
  text: string
  isSelected: boolean
  horizontalAlign: 'left' | 'center' | 'right'
  verticalAlign: 'top' | 'center' | 'bottom'
}
```

### 2. データベース現状
- **重要**: テキストボックス用テーブルが存在しない
- `QuestionScore`テーブルには基本的な採点情報のみ保存
- テキストボックスの永続化機能なし

### 3. PDF出力現状
- **場所**: `/electron-src/lib/prisma/pdfExport.ts`
- 採点マークの出力のみ対応
- テキストボックス出力機能なし

---

## 実装手順

### Phase 1: データベーススキーマ拡張 🗄️

#### 1.1 新しいテーブル作成
```prisma
model TextboxAnnotation {
  id              String     @id @default(uuid())
  questionScoreId String     // QuestionScore.idに紐づけ
  x               Float      // 0.0 - 1.0 相対座標
  y               Float      // 0.0 - 1.0
  width           Float      // 0.0 - 1.0
  height          Float      // 0.0 - 1.0
  text            String
  color           String     @default("#000000")
  fontSize        Int        @default(16)
  horizontalAlign String     @default("left")
  verticalAlign   String     @default("top")
  createdAt       DateTime   @default(now())
  updatedAt       DateTime   @updatedAt
  
  questionScore   QuestionScore @relation(fields: [questionScoreId], references: [id], onDelete: Cascade)
  
  @@index([questionScoreId])
}
```

#### 1.2 QuestionScoreモデルに関連追加
```prisma
model QuestionScore {
  // 既存フィールド...
  textboxAnnotations TextboxAnnotation[]
}
```

#### 1.3 マイグレーション実行
```bash
npx prisma migrate dev --name add-textbox-annotations
```

### Phase 2: 型定義の統合 📝

#### 2.1 統合型定義作成 (`/types/textbox-annotation.types.ts`)
```typescript
export interface TextboxAnnotation {
  id: string
  questionScoreId: string
  x: number          // 0.0 - 1.0 相対座標
  y: number          // 0.0 - 1.0
  width: number      // 0.0 - 1.0
  height: number     // 0.0 - 1.0
  text: string
  color: string
  fontSize: number
  horizontalAlign: 'left' | 'center' | 'right'
  verticalAlign: 'top' | 'center' | 'bottom'
  createdAt: Date
  updatedAt: Date
}

export interface TextboxCreateData {
  questionScoreId: string
  x: number
  y: number
  width: number
  height: number
  text: string
  color?: string
  fontSize?: number
  horizontalAlign?: 'left' | 'center' | 'right'
  verticalAlign?: 'top' | 'center' | 'bottom'
}

export interface TextboxUpdateData {
  x?: number
  y?: number
  width?: number
  height?: number
  text?: string
  color?: string
  fontSize?: number
  horizontalAlign?: 'left' | 'center' | 'right'
  verticalAlign?: 'top' | 'center' | 'bottom'
}
```

### Phase 3: バックエンド実装 ⚙️

#### 3.1 データベースサービス層 (`/electron-src/lib/prisma/textboxAnnotation.ts`)
```typescript
import { prisma } from './client'
import type { TextboxAnnotation, TextboxCreateData, TextboxUpdateData } from '@/types/textbox-annotation.types'

export async function createTextboxAnnotation(data: TextboxCreateData): Promise<TextboxAnnotation> {
  return await prisma.textboxAnnotation.create({
    data: {
      ...data,
      color: data.color || '#000000',
      fontSize: data.fontSize || 16,
      horizontalAlign: data.horizontalAlign || 'left',
      verticalAlign: data.verticalAlign || 'top',
    }
  })
}

export async function getTextboxAnnotationsByQuestionScore(questionScoreId: string): Promise<TextboxAnnotation[]> {
  return await prisma.textboxAnnotation.findMany({
    where: { questionScoreId },
    orderBy: { createdAt: 'asc' }
  })
}

export async function updateTextboxAnnotation(id: string, data: TextboxUpdateData): Promise<TextboxAnnotation> {
  return await prisma.textboxAnnotation.update({
    where: { id },
    data: {
      ...data,
      updatedAt: new Date()
    }
  })
}

export async function deleteTextboxAnnotation(id: string): Promise<void> {
  await prisma.textboxAnnotation.delete({
    where: { id }
  })
}

export async function deleteTextboxAnnotationsByQuestionScore(questionScoreId: string): Promise<void> {
  await prisma.textboxAnnotation.deleteMany({
    where: { questionScoreId }
  })
}
```

#### 3.2 IPCハンドラー追加 (`/electron-src/ipc-handlers/textbox-handlers.ts`)
```typescript
import { ipcMain } from 'electron'
import * as textboxService from '../lib/prisma/textboxAnnotation'

export function setupTextboxHandlers() {
  ipcMain.handle('textbox:create', async (_, data) => {
    return await textboxService.createTextboxAnnotation(data)
  })

  ipcMain.handle('textbox:getByQuestionScore', async (_, questionScoreId) => {
    return await textboxService.getTextboxAnnotationsByQuestionScore(questionScoreId)
  })

  ipcMain.handle('textbox:update', async (_, id, data) => {
    return await textboxService.updateTextboxAnnotation(id, data)
  })

  ipcMain.handle('textbox:delete', async (_, id) => {
    return await textboxService.deleteTextboxAnnotation(id)
  })

  ipcMain.handle('textbox:deleteByQuestionScore', async (_, questionScoreId) => {
    return await textboxService.deleteTextboxAnnotationsByQuestionScore(questionScoreId)
  })
}
```

#### 3.3 ElectronAPIの型定義更新 (`/types/electron.d.ts`)
```typescript
interface ElectronAPI {
  // 既存のAPI...
  textbox: {
    create: (data: TextboxCreateData) => Promise<TextboxAnnotation>
    getByQuestionScore: (questionScoreId: string) => Promise<TextboxAnnotation[]>
    update: (id: string, data: TextboxUpdateData) => Promise<TextboxAnnotation>
    delete: (id: string) => Promise<void>
    deleteByQuestionScore: (questionScoreId: string) => Promise<void>
  }
}
```

### Phase 4: textbox-on-canvas-v3のロジック移植 🎨

#### 4.1 ユーティリティファイルの移植
- `/components/projects/07-score-at-once/ScoringIndividual/utils/textConversionUtils.ts`
  - `textbox-on-canvas-v3/utils/textConversionUtils.ts`を完全移植
- `/components/projects/07-score-at-once/ScoringIndividual/utils/mathJaxUtils.ts`
  - 高度なMathJax処理ロジックを移植
- `/components/projects/07-score-at-once/ScoringIndividual/utils/canvasTextUtils.ts`
  - Canvas描画関連の新規ユーティリティ

#### 4.2 既存テキストボックス実装の完全削除
- `DrawingElement`のテキスト関連機能を削除
- 既存のCanvas描画ロジックを削除
- SVG生成機能の削除

#### 4.3 新しいテキストボックスコンポーネント作成
```typescript
// /components/projects/07-score-at-once/ScoringIndividual/TextboxCanvas.tsx
export interface TextboxCanvasProps {
  imageUrl: string
  cropRegion: CropRegion
  questionScoreId: string
  isReadOnly?: boolean
  onTextboxChange?: (textboxes: TextboxAnnotation[]) => void
}

export function TextboxCanvas({ imageUrl, cropRegion, questionScoreId, isReadOnly = false, onTextboxChange }: TextboxCanvasProps) {
  // textbox-on-canvas-v3のロジックを完全移植
  // - マウス操作によるテキストボックス作成
  // - MathJax処理
  // - SVG生成とオーバーレイ表示
  // - データベース連携
}
```

### Phase 5: フロントエンド統合 🔧

#### 5.1 カスタムフック作成
```typescript
// /components/projects/07-score-at-once/ScoringIndividual/hooks/useTextboxAnnotations.ts
export function useTextboxAnnotations(questionScoreId: string | null) {
  const [textboxes, setTextboxes] = useState<TextboxAnnotation[]>([])
  
  const loadTextboxes = useCallback(async () => {
    if (!questionScoreId) return
    const data = await window.electronAPI.textbox.getByQuestionScore(questionScoreId)
    setTextboxes(data)
  }, [questionScoreId])
  
  const saveTextbox = useCallback(async (textboxData: TextboxCreateData) => {
    const newTextbox = await window.electronAPI.textbox.create(textboxData)
    setTextboxes(prev => [...prev, newTextbox])
    return newTextbox
  }, [])
  
  const updateTextbox = useCallback(async (id: string, updateData: TextboxUpdateData) => {
    const updatedTextbox = await window.electronAPI.textbox.update(id, updateData)
    setTextboxes(prev => prev.map(tb => tb.id === id ? updatedTextbox : tb))
    return updatedTextbox
  }, [])
  
  const deleteTextbox = useCallback(async (id: string) => {
    await window.electronAPI.textbox.delete(id)
    setTextboxes(prev => prev.filter(tb => tb.id !== id))
  }, [])
  
  useEffect(() => {
    loadTextboxes()
  }, [loadTextboxes])
  
  return {
    textboxes,
    loadTextboxes,
    saveTextbox,
    updateTextbox,
    deleteTextbox
  }
}
```

#### 5.2 AnswerIndividualViewの更新
```typescript
// AnswerIndividualView.tsxにTextboxCanvasコンポーネントを統合
// QuestionScore.idの取得ロジック追加
// 既存のDrawingCanvas関連の削除
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