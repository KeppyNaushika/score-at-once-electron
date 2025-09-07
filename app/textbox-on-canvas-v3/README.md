# 数学式対応テキストボックス Canvas システム

## 概要

このシステムは、数学式（MathJax）をサポートしたテキストボックスをCanvasに描画する高度なWebアプリケーションです。ReactMarkdown、MathJax、Canvas APIを統合し、高品質な数式レンダリングを実現しています。

## 🏗️ アーキテクチャ

### モジュール構成

```
textbox-on-canvas/
├── types.ts                    # TypeScript型定義
├── constants.ts                # 定数とコンフィグ
├── utils/
│   ├── mathJaxUtils.ts        # MathJax処理
│   ├── textConversionUtils.ts # テキスト変換
│   ├── canvasUtils.ts         # Canvas描画
│   └── coordinateUtils.ts     # 座標変換
├── TextboxCanvasPage.tsx      # メインコンポーネント
├── page.tsx                   # Next.jsページ
└── README.md                  # このファイル
```

### 設計原則

1. **単一責任原則** - 各モジュールは明確な責任を持つ
2. **関心の分離** - UI、ビジネスロジック、ユーティリティを分離
3. **依存性の逆転** - 高レベルモジュールは低レベルモジュールに依存しない
4. **開放閉鎖原則** - 拡張に開かれ、変更に閉じている

## 🧩 コンポーネント詳細

### 1. 型定義 (`types.ts`)

```typescript
interface TextBox {
  id: string
  x: number
  y: number
  width: number
  height: number
  text: string
  isSelected: boolean
}
```

**学習ポイント:**
- TypeScriptの型安全性を活用
- インターフェースによる契約の明確化
- データ構造の一貫性保証

### 2. 定数管理 (`constants.ts`)

```typescript
export const FONT_SETTINGS = {
  DEFAULT_SIZE: 24,
  DEFAULT_LINE_HEIGHT: 1,
  // ...
} as const
```

**学習ポイント:**
- マジックナンバーの排除
- `as const` による型推論の強化
- 設定の一元管理

### 3. MathJax処理 (`utils/mathJaxUtils.ts`)

**主要機能:**
- MathJax数式の組版処理
- 非同期レンダリング待機
- 動的サイズ測定

**学習ポイント:**
```typescript
export async function measureMathJaxContentSize(
  htmlContent: string,
  initialWidth: number,
  initialHeight: number
): Promise<MeasuredSize>
```

- 非同期処理の適切な管理
- DOM測定のタイミング制御
- MathJaxライフサイクルの理解

### 4. テキスト変換 (`utils/textConversionUtils.ts`)

**技術スタック:**
- ReactMarkdown
- MutationObserver
- DOM操作

**学習ポイント:**
```typescript
export async function convertTextToSvg(
  text: string,
  _width: number,
  _height: number
): Promise<SVGSVGElement | null>
```

- MutationObserverによるDOM変更検出
- Reactの動的レンダリング
- Promise-basedな非同期制御

### 5. Canvas描画 (`utils/canvasUtils.ts`)

**主要機能:**
- SVG-Canvas変換
- アスペクト比維持スケーリング
- デバッグ機能

**学習ポイント:**
```typescript
export async function renderSvgToCanvas(
  svgElement: SVGSVGElement,
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  textBoxWidth: number, textBoxHeight: number
): Promise<SvgRenderResult>
```

- Canvas APIの高度な使用
- 画像変換処理
- 数学的な座標計算

### 6. 座標変換 (`utils/coordinateUtils.ts`)

**主要機能:**
- マウス座標-Canvas座標変換
- テキストボックス操作
- 衝突判定

**学習ポイント:**
- 座標系の理解
- 幾何学的計算
- イミュータブルな状態更新

## 🔬 技術的深堀り

### MathJax統合の課題と解決

**問題:** MathJax処理のタイミング制御
**解決:** `typesetPromise` + `MutationObserver`

```typescript
// MathJax処理完了を確実に待機
await MJ.typesetPromise([tempDiv])
await waitForRenderingComplete(2)
```

### 高精度サイズ測定

**問題:** 分数等の複雑な数式で下部が切れる
**解決:** 実際の描画結果からの動的測定

