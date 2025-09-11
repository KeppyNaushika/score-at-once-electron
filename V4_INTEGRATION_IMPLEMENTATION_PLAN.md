# V4テキストボックス機能統合実装計画書

## 🎯 プロジェクト概要

textbox-on-canvas-v4で確立された高品質な数学式対応テキストボックス機能を、Score at Onceの以下の2つのモジュールに統合する：

1. **07-score-at-once（採点・個別採点）** - インタラクティブなテキストボックス編集機能
2. **08-export（PDF出力）** - 高品質なCanvas描画によるテキストボックスのPDF出力

## 📊 現状分析

### V4で確立された技術資産

#### ✅ 利用可能な技術コンポーネント
- **MathJax 4対応**: 高品質な数学式レンダリング
- **4段階プレビューシステム**: DIV → SVG → Image → Canvas
- **SVG→Canvas統合変換**: `svgToCanvasUtils.ts`による統一ロジック
- **テキスト変換エンジン**: Discord Markdown + LaTeX記法対応
- **カスタムフック**: Canvas管理とテキストボックス操作の分離
- **型安全性**: 270行の包括的型定義

#### ❌ 削除対象（既存の間違ったロジック）
- **07-score-at-once**: 現在のCanvas描画ロジック（`useImageCanvas.ts`内）
- **08-export**: 既存のテキスト描画処理（`pdfExport.ts`内）

## 🏗️ 実装アーキテクチャ

### 統合方針

```
textbox-on-canvas-v4/
├── utils/                    # 共有ユーティリティとして移植
│   ├── mathJaxUtils.ts      → /lib/textbox/
│   ├── textConversionUtils.ts → /lib/textbox/
│   ├── svgToCanvasUtils.ts  → /lib/textbox/
│   └── canvasUtils.ts       → /lib/textbox/
├── hooks/                   # 採点機能専用フックとして移植
│   ├── useCanvasManagement.ts → /components/projects/07-score-at-once/ScoringIndividual/hooks/
│   └── useTextBoxOperations.ts → /components/projects/07-score-at-once/ScoringIndividual/hooks/
├── components/              # プレビューコンポーネントは必要に応じて移植
└── types.ts                 # 型定義を既存型システムに統合
```

## 📋 実装タスク詳細

### Phase 1: 共有ライブラリの構築

#### Task 1.1: `/lib/textbox/` ディレクトリ作成
```bash
mkdir -p /lib/textbox/utils
mkdir -p /lib/textbox/hooks  
mkdir -p /lib/textbox/types
```

#### Task 1.2: コアユーティリティの移植
- **ファイル**: `mathJaxUtils.ts`, `textConversionUtils.ts`, `svgToCanvasUtils.ts`, `canvasUtils.ts`
- **修正点**: 
  - import パスの修正
  - CLAUDE.md設計方針に従った配置
  - 既存プロジェクトとの型互換性確保

#### Task 1.3: 型定義の統合
- V4の270行の型定義を既存型システムに統合
- `TextBox`, `RenderingStatus`, `SvgConversionOptions` などの型を追加
- 既存型との重複を解決

### Phase 2: 07-score-at-once統合

#### Task 2.1: 既存Canvas描画ロジックの削除
**削除対象ファイル**:
- `/components/projects/07-score-at-once/ScoringIndividual/hooks/useImageCanvas.ts`（部分削除）
- `/components/projects/07-score-at-once/ScoringIndividual/utils/canvasTextRendererV3.ts`
- その他の間違ったCanvas描画関連ファイル

#### Task 2.2: V4フックの統合
**移植対象**:
```typescript
// useCanvasManagement.ts → useTextboxCanvasManagement.ts
export interface TextboxCanvasManagementHook {
  canvasRef: React.RefObject<HTMLCanvasElement>
  status: RenderingStatus
  renderTextToCanvas: (options: TextRenderOptions) => Promise<void>
  redrawCanvas: (elements: TextboxElement[]) => Promise<void>
}

// useTextBoxOperations.ts → useTextboxOperations.ts  
export interface TextboxOperationsHook {
  textBoxes: TextboxElement[]
  selectedTextBoxId: string | null
  handleMouseDown: (e: React.MouseEvent, zoom: number) => void
  // ... その他のV4で確立されたインターフェース
}
```

#### Task 2.3: 採点機能との統合
- 既存の描画要素（`DrawingElement`）とテキストボックス（`TextBox`）の統合
- データベース永続化機能の統合
- 採点ワークフローとの連携

### Phase 3: 08-export/PDF出力統合

#### Task 3.1: 既存PDF出力ロジックの修正
**修正対象**: `/electron-src/lib/prisma/pdfExport.ts`
- 間違ったテキスト描画処理を削除
- V4のSVG→Canvas変換ロジックに置き換え

#### Task 3.2: 高品質Canvas描画の実装
```typescript
// PDF出力専用のCanvas描画関数
export async function renderTextboxesToPDF(
  textboxes: TextboxElement[],
  baseImage: HTMLImageElement,
  options: PDFRenderOptions
): Promise<HTMLCanvasElement> {
  // V4のsvgToCanvasUtilsを使用した高品質レンダリング
  // MathJax defs補完による数式の完全再現
  // Canvas APIによる高解像度出力
}
```

#### Task 3.3: プログレス表示との統合
- 既存のプログレス表示機能との連携
- V4の`RenderingStatusManager`クラスの活用

