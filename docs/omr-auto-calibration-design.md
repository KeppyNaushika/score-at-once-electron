# OMRマーク認識の自動キャリブレーション設計

`#832`「OMRマーク認識の高度化（自動キャリブレーション・消し跡対策）」の設計文書。
固定しきい値を撤去し、画像の分布から判定基準を自動決定する。

最終更新: 2026-07-26 / ステータス: **Phase 0・Phase 1 実装済み（未コミット）**。Phase 2（多次元特徴量）は別issue。

---

## 1. 結論（先に）

- **併存ではなく置き換え**。「従来方式／自動方式」の切替UIは作らない。ユーザーから見た設定項目の増分はゼロ。
- **Otsu（大津の二値化法）1本**で、色しきい値と面積しきい値の両方をまかなう。K-means は書かない。
- **多次元特徴量（消し跡対策）は分離**。判定ロジックの二重実装を解消してから着手する。
- 着手前に**添字結合バグ（3.3）を潰す**。土台が壊れたまま自動化を載せない。

---

## 2. 現状

### 2.1 判定パイプライン

```
loadImageRaw()                         画像→RAWバッファ
  → detectCornerMarkers(colorThreshold)  4隅マーカー検出
  → recognizeCells(params)               セルごとにバブル判定
      → computeEllipticalFillRatio(colorThreshold)  楕円内の暗ピクセル比
      → fillRatio >= areaThreshold                  マーク判定
  → (renderer) reevaluateWithThreshold()  スライダー操作で即時再判定
```

判定に効くパラメータは2つだけ。

| パラメータ       | 意味                          | 既定  | ユーザーからの調整                                             |
| ---------------- | ----------------------------- | ----- | -------------------------------------------------------------- |
| `colorThreshold` | 暗ピクセルの輝度境界（0-255） | `128` | **UIに無し**（DBの `CropRegionOmrConfig.colorThreshold` のみ） |
| `areaThreshold`  | 塗りつぶし率の境界（0-1）     | `0.4` | スライダーあり（`OMRAutoScoringModal.tsx:169`）                |

### 2.2 既存の「推奨値」機能

`recommendAreaThreshold()`（`reevaluateResults.ts:329-366`）は k-means ではなく**最大ギャップ探索**。

1. 全セルの `fillRatio` をフラットに集める
2. `[0.05, 0.85]` の範囲だけに絞る（`:346`）
3. ソートして隣接値の差が最大の箇所を探し、中点を推奨値にする（`:354-360`）
4. 最大ギャップが `0.05` 未満なら `null`（推奨せず）（`:363`）

---

## 3. 調査で判明した問題

### 3.1 `colorThreshold` は事実上の隠れ定数、しかも既定値の記述が食い違う

UI導線が無く、DB設定を直接書き換える以外に変更手段がない。さらに:

- `src/types/omr.types.ts:105` のコメント → 「デフォルト25」
- 実際の呼び出し → `128`（`hooks/useOMRRecognition.ts:59`、`useOmrAutoScoring.ts:178`、`omrHandlers.ts:44`）

鉛筆の濃さ・スキャナのガンマが最初に効くのはここなのに、誰も調整できない。

### 3.2 最大ギャップ探索の弱点

- **母数が増えるほど推奨できなくなる**。生徒数が多いほど中間帯にも値が詰まり、隣接ギャップが `0.05` を割って `null` を返す確率が上がる。学級規模が大きいほど機能しない向きの弱点。
- **`[0.05, 0.85]` の足切り**（`:346`）で、きれいな未マーク群（≒0）とマーク群（≒0.9+）が両方とも捨てられ、**中間の曖昧な値だけでギャップを探している**。本来の2峰性を使えていない。

### 3.3 `markedIndices` の添字結合バグ（**この issue より優先**）

`markRecognizer.ts:83` は `markedIndices` に**配列位置ではなく `choiceIndex`** を push している。それを `fillRatios` の添字として使っている:

