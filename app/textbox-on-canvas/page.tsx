/**
 * @fileoverview リファクタリング済みTextbox Canvas ページ
 * @description 学習可能で保守しやすい数学式対応テキストボックスCanvasシステム
 * 
 * ## アーキテクチャ概要
 * このシステムは以下のモジュール構成で学習しやすく設計されています：
 * 
 * ### 型定義・定数
 * - `types.ts` - TypeScript型定義とインターフェース
 * - `constants.ts` - アプリケーション全体で使用される定数
 * 
 * ### ユーティリティモジュール
 * - `utils/mathJaxUtils.ts` - MathJax数式処理とSVG生成
 * - `utils/textConversionUtils.ts` - ReactMarkdown統合とテキスト変換
 * - `utils/canvasUtils.ts` - Canvas描画とSVG-Canvas変換
 * - `utils/coordinateUtils.ts` - 座標変換とマウス操作
 * 
 * ### メインコンポーネント
 * - `TextboxCanvasPage.tsx` - UIとイベント処理の統合
 * 
 * ## 学習のポイント
 * 1. **関心の分離**: 各機能が独立したモジュールに分離
 * 2. **再利用性**: ユーティリティ関数の高い再利用性
 * 3. **型安全性**: TypeScriptによる完全な型チェック
 * 4. **保守性**: JSDoc形式の詳細なドキュメント
 * 5. **テスタビリティ**: 純粋関数による単体テストの容易さ
 */

import TextboxCanvasPage from './TextboxCanvasPage'

export default function Page() {
  return <TextboxCanvasPage />
}