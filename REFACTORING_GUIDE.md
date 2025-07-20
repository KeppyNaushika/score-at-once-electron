# 📋 大規模ファイルリファクタリング・プロンプト

あなたは Next.js + TypeScript + Electron アプリケーションの専門的なリファクタリングエンジニアです。以下の要件に従って、指定されたページの包括的なリファクタリングを実行してください。

## 🎯 リファクタリング対象

以下のページから1つを担当してください：

### 📋 対象ページ一覧

- `02-template` - 採点領域作成ページ (521行) 🔴 **高優先度**
- `03-region-info` - 領域情報ページ (390行) 🔴 **高優先度**
- `04-question-group` - 設問グループ管理ページ
- `05-students` - 受験生徒管理ページ
- `06-answer-sheets` - 答案アップロードページ (331行) 🔴 **高優先度**
- `07-score-at-once` - 採点実行ページ (大規模・複雑)
- `08-export` - 結果出力ページ

### 🎯 優先度

1. **🔴 高優先度**: 500行超の大規模ファイル (02, 03, 06)
2. **🟡 中優先度**: 300-500行のファイル (05, 08)
3. **🟢 低優先度**: 複雑度が高いが行数が少ないファイル (04, 07)

**重要**: 他のClaudeクライアントと重複しないよう、開始前にどのページを担当するかコメントで宣言してください。

### 🗣️ 担当宣言方法

チームメンバーに以下の形式でコメントしてください：

```
🚀 [担当者名] が [XX-PageName] ページのリファクタリングを開始します
- 予想完了時間: XX時間
- 開始日時: YYYY/MM/DD HH:MM
```

**例**:

```
🚀 Claude-A が 02-template ページのリファクタリングを開始します
- 予想完了時間: 2-3時間
- 開始日時: 2025/07/20 22:30
```

## 📂 リファクタリング手順

### 1. ブランチ作成

```bash
git checkout -b refactor/[PAGE-NAME]-page
```

### 2. ファイル探索・分析

以下を包括的に調査してください：

- メインページファイル (`/app/projects/[projectId]/[PAGE]/page.tsx`)
- 関連コンポーネント (`/components/projects/[PAGE]/`)
- カスタムフック (`/hooks/`)
- 型定義ファイル (`/types/`)
- ユーティリティ関数

### 3. 新しいディレクトリ構造作成

```
/components/projects/[PAGE]/
├── components/          # UIコンポーネント
│   ├── ComponentName.tsx
│   └── index.ts        # 統合エクスポート
├── hooks/              # カスタムフック
│   └── useFeatureName.ts
├── types/              # 型定義
│   └── index.ts
├── utils/              # ユーティリティ関数
│   ├── categoryUtils.ts
│   └── validation.ts
└── index.ts           # モジュール統合エクスポート
```

## 📝 ドキュメント要件

### 全関数にTypeDoc形式のコメント追加

```typescript
/**
 * 関数の目的・機能の説明
 *
 * より詳細な説明がある場合はここに記述
 *
 * @param paramName - パラメータの説明
 * @param options - オプションパラメータの説明
 * @returns 返り値の説明
 * @throws エラーが発生する条件があれば記述
 */
```

### コンポーネントドキュメント例

```typescript
/**
 * ComponentName - コンポーネントの目的
 *
 * 機能:
 * - 主要機能1の説明
 * - 主要機能2の説明
 * - エラーハンドリング
 *
 * @param prop1 - プロパティ1の説明
 * @param prop2 - プロパティ2の説明
 * @returns JSXコンポーネント
 */
```

## 🔧 分割基準

### ファイル分割の判断基準

- **200行以上**: 分割を検討
- **500行以上**: 必須分割
- **複数責任**: 異なる機能が混在
- **再利用性**: 他で使用される可能性

### 分割方法

1. **型定義抽出** → `types/index.ts`
2. **定数抽出** → `constants.ts` (必要に応じて)
3. **ユーティリティ関数** → `utils/categoryName.ts`
4. **カスタムフック** → `hooks/useFeatureName.ts`
5. **UIコンポーネント** → `components/ComponentName.tsx`

## 📋 TypeScript型定義

### 必須インターフェース例

```typescript
// Props型定義
export interface [Component]Props {
  // 必須プロパティ
  requiredProp: string
  // オプションプロパティ
  optionalProp?: number
  // コールバック関数
  onAction: (data: ActionData) => void
}

// 状態管理型定義
export interface [Feature]State {
  data: DataType[]
  loading: boolean
  error: string | null
}
```

## ⚡ パフォーマンス要件

### React最適化

- `useCallback` - 関数メモ化
- `useMemo` - 計算値メモ化
- `React.memo` - コンポーネントメモ化
- 適切な依存配列設定

### 状態管理

- 最小限の状態スライス
- 適切な状態更新関数
- 副作用の分離

## 🚀 ファイル命名規則

### コンポーネント

- **ファイル名**: `PascalCase.tsx` (例: `UploadProgressModal.tsx`)
- **React関数コンポーネント名**: PascalCase

### フック

- **ファイル名**: `camelCase.ts` (例: `useFileUpload.ts`)
- **関数名**: camelCase

### ユーティリティ

- **ファイル名**: `camelCase.ts` (例: `fileValidation.ts`)
- **関数名**: camelCase