- `markRecognizer.ts:100` — `fillRatios[markedIndices[0]]`
- `markRecognizer.ts:102` — `filter((_, i) => !markedIndices.includes(i))`

`useOmrAutoScoring.ts:522` の `.filter((option) => option.normalizedCx != null)` で位置未設定の選択肢が脱落するため、配列位置と `choiceIndex` は一致しない場合がある。

さらに renderer 側の `reevaluateResults.ts:149` は純粋な添字で回し、ラベルは**フィルタしていない** `config.choiceOptions.map((option) => option.label)`（`:146`）から引く。結果として**同じデータに対して main 側の認識と renderer 側の再評価が別の選択肢を指す**。

「密行列UIの添字結合の罠」と同型。序数で実体を同定してはいけない。

### 3.4 判定ロジックの二重実装

`markRecognizer.ts:42` の `recognizeChoiceCell` と `reevaluateResults.ts:137` の `reevaluateChoiceCell` は、信頼度計算も採点ステータス判定も同一ロジックの複製（後者のコメントに「同一ロジック」と明記されている）。3.3 の食い違いはこの複製が原因。

特徴量を増やすと、キャッシュ対象も複製も倍化する。

### 3.5 `colorThreshold` はマーカー検出とバブル判定で共用されている

`omrHandlers.ts:111,232` は同じ `params.colorThreshold` を `detectCornerMarkers()` にも渡し、マーカー検出結果を `"examPageId:colorThreshold"` をキーにキャッシュしている（`:43-44`）。

**マーカーは印刷された真っ黒な塗り、バブルは鉛筆**で最適な境界が違う。自動化の対象を分けないと、キャッシュキーが画像ごとに散ってマーカー検出のキャッシュが効かなくなる。

### 3.6 issue 本文の記述で不正確な点

> 二値化（黒/白判定）も固定の色しきい値 — `colorThreshold`（デフォルト `25`）でR値判定

- 既定は `25` ではなく `128`（3.1）
- R値判定なのは `computeFillRatio`（`imageProcessor.ts:91`）だけ。バブル判定に実際に使う `computeEllipticalFillRatio`（`:162`）と `computeCircularFillRatio`（`:117`）は **RGB加重平均の輝度**で判定している

---

## 4. 方針

### 4.1 Otsu 1本にする（K-means は書かない）

Otsu法と1次元 2-means は目的関数がほぼ同じ（クラス内分散の最小化＝クラス間分散の最大化）で、実質同族。提案1（色しきい値）と提案2（面積しきい値）は**別アルゴリズムではなく、同じ手法を輝度と塗りつぶし率に適用したもの**。

共有関数を1つ置く。main / renderer の双方から使うので `src/lib/omr/` に置き、
electron-src からは相対パスで参照する（esbuild が bundle 時に取り込む）。

```typescript
// src/lib/omr/otsuThreshold.ts
export interface OtsuResult {
  /** 算出された境界値（入力と同じスケール） */
  threshold: number
  /** 2クラスの平均値の差（入力と同じスケール） */
  meanDistance: number
}

export function computeOtsuThreshold(
  values: number[],
  options: { min: number; max: number; bins: number }
): OtsuResult | null

/** 画像のように値を展開すると重い場合はビンに積んでから渡す */
export function computeOtsuFromHistogram(
  histogram: number[],
  options: { min: number; max: number; bins: number }
): OtsuResult | null
```

サンプル数が足りない・分割点が無い場合は `null`。

**採否の判定に「分離度（クラス間分散比 η）」は使えない。** η はスケール不変なので、
密集した1群を割っただけでも大きな値を返す（実測: 全員未マークの `0.01〜0.03` 分布で η=0.75）。
実装では代わりに **2クラスの平均値の差（`meanDistance`）** を返し、呼び出し側が
ドメインごとの下限と比較する。

