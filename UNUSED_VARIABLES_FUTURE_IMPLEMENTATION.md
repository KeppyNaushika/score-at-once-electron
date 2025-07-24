# 将来実装予定の未使用変数・関数一覧

このファイルは、現在未使用だが将来の機能実装で使用予定の変数・関数を記録します。

## 🔄 採点機能関連 (07-score-at-once)

### scoring-main-view.tsx
- `imageRef`, `canvasRef` - 画像表示とキャンバス操作の高度な機能で使用予定
- `getScoringStatus` - 採点状況の詳細分析機能で使用予定
- `setFilterSettings` - フィルタリング設定の保存・復元機能で使用予定
- `recentlyScoredAnswers` - 最近採点した答案の履歴表示機能で使用予定
- `getAllGridAnswerData`, `getMasterAnswerData` - データ分析・統計機能で使用予定

### scoring-keyboard.ts
- `currentStudentIndex`, `currentQuestionIndex` - キーボードナビゲーションの詳細制御で使用予定
- `answerSheetsLength`, `questionRegionsLength` - 進捗表示・統計機能で使用予定

### scoring-navigation.ts
- `rows` - グリッド表示での行管理機能で使用予定

### scoring-toolbar.tsx
- `currentQuestion` - 現在の問題情報表示機能で使用予定

### question-navigator.tsx
- `currentProgress` - 詳細な進捗表示機能で使用予定

### scoring-data.ts
- `projectId` - プロジェクト固有の設定・分析機能で使用予定

### AnswerDisplayViewer.tsx
- `imageSize` - 画像サイズ情報の表示・調整機能で使用予定

### AnswerGridView.tsx
- `currentQuestionIndex` - グリッド内での問題選択機能で使用予定

### ProjectProgressCard.tsx
- `lastUpdated` - 最終更新時刻表示機能で使用予定
- `getProgressColor` - 進捗状況の色分け表示機能で使用予定

## 📤 出力機能関連 (08-export)

### ExportProgressModal.tsx
- `totalSteps`, `currentStepIndex` - 詳細な進捗ステップ表示機能で使用予定

## 📝 テンプレート編集関連 (02-template)

### AreaRenderer.tsx
- `containerReady`, `forceUpdate` - レンダリング最適化・強制更新機能で使用予定

### use-image-canvas-interaction.ts
- `useRef` import - 将来的なDOM参照操作で使用予定
- `getImageBounds` - 画像境界取得の高度な機能で使用予定

## 📊 問題グループ管理関連 (04-question-group)

### QuestionAssignmentMatrix.tsx
- `Save` import - 保存機能のUI実装で使用予定
- `dragStart` - ドラッグ操作の詳細制御で使用予定
- `handleSave` - 手動保存機能で使用予定
- `hasChanges` - 変更検知・警告表示機能で使用予定

## 📋 答案管理関連 (06-answer-sheets)

### answer-cell.tsx
- `onToggleCell` - セル単位での有効/無効切り替え機能で使用予定

### answer-sheet-grid-manager.tsx
- `studentId`, `pageNumber` - セル情報の詳細表示・操作機能で使用予定

### use-answer-sheet-upload.ts
- `setImageLoadStates` - 画像読み込み状態の詳細管理機能で使用予定

### file-preview-cell.tsx
- `getFileColor` - ファイル状態に応じた色分け表示機能で使用予定

### sortable-table-cell.tsx
- `position` - セル位置情報の表示・操作機能で使用予定

## 📁 ファイル管理関連

### utils/answerSheetConverter.ts
- `generatePlacementOrder` - 現在は内部関数として使用中だが、将来的にexport関数として使用予定

---

## 📝 実装時の注意事項

1. **型安全性**: 実装時は適切な型定義を追加すること
2. **エラーハンドリング**: 各機能には適切なエラー処理を実装すること
3. **パフォーマンス**: 特に画像処理・大量データ処理機能では最適化を考慮すること
4. **ユーザビリティ**: UI/UX機能は直感的な操作性を重視すること

## 🔄 更新履歴

- 2025年7月24日: 初回作成、39個の未使用変数を分析・分類