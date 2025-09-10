# レポート: textbox-mathjax機能の動作不具合の分析

## 概要

正常に動作している `/Users/keppy/dev/score-at-once-electron/app/textbox-on-canvas-v3` と現在の採点システムにおけるtextbox-mathjax統合の違いを詳細に分析し、動作不具合の原因を特定しました。また、PDF出力要件を考慮したCanvas描画機能の必要性についても検討します。

## 🎯 主要な発見事項

### 1. **アーキテクチャの根本的な違い**

| 項目 | textbox-on-canvas-v3（正常動作） | 採点システム（不具合あり） |
|------|--------------------------------|---------------------------|
| **レンダリング方式** | 直接的なSVGオーバーレイ配置 | Canvas経由での間接的描画 |
| **MathJax処理** | 専用DOM容器での直接処理 | キャッシュシステム経由での複層処理 |
| **座標変換** | シンプルな1段階変換 | 複数段階の複雑な変換 |
| **DOM管理** | 永続的な共有容器 | 一時的な容器の作成/削除 |

### 2. **処理フローの比較**

#### ✅ 正常動作版 (textbox-on-canvas-v3)
```
テキスト入力 → parseTextWithMath() → getSharedMathJaxContainer() 
→ processMathJaxContent() → convertTextToSvg() → renderSvgAsOverlay()
```

#### ❌ 採点システム版 (不具合あり)
```
テキスト入力 → useTextRenderCache() → canvasTextRendererV3() 
→ convertTextToSvg() → renderSvgToCanvasV3() → Canvas描画
```

## 🚨 特定された主要問題

### 1. **MathJax処理の非同期タイミング問題**

**正常動作版:**
```typescript
// app/textbox-on-canvas-v3/utils/textConversionUtils.ts:210
export async function processMathJaxContent(
  container: HTMLDivElement,
  htmlContent: string,
): Promise<void> {
  container.innerHTML = htmlContent
  await waitForRenderingComplete()
  await processMathJax(container)      // ✅ 正しく待機
  cleanupElementStyles(container)
  await waitForRenderingComplete(1)
}
```

**採点システム版:**
```typescript
// components/projects/07-score-at-once/ScoringIndividual/hooks/useImageCanvas.ts:277
handleTextPreRender([element], baseImg)  // ❌ awaitなしで非同期実行
// すぐにフォールバック描画を実行（MathJax処理完了を待機せず）
```

### 2. **DOM容器管理の不整合**

**正常動作版:**
```typescript
// 永続的な共有容器（適切な管理）
let sharedMathJaxContainer: HTMLDivElement | null = null

function getSharedMathJaxContainer(): HTMLDivElement {
  if (!sharedMathJaxContainer || !document.body.contains(sharedMathJaxContainer)) {
    // 適切なスタイル設定で容器を作成
    sharedMathJaxContainer = document.createElement("div")
    // ... 詳細な設定
    document.body.appendChild(sharedMathJaxContainer)
  }
  return sharedMathJaxContainer
}
```

**採点システム版:**
```typescript
// components/projects/07-score-at-once/ScoringIndividual/utils/canvasTextRendererHybrid.ts:138
async function measureMathJaxContentSize(...) {
  const tempDiv = document.createElement('div')  // ❌ 毎回新しい容器を作成
  // ... 処理後
  document.body.removeChild(tempDiv)             // ❌ すぐに削除
}
```

### 3. **キャッシュシステムの設計不良**

**問題のあるキャッシュ実装:**
```typescript
// components/projects/07-score-at-once/ScoringIndividual/hooks/useTextRenderCache.ts
const processedText = element.text  // ❌ LaTeX正規化が実行されていない
const svgElement = await convertTextToSvg(processedText, ...)
```

キャッシュがMathJax処理完了前のHTMLを保存している可能性があります。

### 4. **座標変換の複雑性**

**正常動作版（シンプル）:**
```typescript
// 直接的なSVG配置
clonedSvg.style.left = `${canvasRect.left + x * scale}px`
clonedSvg.style.top = `${canvasRect.top + y * scale}px`
```

**採点システム版（複雑）:**
```typescript
// 複数段階の座標変換
const currentX = displayX * baseImg.naturalWidth + offsetX
const currentY = displayY * baseImg.naturalHeight + offsetY
// さらにズーム変換、Canvas変換等が続く
```

### 5. **MathJax設定の不整合**

**正常動作版:**
```typescript
// 包括的なMathJax overflow設定
const MATHJAX_OVERFLOW_CSS = `
  mjx-container[jax="SVG"] > svg { overflow: visible !important; }
  mjx-container svg { overflow: visible !important; }
`
```

**採点システム版:**
MathJax設定がキャッシュ経由で適用されるため、設定の適用タイミングが不安定。

## 📊 ファイル構造比較

### 正常動作版のファイル構造
```
/app/textbox-on-canvas-v3/
├── TextboxCanvasPage.tsx           # 665行 - 完全統合されたUI
├── types.ts                        # 132行 - 明確な型定義
├── constants.ts                    # 120行 - 統一された設定
└── utils/
    ├── textConversionUtils.ts      # 483行 - 包括的なテキスト処理
    ├── mathJaxUtils.ts            # 214行 - 専門的なMathJax処理
    ├── canvasUtils.ts             # 261行 - Canvas描画ユーティリティ
    └── coordinateUtils.ts         # 座標変換ユーティリティ
```