### 型定義

- **ファイル名**: `index.ts` で統合エクスポート
- **型名**: PascalCase

## 📦 エクスポート構造

### コンポーネントindex.ts

```typescript
/**
 * [PAGE] コンポーネントの統合エクスポート
 */
export { ComponentA } from "./component-a"
export { ComponentB } from "./component-b"
```

### メインindex.ts

```typescript
/**
 * [PAGE] モジュールの統合エクスポート
 */
// コンポーネント
export * from "./components"
// フック
export { useFeature } from "./hooks/use-feature"
// ユーティリティ
export * from "./utils/feature-utils"
// 型定義
export type * from "./types"
```

## ✅ 完了チェックリスト

### コード品質

- [ ] 全関数にドキュメント追加完了
- [ ] 200行未満にファイル分割完了
- [ ] TypeScript型エラー0件
- [ ] ESLint警告の適切な対応
- [ ] ビルドエラー0件

### 機能保証

- [ ] 既存機能100%動作確認
- [ ] ユーザー操作の動作確認
- [ ] エラーハンドリング確認
- [ ] データ整合性確認

### Git作業

- [ ] 適切なブランチ名
- [ ] 段階的コミット
- [ ] 詳細なコミットメッセージ
- [ ] PR作成・マージ

## 🎯 品質目標

- **可読性**: 1ファイル1責任の原則
- **保守性**: 変更影響範囲の最小化
- **再利用性**: コンポーネント・フックの独立性
- **型安全性**: 厳密なTypeScript型定義
- **パフォーマンス**: 適切なReact最適化

## 🛠️ 実装例: 01-uploadページ（参考）

### 分割前

```
/app/projects/[projectId]/01-upload/page.tsx (125行)
/components/projects/01-upload/MasterImageManager.tsx (71行)
/components/projects/01-upload/MasterImageGallery.tsx (193行)
/hooks/useMasterImages.ts (382行)
```

### 分割後

```
/components/projects/01-upload/
├── components/
│   ├── FileUploadDropzone.tsx (249行)
│   ├── MasterImageCard.tsx (135行)
│   ├── MasterImageGallery.tsx (82行)
│   ├── MasterImageManager.tsx (79行)
│   └── index.ts (11行)
├── hooks/
│   └── useMasterImages.ts (330行)
├── types/
│   └── index.ts (133行)
├── utils/
│   ├── fileValidation.ts (111行)
│   ├── imageUtils.ts (119行)
│   └── passwordUtils.ts (147行)
└── index.ts (21行)
```

### 改善効果

- **可読性向上**: 各ファイル200行以下
- **型安全性**: 6個の詳細TypeScript型定義
- **再利用性**: モジュラー構造
- **保守性**: 責任分離による変更影響範囲限定

## 📋 最終成果物

以下の形式で完了報告してください：

```markdown
## ✅ [PAGE-NAME] リファクタリング完了

### 📊 実装統計

- **分割前**: XXX行 (X個のファイル)
- **分割後**: XXX行 (X個のファイル)
- **新規作成**: X個のコンポーネント、X個のフック、X個のユーティリティ

### 🏗️ 新しい構造

- `/components/` - X個のコンポーネント
- `/hooks/` - X個のカスタムフック
- `/types/` - X個の型定義
- `/utils/` - X個のユーティリティ

### ✨ 改善点

- 機能A: 詳細説明
- 機能B: 詳細説明

### 🔧 技術的成果

- TypeScript型定義: X個追加
- コンポーネント分割: X個作成
- パフォーマンス最適化: useCallback/useMemo適用
- エラーハンドリング: 包括的対応

### 📈 品質指標

- ファイル平均行数: XXX行 → XXX行
- 型安全性: XX%向上
- 再利用可能コンポーネント: X個
- ドキュメント化率: 100%
```

## 🚨 重要な注意事項

### 💻 複数Claudeクライアント同時実行

1. **ブランチ競合回避**: 必ず異なるページを担当
2. **コミュニケーション**: 進捗状況を定期的に共有
3. **依存関係確認**: 共通コンポーネント変更時は調整
4. **マージ順序**: 完了したものから順次PR・マージ

### 🔧 実装品質

1. **機能変更厳禁**: 既存機能は一切変更しないこと
2. **段階的実装**: 小さな単位でコミット・テスト
3. **型安全性優先**: any型の使用を避ける
4. **パフォーマンス**: 不要な再レンダリングを防ぐ
5. **エラーハンドリング**: 包括的な例外処理
6. **ドキュメント**: 全関数にTypeDoc形式コメント必須

### 📊 進捗管理

各Claudeクライアントは以下の形式で進捗報告してください：

```
📊 [XX-PageName] 進捗報告 [XX%完了]
✅ 完了: ファイル探索・分析
🟡 進行中: コンポーネント分割
⏳ 予定: ドキュメント追加
```

---

**参考資料**:

- [01-uploadリファクタリング成果物](./components/projects/01-upload/)
- [CLAUDE.md - プロジェクト仕様書](./CLAUDE.md)
- [TypeScriptハンドブック](https://www.typescriptlang.org/docs/)

**開始前確認**: 担当ページを宣言し、他チームメンバーとの重複を避けてください。