```typescript
// 複数の測定方法を組み合わせ
const boundingRect = tempDiv.getBoundingClientRect()
const scrollSize = { width: tempDiv.scrollWidth, height: tempDiv.scrollHeight }
// 最大値を採用
actualHeight = Math.max(height, Math.ceil(Math.max(
  boundingRect.height, 
  scrollSize.height, 
  maxMathJaxHeight
)))
```

### Canvas高品質レンダリング

**技術:** SVG → Blob → Image → Canvas

```typescript
const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' })
const svgUrl = URL.createObjectURL(svgBlob)
// アスペクト比維持スケーリング
const scale = Math.min(scaleX, scaleY)
```

## 🚀 使用方法

### 基本操作

1. **テキストボックス作成:** Canvas上でドラッグ
2. **テキスト編集:** テキストボックスをダブルクリック
3. **数式入力:** `$x^2$` (インライン) または `$$\int x dx$$` (ブロック)

### 数式記法

| 記法 | 出力 | 用途 |
|------|------|------|
| `$x^2$` | x² | インライン数式 |
| `$$\frac{a}{b}$$` | 分数 | ブロック数式 |
| `$\int_0^1 x dx$` | 積分 | インライン積分 |

### 高度な機能

- **Markdownサポート:** `**太字**`, `*斜体*`
- **リスト記法:** `- item1`
- **数式 + テキスト混在**

## 🧪 テスト戦略

### 単体テスト対象

1. **座標変換関数**
   ```typescript
   test('getCanvasCoordinates', () => {
     expect(getCanvasCoordinates(100, 100, canvas, 2))
       .toEqual({ x: 50, y: 50 })
   })
   ```

2. **テキストボックス操作**
   ```typescript
   test('createTextBoxFromDrag', () => {
     const drag = { startX: 0, startY: 0, currentX: 100, currentY: 50 }
     const textBox = createTextBoxFromDrag(drag)
     expect(textBox.width).toBe(100)
     expect(textBox.height).toBe(50)
   })
   ```

3. **MathJaxユーティリティ**
   - 非同期処理のモック
   - DOM操作のシミュレーション

## 🔧 拡張ポイント

### 新機能追加

1. **テキストボックススタイリング**
   ```typescript
   interface TextBoxStyle {
     backgroundColor: string
     borderColor: string
     borderWidth: number
   }
   ```

2. **エクスポート機能**
   ```typescript
   export async function exportCanvasAsPDF(canvas: HTMLCanvasElement): Promise<Blob>
   ```

3. **リアルタイム協調編集**
   ```typescript
   interface CollaborationState {
     users: User[]
     changes: Change[]
     conflicts: Conflict[]
   }
   ```

### パフォーマンス最適化

1. **キャッシュシステム**
   ```typescript
   const mathJaxCache = new Map<string, SVGSVGElement>()
   ```

2. **仮想化レンダリング**
   - 可視範囲のみ描画
   - 大量テキストボックス対応

3. **Web Workers活用**
   - MathJax処理のオフロード
   - SVG生成の並列化

## 📚 学習リソース

### 推奨学習順序

1. **基礎:** TypeScript, React Hooks
2. **Canvas API:** 2D描画、座標系
3. **数式処理:** MathJax, LaTeX記法
4. **非同期処理:** Promise, async/await
5. **DOM操作:** MutationObserver, 測定API

### 参考文献

- [MathJax Documentation](https://docs.mathjax.org/)
- [Canvas API Reference](https://developer.mozilla.org/docs/Web/API/Canvas_API)
- [ReactMarkdown Guide](https://github.com/remarkjs/react-markdown)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)

## 🐛 トラブルシューティング

### よくある問題

1. **数式が表示されない**
   - MathJaxの読み込み確認
   - `typesetPromise` の待機

2. **サイズ測定が不正確**
   - DOM挿入タイミングの確認
   - CSS適用状態の確認

3. **Canvas描画がぼやける**
   - デバイスピクセル比の考慮
   - 高DPI対応

### デバッグ手順

1. コンソールログでフロー確認
2. デバッグプレビューで中間結果確認
3. ブレークポイントでステップ実行
4. React Developer Toolsで状態確認

## 🎯 まとめ

このシステムは複数の高度な技術を組み合わせた実践的な学習材料です。モジュール設計、非同期処理、Canvas描画、数式処理など、フロントエンド開発の重要な概念を包括的に学習できます。

各コンポーネントが独立しているため、段階的な理解と拡張が可能です。実際のプロダクト開発でも通用する設計パターンとコード品質を維持しています。