### 採点システム統合版のファイル構造
```
/components/projects/07-score-at-once/ScoringIndividual/
├── RichTextEditorModalV3.tsx      # 375行 - V3統合UI
├── AnswerIndividualView.tsx       # メインビュー
├── hooks/
│   ├── useImageCanvas.ts          # Canvas管理 - 複雑な統合
│   └── useTextRenderCache.ts      # キャッシュ管理 - 問題の源泉
└── utils/
    ├── canvasTextRendererV3.ts    # 273行 - V3統合レンダラー
    └── canvasTextRendererHybrid.ts # 557行 - 独立レンダラー
```

## 🔧 PDF出力要件とCanvas描画の必要性

### 現状の分析

現在のtextbox-on-canvas-v3は表示に特化したSVGオーバーレイ方式を採用していますが、PDF出力機能を考慮すると以下の課題があります：

#### 1. **表示と出力の乗離**
- **表示**: SVGオーバーレイ（完璧に動作）
- **出力**: Canvas描画が必要（現在未実装）

#### 2. **PDF出力ワークフロー**
```
答案画像 + テキストボックス → Canvas合成 → PDF生成
```

この工程では、SVGオーバーレイではなく、Canvas上での描画が必須となります。

### textbox-on-canvas-v3への必要な拡張

#### 1. **Canvas描画機能の追加**

現在のtextbox-on-canvas-v3に以下の機能を追加する必要があります：

```typescript
// 将来必要になるCanvas描画API
export async function renderTextToCanvas(
  text: string,
  canvas: HTMLCanvasElement,
  x: number, y: number, 
  width: number, height: number,
  options?: {
    horizontalAlign?: 'left' | 'center' | 'right'
    verticalAlign?: 'top' | 'center' | 'bottom'
    fontSize?: number
    color?: string
  }
): Promise<void> {
  // 1. 既存のSVG生成機能を活用
  const svgElement = await convertTextToSvg(
    text, width, height, 
    options?.horizontalAlign, options?.verticalAlign
  )
  
  // 2. SVG→Canvas描画（新規実装が必要）
  await renderSvgToCanvas(svgElement, canvas, x, y, width, height)
}
```

#### 2. **統一されたレンダリングエンジン**

```typescript
export interface TextboxRenderer {
  // 表示用（既存機能）
  renderForDisplay(container: HTMLElement): Promise<SVGSVGElement>
  
  // 出力用（新規機能）
  renderForExport(canvas: HTMLCanvasElement, bounds: Rect): Promise<void>
}
```

#### 3. **現在のcanvasUtils.tsの拡張**

既存の`canvasUtils.ts`（261行）は以下の機能を持っています：
- `renderSvgToCanvas()` - 基本的なSVG→Canvas変換
- `drawTextBoxBorder()` - テキストボックス枠描画
- `setupDebugPreview()` - デバッグ機能

これらを拡張して、MathJax SVGの高品質Canvas描画に対応する必要があります。

## 🎯 推奨修正戦略

### 段階1: 緊急修正（採点システム）
1. **MathJax処理タイミング修正**
   - `useTextRenderCache.ts`での非同期処理を適切に待機
   - キャッシュキー生成時のLaTeX正規化を確実に実行

2. **DOM容器管理の改善**
   - 永続的なMathJax容器の採用
   - 容器スタイルの統一

### 段階2: 中期修正（統合改善）
1. **textbox-on-canvas-v3のCanvas描画機能追加**
   - 既存のSVG生成機能を活用したCanvas描画API
   - 高品質なMathJax SVG→Canvas変換機能

2. **採点システムの簡素化**
   - 複雑なキャッシュシステムの見直し
   - textbox-on-canvas-v3への依存度向上

### 段階3: 長期修正（アーキテクチャ統一）
1. **統一されたレンダリングアーキテクチャ**
```
textbox-on-canvas-v3:
├── 表示モード: SVGオーバーレイ（既存）
├── 出力モード: Canvas描画（新規）
└── 共通基盤: MathJax処理、テキスト解析（既存）

採点システム:
├── 表示: textbox-on-canvas-v3の表示モード使用
├── 出力: textbox-on-canvas-v3の出力モード使用
└── UI統合: 既存のRichTextEditorModalV3を継続使用
```

2. **PDF出力パイプライン完成**
```
テキスト入力 → textbox-on-canvas-v3処理 → Canvas描画 → PDF生成
```

## 💡 結論

### 根本原因
採点システムが正常動作するtextbox-on-canvas-v3の直接的なSVG描画方式を、複雑なCanvas変換システムで置き換えようとしていることが主要な問題です。MathJaxのSVG要素をCanvas経由で描画する過程で、MathJax処理の非同期性と座標変換の複雑性により、正確な描画ができていません。

### PDF出力要件の考慮
しかし、PDF出力機能を考慮すると、最終的にはCanvas描画が必要になるため、以下の対応が必要です：

1. **textbox-on-canvas-v3側**: Canvas描画機能の追加実装
2. **採点システム側**: MathJax統合問題の修正
3. **両システム**: 統一されたAPIでの運用

### 最優先対応
1. **短期**: 採点システムのMathJax処理タイミング問題を修正
2. **中期**: textbox-on-canvas-v3にCanvas描画機能を追加
3. **長期**: 両システムを統一されたレンダリングアーキテクチャで統合

この段階的なアプローチにより、表示機能の即座の修正と、将来のPDF出力機能の両方を確実に実現できます。

---

**作成日**: 2025年9月10日  
**分析対象**: textbox-on-canvas-v3 vs 採点システム統合  
**ファイル数**: 30+個のtextbox/mathjax関連ファイル  
**主要課題**: MathJax非同期処理、Canvas統合、PDF出力対応