### Phase 4: テスト・検証・最適化

#### Task 4.1: 統合テストの実装
- V4機能の採点画面での動作確認
- PDF出力品質の検証
- 数学式レンダリング精度の確認

#### Task 4.2: パフォーマンス最適化
- テキストレンダリングキャッシュの活用
- メモリ効率の改善
- 大量テキストボックス処理の最適化

## 🔧 技術実装詳細

### 数学式処理フロー

```typescript
// 統合後の数学式処理フロー
const processMathematicalText = async (text: string) => {
  // 1. テキスト前処理（LaTeX記法正規化）
  const normalizedText = preprocessMathSyntax(text)
  
  // 2. Discord Markdown変換
  const htmlContent = parseDiscordMarkdown(normalizedText)
  
  // 3. MathJax処理
  await processMathJaxContent(container, htmlContent)
  
  // 4. SVG生成
  const svgElement = await convertTextToSvg(text, width, height)
  
  // 5. Canvas描画（採点機能・PDF出力共通）
  return await renderSvgToCanvas(svgElement, ctx, options)
}
```

### Canvas描画の統一

```typescript
// 採点機能・PDF出力で共通使用するCanvas描画関数
export async function renderTextboxElement(
  element: TextboxElement,
  ctx: CanvasRenderingContext2D,
  options: {
    x: number
    y: number
    width: number
    height: number
    horizontalAlign?: 'left' | 'center' | 'right'
    verticalAlign?: 'top' | 'center' | 'bottom'
  }
): Promise<RenderResult> {
  // V4で確立されたSVG→Canvas変換ロジックを使用
  // MathJax defs補完による数式の完全再現
  // アスペクト比維持スケーリング
}
```

## 📁 ファイル構造（実装後）

```
/lib/textbox/                        # V4機能の共有ライブラリ
├── utils/
│   ├── mathJaxUtils.ts              # MathJax処理（V4移植）
│   ├── textConversionUtils.ts       # テキスト変換（V4移植）
│   ├── svgToCanvasUtils.ts          # SVG変換統合（V4移植）
│   └── canvasUtils.ts               # Canvas描画（V4移植）
├── hooks/
│   ├── useTextboxCanvasManagement.ts # Canvas管理（V4移植・改良）
│   └── useTextboxOperations.ts      # テキストボックス操作（V4移植・改良）
├── types/
│   └── textbox-types.ts             # V4型定義の統合版
└── index.ts                         # 統合エクスポート

/components/projects/07-score-at-once/ScoringIndividual/
├── hooks/
│   ├── useTextboxIntegration.ts     # V4機能と採点機能の統合フック
│   └── useTextboxPersistence.ts    # データベース永続化フック
├── components/
│   ├── TextboxEditor.tsx            # V4テキストボックスエディター
│   └── TextboxPreview.tsx           # V4プレビューコンポーネント統合
└── utils/
    └── textbox-scoring-bridge.ts   # 採点機能とのブリッジ

/electron-src/lib/export/textbox/     # PDF出力用テキストボックス処理
├── textbox-pdf-renderer.ts         # V4 Canvas描画のPDF統合
├── textbox-export-utils.ts         # PDF出力専用ユーティリティ
└── textbox-quality-optimizer.ts    # 高品質出力最適化
```

## ⚠️ 注意事項・制約

### 削除する必要がある既存コード

1. **useImageCanvas.ts内のテキスト描画処理**
   - `calculateOptimalFontSizeV3`関連
   - `useTextRenderCache`関連
   - Canvas描画の間違った実装

2. **pdfExport.ts内のテキスト処理**
   - 既存のテキスト描画ロジック
   - 品質の低いCanvas処理

### データベース連携

- 既存の`DrawingElement`型とV4の`TextBox`型の統合
- `drawingAnnotation`テーブルへの永続化対応
- 楽観的更新との整合性確保

### 互換性維持

- 既存の採点ワークフローとの完全互換性
- キーボードショートカットとの統合
- プロジェクト間でのデータ移行

## 🎯 期待される成果

### 機能向上

1. **数学式採点の高品質化**: MathJax 4による完璧な数式レンダリング
2. **PDF出力品質の向上**: V4のCanvas描画による高解像度出力
3. **開発効率の向上**: 統一されたテキストボックス処理ロジック

### 技術的成果

1. **コード重複の解消**: V4で確立されたロジックの再利用
2. **保守性の向上**: 責任分離による明確なアーキテクチャ
3. **拡張性の確保**: 将来の機能追加に対応した設計

## 📅 実装スケジュール（推定）

- **Phase 1（共有ライブラリ）**: 2-3日
- **Phase 2（採点機能統合）**: 3-4日  
- **Phase 3（PDF出力統合）**: 2-3日
- **Phase 4（テスト・最適化）**: 2-3日

**合計**: 9-13日程度

## 🚀 開始準備

このマスタープランに基づいて、各Phaseを段階的に実装していきます。実装開始前に：

1. 既存の間違ったCanvas描画ロジックの完全な特定・削除
2. V4アーキテクチャの詳細理解
3. 統合後の型システム設計の確認

V4で確立された高品質な数学式対応テキストボックス機能を、Score at Onceの中核機能として完全統合することで、プロダクションレベルの採点・出力システムを実現します。