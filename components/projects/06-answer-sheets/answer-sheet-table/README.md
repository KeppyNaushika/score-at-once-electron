# Answer Sheet Table Component

## 概要

答案配置テーブルコンポーネントの完全リファクタリング版です。ファイル階層の整理、適切な命名、@インポートの統一、および無駄なインポート構造の簡素化を行いました。

## ディレクトリ構造

```
answer-sheet-table/
├── README.md                              # このファイル
├── index.ts                               # メインエクスポート
├── answer-sheet-table.tsx                 # メインコンポーネント
├── types/
│   └── index.ts                           # 型定義（PreviewMode、ExtendedDisabledState等）
├── hooks/
│   ├── index.ts                           # フックエクスポート
│   ├── use-name-region.ts                 # 氏名欄領域管理フック
│   ├── use-disabled-state.ts              # 無効化状態管理フック
│   ├── use-table-data.ts                  # テーブルデータ生成フック
│   └── use-drag-drop.ts                   # ドラッグ&ドロップフック
└── components/
    ├── index.ts                           # コンポーネントエクスポート
    ├── file-preview-cell.tsx              # ファイルプレビューセル
    ├── sortable-table-cell.tsx            # ドラッグ可能テーブルセル
    ├── empty-table-cell.tsx               # 空テーブルセル
    ├── table-header.tsx                   # テーブルヘッダー
    ├── placement-strategy-selector.tsx    # 配置戦略選択
    └── preview-mode-toggle.tsx            # プレビューモード切り替え
```

## 主要な改善点

### 1. ファイル命名の統一

- **前**: `TableDndKitAnswerGrid.tsx` → **後**: `answer-sheet-table.tsx`
- **前**: `useNameRegion.ts` → **後**: `use-name-region.ts` 
- **前**: `useDragAndDrop.ts` → **後**: `use-drag-drop.ts`
- kebab-case への統一で一貫性を確保

### 2. インポート構造の簡素化

**前** (複雑な相対インポート):
```typescript
import { FilePreviewCell } from "./table-grid/components"
import { useNameRegion } from "./table-grid/hooks"
import type { PreviewMode } from "./table-grid/types"
```

**後** (統一された@インポート):
```typescript
import { FilePreviewCell } from "@/components/projects/05-answer-sheets/answer-sheet-table/components"
import { useNameRegion } from "@/components/projects/05-answer-sheets/answer-sheet-table/hooks"
import type { PreviewMode } from "@/components/projects/05-answer-sheets/answer-sheet-table/types"
```

### 3. 明確な階層構造

```
answer-sheet-table/               # メイン機能
├── types/                        # 型定義のみ
├── hooks/                        # ビジネスロジック
└── components/                   # UIコンポーネント
```

### 4. アルファベット順のインポート

```typescript
import { useCallback, useState } from "react"
import { Ban, Upload, X } from "lucide-react"

import { ContextMenu, ContextMenuContent } from "@/components/ui/context-menu"
import { TableCell } from "@/components/ui/table"
import type { SortableTableCellProps } from "@/components/projects/05-answer-sheets/answer-sheet-table/types"
```

## 使用方法

### 基本的な使用

```typescript
import { AnswerSheetTable } from "@/components/projects/05-answer-sheets/answer-sheet-table"

function MyComponent() {
  return (
    <AnswerSheetTable
      projectId="project-123"
      students={students}
      files={files}
      masterImageCount={3}
      fileOrder="page-first"
      onFilesChange={handleFilesChange}
      onUpload={handleUpload}
    />
  )
}
```

### 後方互換性

既存のコードは `TableDndKitAnswerGrid` ラッパーコンポーネントで継続利用可能:

```typescript
import TableDndKitAnswerGrid from "@/components/projects/05-answer-sheets/TableDndKitAnswerGrid"

// 既存のコードがそのまま動作
<TableDndKitAnswerGrid {...props} />
```

## コンポーネント責任分離

### Hooks（ビジネスロジック）

- **`use-name-region`**: 氏名欄領域の検出・クリッピング
- **`use-disabled-state`**: 行・列・セル・ファイルの無効化管理
- **`use-table-data`**: テーブルデータ生成・ソート・フィルタリング
- **`use-drag-drop`**: ドラッグ&ドロップイベント処理

### Components（UI表示）

- **`file-preview-cell`**: ファイル画像のプレビュー表示
- **`sortable-table-cell`**: ドラッグ可能なテーブルセル
- **`empty-table-cell`**: 空セルの表示・操作
- **`table-header`**: ヘッダー統合（戦略・プレビュー・ゴミ箱等）
- **`placement-strategy-selector`**: 配置戦略UI
- **`preview-mode-toggle`**: プレビューモード切り替えUI

## 型安全性の向上

### 統一された型定義

```typescript
// types/index.ts
export interface ExtendedDisabledState {
  rows: Set<number>
  cols: Set<number>
  positions: Set<number>
  files: Set<string>
}

export interface CellData {
  type: "file" | "empty" | "disabled"
  position: number
  student: UnifiedStudent | null
  pageNumber: number | null
  file?: UnifiedFile
}
```

### PlacementStrategy対応

全ての `PlacementStrategy` 型（`page-first`, `student-first`, `filename-auto`）に対応:

```typescript
export interface PlacementStrategySelectorProps {
  fileOrder: PlacementStrategy  // 制限なし
  onFileOrderChange?: (order: PlacementStrategy) => void
}
```

## パフォーマンス最適化

- **Clean exports**: `index.ts` による最適化されたエクスポート
- **Tree shaking**: 必要なコンポーネントのみインポート
- **Memo化**: 適切なuseCallback/useMemo使用
- **Intersection Observer**: 遅延画像読み込み対応

## 開発者体験の向上

1. **明確な責任分離**: どのファイルに何があるか一目瞭然
2. **自動補完**: @インポートによるVSCode統合
3. **型安全性**: 完全なTypeScript対応
4. **可読性**: 一貫した命名規則
5. **保守性**: 小さなファイル、明確な機能分割

## Migration Guide

既存コードからの移行:

```typescript
// 旧形式
import TableDndKitAnswerGrid from "./table-grid/TableDndKitAnswerGrid"

// 新形式
import { AnswerSheetTable } from "@/components/projects/05-answer-sheets/answer-sheet-table"

// ラッパー利用（移行期間中）
import TableDndKitAnswerGrid from "@/components/projects/05-answer-sheets/TableDndKitAnswerGrid"
```

旧 `table-grid` ディレクトリは削除済みです。すべての機能が新しい `answer-sheet-table` 構造に移植されています。