| 呼び出し側                             | 下限                  | 根拠                                 |
| -------------------------------------- | --------------------- | ------------------------------------ |
| 色しきい値（`markRecognizer.ts`）      | 輝度差 `60`           | 鉛筆と紙はこれ以上離れる             |
| 面積しきい値（`reevaluateResults.ts`） | 塗りつぶし率差 `0.25` | マーク済みと未マークはこれ以上離れる |

もう1点、**クラス間分散が同値で並ぶ区間（空ビンが続く谷）では中央を採る**。
最初に見つかった位置を採ると境界が暗い側の群に張り付き、閾値が過度に厳しくなる
（実測: 黒40／白240の分布で境界が41になった）。同値のビン番号を平均して中央に置く。

### 4.2 適用点は2つ、扱いは別

| 対象         | 適用場所                               | 母集団                        | 置き換わるもの   |
| ------------ | -------------------------------------- | ----------------------------- | ---------------- |
| 色しきい値   | main（`imageProcessor.ts` 呼び出し側） | 1画像の**バブル領域内**の輝度 | 固定値 `128`     |
| 面積しきい値 | renderer（`reevaluateResults.ts`）     | 全シートの `fillRatio`        | 最大ギャップ探索 |

**マーカー検出の `colorThreshold` は据え置き**（3.5）。自動化するのはバブル判定側だけ。`detectCornerMarkers()` に渡す値は現行のまま固定にして、キャッシュキーを安定させる。

色しきい値の母集団を「画像全体」ではなく「バブル領域内のピクセル」に限るのは、余白が支配的な答案画像で全体ヒストグラムを取ると1峰になり Otsu が破綻するため。

### 4.3 面積しきい値は関数の中身だけ差し替え

`recommendAreaThreshold()` の**位置づけ（全シートの `fillRatio` から境界を1つ返す）と呼び出し側は変えない**。中の推定量を最大ギャップ探索 → Otsu に置き換え、`[0.05, 0.85]` の足切り（`:346`）を撤去して全分布を使う。最大ギャップ探索のコードは残さない。

### 4.4 「推奨するだけ」→「初回に自動適用」

現状は推奨値を出してユーザーがボタンで適用する導線。これを初回認識時に自動適用へ変える。既存の手動スライダー（`OMRAutoScoringModal.tsx:169`）は**そのまま残す**ので、ユーザーは今まで通り上書きできる。

残る状態は「自動で決まった値がスライダーの初期位置に入っている」だけ。モード切替UIは不要。

### 4.5 フォールバック

`computeOtsuThreshold()` が `null` を返す、または `meanDistance` が下限を割る（2群が離れていない＝全員未マーク等）場合は**従来の固定値**（色 `128` / 面積 `0.4`）を使う。

面積しきい値側は既存の「`null` なら推奨なし」経路をそのまま使えるので、新しい分岐は増えない。

### 4.6 スキーマ変更は無い

認識結果はDBに永続化されておらず（OMR関連テーブルは設定のみ）、`colorThreshold` / `areaThreshold` は既に nullable な上書き列。**列の追加・削除・型変更はなく、`null` の解釈がコード側で変わるだけ**なのでマイグレーションは発生しない。アーカイブ側（`examArchive.types.ts:719-720`）も形が変わらないため、バージョン引き上げもトランスフォーマー追加も不要。

唯一の注意点として、`null` の意味が変わるため**旧バージョンで書き出したアーカイブを取り込むと挙動が変わる**（`colorThreshold = null` は旧: `128` 固定 / 新: 自動算出）。これは変更の趣旨そのものであり、固定値を維持したい場合はユーザーがスライダーで明示すれば列に値が入るため、互換性の問題としては扱わない。

---

## 5. 受け入れ条件の改訂

issue 本文の条件を次に差し替える。

- [x] 色しきい値が1画像のバブル領域輝度から自動算出される（マーカー検出用は据え置き）
- [x] 面積しきい値が全シートの `fillRatio` 分布から自動算出され、**ユーザー操作なしに初期値として適用される**
- [x] 手動スライダーによる上書きは従来通り機能する
- [x] 2群が近い・サンプル不足のときは従来の固定値へフォールバックする
- [x] 既存の `confidence` / 低信頼セルの保留フローと両立する
- [x] 単体テストを追加（Otsu、群間距離、フォールバック、既知分布での期待値）

