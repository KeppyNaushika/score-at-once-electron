# onAddAreaByDrag ID保持問題のデバッグログ調査

## 追加されたデバッグログの概要

以下のデバッグログが追加され、IDの保持問題を調査できるようになりました：

### 1. `useImageCanvasInteraction.ts` - ドラッグ開始時
```
[ADD AREA] onAddAreaByDrag called
- timestamp: 呼び出しタイムスタンプ
- coords: ドラッグで作成された座標
- currentAreasCount: 現在の領域数
- currentAreasWithId: IDを持つ領域数
- currentAreasWithoutId: IDを持たない領域数
- areasDetail: 全領域の詳細（index、id、hasId、type、label）
```

### 2. `LayoutRegionEditor.tsx` - addArea関数内
```
[DEBUG] addArea called
- timestamp: 関数呼び出しタイムスタンプ
- type: 追加する領域タイプ
- customCoords: ドラッグ座標
- currentAreasCount: 現在の領域数
- currentAreas: 現在の全領域詳細（ID状況含む）

[DEBUG] New areas array after addition
- timestamp: 新配列作成後のタイムスタンプ
- newAreasCount: 新しい配列の領域数
- newAreasWithIdStatus: 新配列の全領域ID状況
- newlyAddedArea: 新しく追加された領域のID状況
```

### 3. `page.tsx` - handleRegionsChange関数内
```
[HANDLE REGIONS] handleRegionsChange called
- timestamp: 関数呼び出しタイムスタンプ
- regionsType: 渡された引数の型
- regionsCount: 領域数
- currentLayoutRegionsCount: 現在の状態の領域数

[HANDLE REGIONS] finalRegions calculated
- finalRegionsCount: 最終的な領域数
- regions: 全領域のID状況詳細
```

### 4. `page.tsx` - autoSaveRegions関数内
```
[AUTO SAVE] Starting autoSaveRegions
- timestamp: 開始タイムスタンプ
- regionsCount: 保存対象領域数
- regionsWithoutId: IDなし領域数
- regionsWithId: IDあり領域数

[ELECTRON API] Creating new region
[ELECTRON API] Created region result

[AUTO SAVE] New IDs created, updating layout regions state
[AUTO SAVE] Region updated with new ID
- originalIndex: 配列内のインデックス
- oldId: 元のID（undefined）
- newId: 新しく作成されたID
- label: 領域ラベル

[AUTO SAVE] Setting updated regions to state
- updatedRegionsCount: 更新後の領域数
- regionsWithId: IDを持つ領域数
```

## 問題の確認方法

1. 新しい領域をドラッグで作成
2. ブラウザの開発者ツールのコンソールで以下を確認：

### 期待される流れ
1. `[ADD AREA] onAddAreaByDrag called` - IDなし新領域が追加される
2. `[DEBUG] addArea called` - 既存領域はIDを保持、新領域はIDなし
3. `[DEBUG] New areas array after addition` - 既存IDが保持されているか確認
4. `[HANDLE REGIONS] handleRegionsChange called` - 状態更新の確認
5. `[AUTO SAVE] Starting autoSaveRegions` - 保存処理開始
6. `[ELECTRON API] Creating new region` - 新領域のDB作成
7. `[AUTO SAVE] Region updated with new ID` - 新IDが設定される
8. `[AUTO SAVE] Setting updated regions to state` - 状態に反映

### 問題点の特定
- 既存領域のIDが `undefined` になっている場合 → スプレッド演算子でIDが失われている
- 新しいIDが設定されない場合 → autoSaveRegionsの問題
- 状態更新が反映されない場合 → React状態管理の問題

## 修正された点
1. `autoSaveRegions`で新規作成されたIDを状態に反映する処理を追加
2. 保存結果を追跡して、IDが作成された領域を正しく更新
3. デバッグログでIDの流れを完全に可視化

次のテストで、既存領域のIDが保持されることを確認してください。