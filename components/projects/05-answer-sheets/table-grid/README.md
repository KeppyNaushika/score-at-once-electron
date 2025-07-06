# TableDndKitAnswerGrid コンポーネント構成

## 📁 ファイル階層

```
table-grid/
├── TableDndKitAnswerGrid.tsx          # メインコンテナコンポーネント
├── types.ts                           # ローカル型定義
├── README.md                          # このファイル
├── components/                        # UIコンポーネント群
│   ├── index.ts                      # エクスポートファイル
│   ├── FilePreviewCell.tsx           # ファイルプレビューセル
│   ├── SortableTableCell.tsx         # ドラッグ可能なテーブルセル
│   ├── EmptyTableCell.tsx            # 空のテーブルセル
│   ├── TableHeader.tsx               # テーブルヘッダー
│   ├── PlacementStrategySelector.tsx # 配置戦略選択
│   └── PreviewModeToggle.tsx         # プレビューモード切替
└── hooks/                            # カスタムフック群
    ├── index.ts                      # エクスポートファイル
    ├── useNameRegion.ts              # 氏名欄処理
    ├── useDisabledState.ts           # 無効化状態管理
    ├── useTableData.ts               # テーブルデータ管理
    └── useDragAndDrop.ts             # ドラッグ&ドロップ
```

## 🔗 親子関係

### 1. メインコンテナ
- **TableDndKitAnswerGrid.tsx**: 最上位コンポーネント
  - 全てのhooksとcomponentsを統合
  - DndContextの管理
  - 状態の調整

### 2. UIコンポーネント層
```
TableDndKitAnswerGrid
├── TableHeader                    # ヘッダー部分
│   ├── TrashDropZone             # ゴミ箱（外部コンポーネント）
│   ├── PlacementStrategySelector # 配置戦略選択
│   └── PreviewModeToggle         # プレビューモード切替
└── Table                         # テーブル本体
    ├── SortableTableCell         # ファイル表示セル
    │   └── FilePreviewCell       # ファイルプレビュー内容
    └── EmptyTableCell            # 空セル
```

### 3. フック層
```
TableDndKitAnswerGrid
├── useNameRegion                 # 氏名欄関連処理
├── useDisabledState             # 無効化状態管理
├── useTableData                 # テーブルデータ生成
└── useDragAndDrop               # ドラッグ&ドロップ処理
```

## 📝 責任分離

### コンポーネント責任
- **FilePreviewCell**: ファイルの画像表示とUI状態
- **SortableTableCell**: ドラッグ機能とコンテキストメニュー  
- **EmptyTableCell**: 空セルの表示とアクション
- **TableHeader**: ヘッダー領域の統合UI
- **PlacementStrategySelector**: 配置戦略の選択UI
- **PreviewModeToggle**: プレビューモードの切替UI

### フック責任
- **useNameRegion**: 氏名欄領域の確認とCanvas描画
- **useDisabledState**: 行・列・セル・ファイルの無効化状態
- **useTableData**: テーブルデータの動的生成とファイル管理
- **useDragAndDrop**: ドラッグ&ドロップイベント処理

## 🔄 データフロー

```
Props (外部) 
    ↓
Hooks (状態管理・データ処理)
    ↓  
Components (UI表示)
    ↓
Events (ユーザー操作)
    ↓
Hooks (状態更新)
    ↓
Props callback (外部への通知)
```

## ✅ リファクタリングの成果

### Before (単一ファイル)
- **1ファイル**: ~1,500行
- **複雑な責任**: UI + ロジック + 状態管理が混在
- **保守性**: 低い
- **再利用性**: 困難

### After (分割構造)
- **13ファイル**: 平均 ~100行/ファイル
- **明確な責任**: 単一責任原則に従った分離
- **保守性**: 高い - 各ファイルが独立して変更可能
- **再利用性**: 高い - コンポーネント・フックの個別再利用可能
- **テスト容易性**: 向上 - 各機能を独立してテスト可能

## 🎯 使用方法

```tsx
import TableDndKitAnswerGrid from "./table-grid/TableDndKitAnswerGrid"

// 使用例
<TableDndKitAnswerGrid
  projectId={projectId}
  students={students}
  files={files}
  masterImageCount={masterImageCount}
  onFilesChange={setFiles}
  onUpload={handleUpload}
  // その他のprops...
/>
```

元の`TableDndKitAnswerGrid.tsx`は互換性維持のためのラッパーとして機能し、既存のコードを変更することなく新しい分割されたコンポーネントを使用できます。