**削除する条件**: 「認識方式を『固定しきい値（従来）』と『自動』で切替できる」

理由: 教員向けに設定項目を増やすコストに見合わない。既に手動スライダーがあるので「自動（既定）＋手動上書き」の2段で足り、フォールバックは内部で自動判断すればよい。

---

## 6. フェーズ

### Phase 0: 土台の修正（実装済み）

1. **添字結合の解消**。`OMRCellResult.fillRatios: number[]` を `bubbleMeasurements: BubbleMeasurement[]`（`choiceIndex` / `label` / `fillRatio` を同梱）へ置き換え、選択肢を序数で指すのをやめた
2. **判定ロジックの一本化**。`src/lib/omr/choiceEvaluation.ts` の `evaluateChoiceBubbles()` を main / renderer の双方から呼ぶ。`reevaluateChoiceCell` の複製を削除
3. `omr.types.ts` の既定値コメントを実態に合わせ、`colorThreshold` を `number | null` へ

### Phase 1: Otsu 自動キャリブレーション（実装済み）

4. `src/lib/omr/otsuThreshold.ts` を追加
5. `resolveColorThreshold()` がバブル領域の輝度ヒストグラムから自動算出（1枚の答案につき1つ。マーカー検出は据え置き）
6. `recommendAreaThreshold()` の中身を Otsu に差し替え、`[0.05, 0.85]` の足切りを撤去
7. `useOmrAutoScoring` が初回認識時に算出値をスライダー初期値として適用
8. フォールバック（`meanDistance` 下限・サンプル不足）

### Phase 2: 多次元特徴量（別issue）

9. 中心と縁の濃淡差などを併用した消し跡対策。特徴量を増やしても `BubbleMeasurement` にフィールドを足すだけで済む形になっている

---

## 7. テスト方針

`__tests__/omr/unit/` に追加する。

| ファイル                         | 内容                                                                                                                          |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `otsuThreshold.test.ts`          | 2峰分布で境界が谷に落ちるか。単峰分布で `meanDistance` が下限を割るか。母数が増えても境界が求まるか（最大ギャップ探索との差） |
| `choiceEvaluation.test.ts`       | 判定・信頼度・採点ステータス。`choiceIndex` が配列位置と一致しないときに正しい選択肢を指すか                                  |
| `recognitionConsistency.test.ts` | 位置未設定の選択肢が脱落した構成で、main の認識と renderer の再評価が一致するか                                               |
| `markRecognizer.test.ts`         | 自動色しきい値（固定値では拾えない薄い鉛筆を拾う／白紙でフォールバック／明示値が優先）＋既存の回帰                            |

---

## 8. 関連ファイル

| ファイル                                                                          | 役割                                       |
| --------------------------------------------------------------------------------- | ------------------------------------------ |
| `electron-src/lib/omr/markRecognizer.ts`                                          | バブル判定・信頼度・採点ステータス（main） |
| `electron-src/lib/omr/imageProcessor.ts`                                          | 塗りつぶし率算出                           |
| `electron-src/ipc-handlers/omrHandlers.ts`                                        | パラメータ受け渡し・マーカー検出キャッシュ |
| `src/types/omr.types.ts`                                                          | `OMRRecognitionParams` 等                  |
| `src/components/exams/07-score-at-once/OMRRecognition/utils/reevaluateResults.ts` | 閾値再評価・推奨値（renderer）             |
| `src/components/exams/07-score-at-once/OMRRecognition/hooks/useOmrAutoScoring.ts` | パラメータ既定値・バブル構築               |
| `src/components/exams/07-score-at-once/OMRRecognition/OMRAutoScoringModal.tsx`    | 閾値スライダーUI                           |
| `prisma/schema.prisma:527`                                                        | `CropRegionOmrConfig.colorThreshold`       |
