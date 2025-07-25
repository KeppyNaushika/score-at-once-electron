# 02-templateページの領域作成フローの詳細解説

## 🎯 このページの目的
02-templateページは、先生が試験問題の画像を見ながら「この部分が問1の解答欄」「この部分が問2の解答欄」という風に、採点する領域を指定するページです。

---

## 📱 ユーザーの操作から保存まで

### 1️⃣ **マウスでドラッグ開始**
```
先生がマウスを押す（mousedown）
↓
座標を記録: 例）x=100, y=200
```

### 2️⃣ **マウスを動かす**
```
先生がマウスを動かす（mousemove）
↓
現在の座標を更新: 例）x=200, y=300
↓
画面に赤い枠を表示（プレビュー）
```

### 3️⃣ **マウスを離す**
```
先生がマウスを離す（mouseup）
↓
「新しい領域を作ろう！」と判断
↓
onAddAreaByDrag関数が呼ばれる
```

---

## 🔄 プログラムの内部処理

### ステップ1: 新しい領域オブジェクトの作成
```javascript
// 例：新しく作られる領域の中身
const newArea = {
  id: undefined,           // ← 重要！まだDBに保存されていないのでIDなし
  type: "QUESTION_ANSWER", // 問題の解答欄
  x: 100,                  // 左上のx座標
  y: 200,                  // 左上のy座標
  width: 100,              // 幅
  height: 100,             // 高さ
  label: "領域1",          // 表示名
  points: null,            // 配点（後で設定）
  masterImageId: "abc123"  // どの画像の領域か
}
```

### ステップ2: React stateに追加
```javascript
// 現在の領域リスト: [既存の領域1, 既存の領域2]
// ↓
// 新しい領域リスト: [既存の領域1, 既存の領域2, 新しい領域]

setLayoutRegions(prevRegions => [...prevRegions, newArea])
```

### ステップ3: 自動保存のタイマー開始
```javascript
// 1秒後に自動保存を実行
setTimeout(() => {
  autoSaveRegions(finalRegions) // ← ここで実際にDBに保存
}, 1000)
```

---

## 💾 データベース保存の仕組み

### autoSaveRegions関数の中身
```javascript
const autoSaveRegions = async (regions) => {
  // 全ての領域をチェック
  regions.map(async (area) => {
    
    if (area.id) {
      // IDがある = すでにDBに保存済み → 更新処理
      await window.electronAPI.updateLayoutRegion(area.id, regionData)
    } else {
      // IDがない = まだDBに保存されていない → 新規作成
      await window.electronAPI.createLayoutRegion(regionData)
    }
  })
}
```

### DBに保存された後
```javascript
// 保存が成功すると、DBから新しいIDが返ってくる
const savedRegion = {
  id: 456,                 // ← DBが自動生成したID
  type: "QUESTION_ANSWER",
  x: 100,
  y: 200,
  width: 100,
  height: 100,
  label: "領域1",
  points: null,
  masterImageId: "abc123"
}
```

---

## 🐛 問題が起きるパターン

### パターン1: マウスイベントの重複
```
先生が円を描くようにマウスを動かす
↓
mouseupイベントが複数回発生してしまう
↓
onAddAreaByDrag が複数回呼ばれる
↓
同じ座標で複数の領域が作られる
```

### パターン2: 保存タイミングの問題
```
タイミング1: 先生がドラッグ → 新しい領域作成 → 1秒後に保存予約
タイミング2: 0.5秒後に先生が再度ドラッグ → また新しい領域作成 → 1秒後に保存予約

結果: 2つの領域が同時に保存処理に入る
```

### パターン3: 他の領域上でドラッグ終了
```
先生が既存の「領域1」のテキスト上でマウスを離す
↓
テキスト選択イベントとmouseupイベントが同時発生
↓
新しい領域が作られてしまう（意図しない）
```

---

## 🔍 なぜ大量生成が起きるのか

### 現在の防止機構（不十分）
```javascript
const isCreatingRef = useRef(false)

// マウスを離した時
const handleMouseUp = () => {
  if (isCreatingRef.current) {
    return // 作成中なら何もしない
  }
  
  isCreatingRef.current = true // 作成開始フラグ
  onAddAreaByDrag(...) // 領域作成
  isCreatingRef.current = false // 作成終了フラグ
}
```

### 問題点
1. **フラグの設定と解除が同期的**：瞬間的にしか効果がない
2. **複数のイベントが同時発生**：円形ドラッグで複数のmouseupが発生
3. **React stateとの連携不足**：画面の状態とフラグが一致しない

---

## 📊 データの流れ図

```
[ユーザー操作]
マウスドラッグ
     ↓
[イベント処理]
onAddAreaByDrag()
     ↓
[React State更新]
setLayoutRegions()
     ↓
[タイマー設定]
setTimeout(1秒)
     ↓
[DB保存処理]
autoSaveRegions()
     ↓
[個別判定]
area.id あり？ → 更新
area.id なし？ → 新規作成
     ↓
[データベース]
LayoutRegionテーブルに保存
```

---

## 🛠️ 解決方向性

### 短期的解決策
1. **React stateでの重複防止**：refではなくstateで確実に管理
2. **イベント伝播の制御**：標準のブラウザ動作を適切に停止
3. **デバウンシング強化**：短時間の連続操作を無視

### 長期的解決策
1. **バッチ保存**：複数領域を一度に保存して競合を避ける
2. **トランザクション**：DB操作の原子性を保証
3. **楽観的ロック**：同時編集での競合解決

---

## 💡 まとめ

**問題の核心**：
- マウス操作で意図しない複数のイベントが発生
- React stateは正しくても、DB保存で重複が起きる
- `area.id`がない新しい領域は全て新規作成される

**解決のポイント**：
- イベントの重複を確実に防ぐ
- 保存処理の競合を避ける
- ユーザーの意図と実際の動作を一致させる