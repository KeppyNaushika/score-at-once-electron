# 学級統計の再設計

試験(Exam)における「学級」の扱い — 採番・統計・出力 — を作り直すための設計文書。
成績(Grade)・資料(Coursework)への共通化も含む。

最終更新: 2026-06-30 / ステータス: 統計強化(11章 #833/#838/#834)は実装完了・コミット済(`3c99fc8a`)。**学級再設計は Phase 0〜4c 実装完了・未コミット**（受験日統一/集計エンジン/スキーマ＋移行/statistics削除/05簡素化/08統計対象学級タブ/Excel学級平均行/個人成績表の複数学級比較/小計グループのフラグ移行）。フルテスト 862 passed・1 failed(既存の grade 日付相対・無関係)、typecheck クリーン。**残り: Phase 5(UI共通化＋削除2段階modal)。詳細は 12 章。**

---

## 1. 背景と動機

「学級の関連付け」が成績出力にどう使われているかの調査から始まり、以下の問題が判明した。

### 1.1 発見した問題

| #   | 問題                                                                                                                                                                                                           | 箇所                                                                   |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| P1  | 学級平均の母集団が **`memberships[0]`（startDate降順の先頭）** で決まる。終了した在籍も含み、登録順という偶然で母集団が散る                                                                                    | `individual-report/dataFetcher.ts:143-147`、`excel/dataFetcher.ts:118` |
| P2  | `ExamClass.statistics` フラグが定義・UIはあるのに **どの計算からも読まれていない**（死んでいる）                                                                                                               | `examClass.ts:128` の `getStatisticsClasses` が未呼び出し              |
| P3  | **再採番（並び順リセット）が受験日基準でない**。追加時(`addStudentsFromClass`)は `membershipFilterAt(examDate)` を使うのに、表示・採番の解決(`getStudentClassInfoForExam`)は日付フィルタなしで全membership取得 | `examClass.ts:499-517`                                                 |
| P4  | **学級削除に確認ダイアログが無い**。さらに3エンティティで挙動がバラバラ（試験=リンクのみ削除／成績・資料=専属生徒を無確認削除）                                                                                | `ClassExamManager.tsx:99`、`rosterManager.ts:224`                      |
| P5  | **エンティティ参照をJSONに押し付け**。小計グループ選択 `selectedGroupIds: string[]` が settingsJson に保存され、亡霊ID（削除後も残る）が発生しうる                                                             | `individual-report/types.ts:191`                                       |

### 1.2 本来やりたかったこと

指定した学級を母集団として**学級平均等を算出し出力する**。Excel の学級平均行/学級別集計と、個人成績表の学級比較。
（当初は独立PDF「学級成績表」も検討したが、5.2の判断で見送り。）

---

## 2. 確定した概念モデル

### 2.1 「学級」とは

在籍学級(3-A組)だけでなく、**生徒の任意のグルーピング**を含む: 部活動・習熟度別・昨年度学級など。
**1人の生徒は複数の学級に同時に所属する**のが普通。

### 2.2 在籍(StudentClassMembership)

生徒と学級の結びつきの記録。**期間(startDate/endDate)** と **学級ごとの出席番号** を持つ。
過去の所属も履歴として残る。

### 2.3 試験-学級(ExamClass)と試験-生徒(ExamStudent)

- **ExamStudent** = 採点の本体（点数・答案がぶら下がる確定記録）。在籍の変化では壊れない。
- **ExamClass** = 試験への学級登録。生徒の一括取り込み口＋並び順(`order`)を与える便宜的なまとまり。

### 2.4 学級の「3つの使い道」＝3つの独立スイッチ

| #   | 使い道               | 誰のため     | 学級の扱い                               | 操作画面     | 保存先                                     |
| --- | -------------------- | ------------ | ---------------------------------------- | ------------ | ------------------------------------------ |
| 1   | **再採番・配置**     | 採点作業     | 1人=1学級（order優先で確定、重複は無視） | 受験生徒(05) | `ExamClass.administered` + `order`（既存） |
| 2   | **教員が見る集計**   | 教員の分析   | 複数OK（重複カウント）                   | 結果出力(08) | `ExamClass.teacherStat`（新規）            |
| 3   | **生徒に見せる比較** | 生徒の成績表 | 複数OK・慎重に絞る                       | 結果出力(08) | `ExamClass.studentReport`（新規）          |

**重要**: 同じ「生徒×学級」データでも、用途1は重複を潰し（1人1学級）、用途2/3は重複を活かす（全所属学級にカウント）。処理ロジックが逆になる。

例:

```
3-A組(在籍)  再採番☑  教員☑  生徒☑   ← 全部
バスケ部      再採番☐  教員☑  生徒☑   ← 番号は振らないが平均は両方に
数学上位     再採番☐  教員☑  生徒☐   ← 教員は見るが生徒には出さない
```

### 2.5 役割分担（操作画面の分離）

- **受験生徒画面(05) = 構造を作る**: 学級登録・order並び替え・再採番(administered)
- **結果出力画面(08) = 出力を決める**: 教員用(teacherStat)・生徒用(studentReport)の学級選択

2画面はUIが異なってよい（むしろ異なるべき）。05はフル管理テーブル、08は軽量チェックリスト。

### 2.6 受験日スナップショット（在籍判定の統一原則）

学級の所属は「今」ではなく **受験日(`exam.examDate`)時点** で判定する。
②の在籍期間を使い `membershipFilterAt(examDate)` を通す。
**追加・再採番・表示・統計の全経路をこの基準に統一**（P3の修正）。

### 2.7 学級平均の母集団（P1/P2の修正）

`memberships[0]` 依存を廃止。**登録学級ごとに、受験日時点で所属する生徒を集めて集計**する。
1人の生徒は所属する全学級の平均に重複カウントされる。

---

## 3. 削除の安全仕様（P4の修正）

学級削除時、消える対象（その学級にしか属さない生徒）を**答案/採点データの有無で仕分け**する。

```
[学級の削除ボタン]
   ↓
① 1回目modal：外し方を選択
   (a) 学級登録だけ解除（生徒は受験者に残す）   ← 既定・推奨（試験の現挙動）
   (b) 学級登録を解除し、専属の生徒も削除
       → △名が削除されます（うち □名 はデータあり）
   ↓ (b) かつ □≧1 のとき
② 2回目modal：生徒データ削除の確認
   「□名 の答案・採点データも削除されます。取り消せません。本当に削除しますか？」
   ↓
   実行
```

- データなしの生徒のみ → 1回目で実行可（誤登録のお掃除）
- データありの生徒がいる → 2回目で明示確認
- **試験・成績・資料の3エンティティで共通挙動に統一**

---

## 4. データモデル変更（JSON脱却・関係テーブル化）

### 4.1 原則

**他のエンティティ（学級・小計グループ等）を参照するものはスキーマで持つ。**
JSONでよいのは「他を参照しない表示設定」（マーク色・トグル・enum）のみ。

### 4.2 スキーマ変更

| テーブル            | 追加カラム                   | 用途                                                        |
| ------------------- | ---------------------------- | ----------------------------------------------------------- |
| `ExamClass`         | `teacherStat Boolean`        | 教員集計対象（Excel学級平均行。PDF学級成績表は5.2で見送り） |
| `ExamClass`         | `studentReport Boolean`      | 生徒表示対象（個人成績表の学級比較）                        |
| `ExamSubtotalGroup` | `selectedForTable Boolean`   | 小計点テーブルに含めるグループ                              |
| `ExamSubtotalGroup` | `selectedForBoxPlot Boolean` | 箱ひげ図に含めるグループ                                    |

- `ExamClass.statistics`（旧・死フラグ）は `teacherStat` へ意味継承し、整理（不要化）。
- `SubtotalGroupSelection.enabled`（master toggle、参照なし）は **JSONのまま**。`selectedGroupIds` のみ昇格。

### 4.3 JSONに残すもの（参照を含まない表示設定）

- `scoringMarkConfig`（採点マークの色・サイズ・位置）
- `individualReportOptions` の各トグル（`showAverage: "class"|"overall"|"both"|"none"`、`rankType`、各 `show*: boolean` 等）
- `SubtotalGroupSelection.enabled`

→ これらは正当なJSON。**昇格不要**。

### 4.4 触らないもの（永続化されない実行時データ）

- `GetIndividualReportDataOptions.selectedStudentIds`（出力時の実行時パラメータ）

### 4.5 ついでに除去したデッドコード/原則違反（2026-06-29 実施済）

- `SubtotalGroupInfo.subtotalIds`：どこからも読まれない死にフィールドだった上、
  Prisma `SubtotalGroup` とほぼ1:1なのに手書き interface＝「Prisma型を最優先」違反でもあった。
  - 死にフィールドを除去（`dataFetcher.ts` の `subtotals.map(s => s.id)` 生成も削除）
  - `export type SubtotalGroupInfo = Pick<SubtotalGroup, "id" | "name">` へ（Prisma派生）
  - 教訓: エンティティの member-ID を素の `string[]` で状態管理しない。必要ならPrismaのリレーション型
    （`Prisma.SubtotalGroupGetPayload<{ include: { subtotals: true } }>` 等）を使う。

---

## 5. 出力

**重要な前提**: 既存の出力は3タブ（`scored-answers` / `grading-data`=Excel / `individual-reports`=個人成績表PDF）。
Excelはデータシート3枚（点数一覧 / 正誤一覧 / 問題分析）。PDF帳票は個人成績表のみ。**全体成績表PDFも学級成績表PDFも存在しない**。
また、チェックボックスの生徒選択は「誰を出力するか」を決めるだけで、**統計母集団は常に全試験**（選択は母集団を変えない）。
→ 統計は「母集団=全試験＋グループ別サブ統計」で出来ており、**全体/学級/設問/個人は別帳票ではなく"グループ化の粒度"違い**。

### 5.1 Excel（学級別集計＝今回の主成果）

全体平均行に加え、**登録学級ごとの学級平均行/学級別集計**を追加（`teacherStat=true` の学級）。
これは新帳票ではなく**既存Excel集計への学級グループ化拡張**（Phase 1の集計修正の延長）。
既存の問題分析シート（正答率・得点率・I-T相関＝識別係数）と並ぶ、教員向け分析データ。

```
全体平均     65.2
3-A組平均    68.0
バスケ部平均  72.3
数学上位平均  81.1
```

**学級平均の母集団＝学級全体**（受験日所属者・受験状態フィルタ適用）。
2種類のチェックボックスを混同しないこと:

- 生徒選択（StudentSelectionCard）＝どの生徒を行に出すか。**母集団に無関係**
- 統計対象学級（新タブ・teacherStat）＝どの学級の平均行を出すか。**出す対象の選択**

母集団の唯一の調整は受験状態フィルタ（受験/見込/欠席、既存 `boxPlotIncludeStatuses` を共有設定に格上げ）。

> teacherStat が痩せ細った点に注意: PDF学級成績表を見送った結果、teacherStat の唯一の用途は
> この Excel 学級平均行になった。これをやる前提で teacherStat を残す（A 案採用、2026-06-29）。

### 5.2 学級成績表（PDF帳票）＝ 今回は見送り

独立したPDF学級成績表は**作らない**。判断（2026-06-29）:

- 教員の分析需要は Excel(5.1) ＋ 既存の問題分析（識別係数等）で足りている。
- PDF帳票の価値は「**グラフ等の可視化を入れたい**」となって初めて出る。今その需要はない。
- 統計の充実（α係数・D値・S-P表・得点度数分布ヒストグラム）自体は **11章で本作業として実装する**（教員向けExcel/プレビュー）。
  ただしそれらは Excel・出力プレビューに出すものであり、**生徒に配るPDF帳票としての「学級成績表」とは別物**。
- 見送るのは「学級を主語にした生徒配布用PDF帳票」。これが要るのは生徒配布物にグラフを載せたくなったときで、今は需要なし。
- R / exametrika 向けエクスポートは #834（11.3、優先度低）。

→ 本設計のスコープからPDF学級成績表（生徒配布帳票）を外す。将来やるなら個人成績表機構の主語替えで実装可能。

### 5.3 個人成績表（既存PDFの拡張）

`showAverage`(JSON, on/off) × `studentReport`選択(関係テーブル, どの学級) の組み合わせ。
各生徒に「生徒用に選んだ学級 ∩ 本人の受験日所属学級」の比較を併記（複数学級対応）。
※ 新帳票ではなく既存の個人成績表への拡張。Phase 1の集計修正がそのまま効く。

---

## 6. UI共通化

3エンティティ(試験・成績・資料)の学級登録UIを共通コンポーネント化する。

- 新規 `src/components/common/class-roster/ClassRosterManager.tsx`
  - 登録リスト＋order D&D並び替え＋追加＋削除（4.3の削除2段階modalを内包）
  - `flagColumns` で可変のフラグ列を差し込み: **試験=再採番(administered)1列のみ**、成績/資料=0列
- 成績/資料に欠けている **class reorder API** を `rosterManager` の adapter に追加（`setClassOrders`）
- 教員用/生徒用フラグ(teacherStat/studentReport)は**05では出さず**、08-export側の出力スコープUIで操作

---

## 7. 実装フェーズ

依存を踏まえた推奨順。

### Phase 0 — 受験日統一（P3バグ修正・独立）

- `getStudentClassInfoForExam` 等、全在籍解決に `membershipFilterAt(exam.examDate)` を適用
- 回帰の土台。単独でマージ可能

### Phase 1 — 集計エンジンの作り直し（P1/P2・土台）

- `examClass.ts`: 登録学級→所属生徒（受験日基準・重複カウント）のマップを返す関数を新設
- `excel/dataFetcher.ts`: 表示用 className/grade/出席番号を `memberships[0]` → order解決値へ
- `individual-report/dataFetcher.ts` / `statisticsCalculator.ts` / `computeReportData.ts`: 母集団を「指定学級の所属生徒」へ。複数学級対応

### Phase 2 — スキーマ変更とデータ移行（4章・P5）

- migration: `ExamClass`(+2列)、`ExamSubtotalGroup`(+2列)
- データ移行:
  - `ExamClass.statistics` → `teacherStat`（列コピー）、`studentReport` は既定（例: administered相当）
  - **`ExamSubtotalGroup`: 既存 settingsJson を読み `selectedGroupIds` をパースしてフラグへ（JSON解釈が必要なのはここだけ）**
- アーカイブ: バージョン更新＋transformer。古いアーカイブの settingsJson も解釈して新フラグへ変換
- コード: 個人成績表の小計選択読み取りをフラグ参照へ。08-export UIをフラグ書き込みへ

### Phase 3 — 出力スコープUI（05/08）

- 05: 学級登録テーブルを再採番(administered)のみに簡素化（旧statisticsチェック撤去）
- 08: **左カード(StudentSelectionCard)のタブ列に「統計対象学級」タブを追加**（既存タブ `[選択][プレビュー]` → `[統計対象学級][生徒選択][プレビュー]`）
  - 教員用(teacherStat)/生徒用(studentReport)の2列チェックリスト
  - 既定アクティブは `生徒選択` のまま（統計対象学級は低頻度・永続設定）
  - 新タブ列を作らず既存タブ列を拡張するため、画面の縦圧迫もタブ二重化も起きない

### Phase 4 — 出力実装（5章）

- **Excel 学級平均行/学級別集計**（5.1・今回の主成果）／ 個人成績表の複数学級比較（5.3）
- **PDF学級成績表は作らない**（5.2・見送り）。統計充実＋可視化は別トラック #833/#838

### Phase 5 — UI共通化（6章）

- `ClassRosterManager` 抽出、3エンティティ移行、削除2段階modal、class reorder API

---

## 8. マイグレーション・アーカイブの注意

CLAUDE.md の規則に従う（`prisma migrate dev` / 手書き migration.sql＋`migrationDeployer`、`CURRENT_ARCHIVE_VERSION` 更新＋transformer 追加）。

- **JSON解釈が必要なのは小計グループ昇格の移行・transformerのみ**。学級側は列移行でJSON解釈なし。
- 既存試験で `teacherStat` 等が未設定でも壊れないよう、移行時に妥当な既定値を入れる（学級平均が消えない）。
- 関連メモ: [手書きマイグレーション運用](../) `project_prisma7_handauthored_migrations`、[マイグレーション順序破壊](../) `project_migration_ordering_hazard`、[規約テストの誤検知](../) `project_stale_schema_convention_tests`。

---

## 9. リスク

| リスク                                                                       | 対策                                                                     |
| ---------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| 表示学級が `memberships[0]`→order解決に変わり、複数所属生徒のExcel表示が変化 | 意図的修正。回帰テストで差分確認、解決不能時は membership フォールバック |
| 既存試験の学級平均が新ロジックで変わる                                       | むしろ正常化。移行の既定値をテストで固定                                 |
| 協調採点の競合生徒                                                           | totalScore=null で平均除外（既存踏襲）。Excel学級集計にも警告            |
| 小計グループ昇格のJSON解釈漏れ                                               | 移行・transformer双方にテスト。パース失敗時は空選択へフォールバック      |

---

## 10. テスト方針

- 受験日スナップショット解決（Phase 0）
- 登録学級ごとの集計・複数学級重複カウント（Phase 1）
- スキーマ移行: statistics→teacherStat の列コピー、settingsJson→ExamSubtotalGroupフラグのJSON解釈（Phase 2）
- アーカイブ往復（新フラグ・transformer）
- 削除2段階modalのデータ有無分岐（Phase 5）
- `npx vitest run` ＋ `npm run typecheck`

---

## 11. 統計強化issue（#833 / #838 / #834）の対応 — スキーマ変更ゼロ・トグルなし

本再設計の統計充実を、**追加のスキーマ変更を一切出さない**方針で同時に対応する。
必要データは既存 `ScoringData`（`scores[]`＝設問別得点/正誤、`totalScore`、`status`）に全て揃っており、
**新規テーブル・カラム・マイグレーションは不要**。

### 11.0 表示制御の方針：トグルなし・常時出力（重要決定 2026-06-29）

これらは**教員向けの分析データ**（Excel・出力プレビュー）。生徒に配るものではない（α/D値/S-P表は生徒PDFに載せない）。

- **on/offトグルを作らない**。不要な列・シートは教員が読み飛ばせばよいので、DB保存もJSON設定も**追加しない**。
- 例外: 将来シート/列が増えすぎたら **per-statではなく「拡張分析を含める」マスタートグル1個**で束ねて切る。今は不要。
- → `IndividualReportOptions` などの設定変更は **行わない**。純粋に計算関数＋Excel/プレビュー出力を足すだけ。

### 11.1 #833 クロンバックα係数・D値 ✅ 実装完了（コードレビュー指摘反映済み）

- **計算は共有純粋モジュール `electron-src/lib/shared/calculations/itemAnalysis.ts` に集約**（#838 の `spAnalysis.ts` と同じ方針）。
  `computeItemAnalysis(students)` が正答率・得点率・識別係数・D値・α を一括算出し、**Excel シートと出力プレビューが同一実装を共用**（ドリフト防止）。
  - **complete-case = `score===null` 除外**で統一（未採点に加え保留/未確定も除外、`no_answer`/`double_mark` は確定0として母集団に残す）。
  - **識別係数・D値・α は complete-case**（全 score 非null）で算出 → 採点途中の合計点による母集団の歪みを防止。
  - **D値は得点率差**（上位/下位27%群の `score/maxScore` 平均差）。二値設問では従来の正答率差と一致、部分点も比例反映。
  - Excel/プレビューとも識別係数・D値の**各セルを判定帯（0.2/0.3/0.4）で着色**（曖昧な単一「判定」列は廃止）。
  - 個人成績表向け `statisticsCalculator.ts` の `calculateDiscriminationIndices`/`getDiscriminationLevel` 等は**別消費者のため温存**（既存テスト維持）。`calculateCronbachAlpha`/`calculateDValues` は共有モジュールへ移設。
- **テスト**: `__tests__/calculations/itemAnalysisStats.test.ts`（α手計算=2/3、complete-case除外、部分点得点率差を検証）。`discriminationIndex.test.ts` は無改修で維持。
- サンプル不足時は `null`/「判定不可」表示。トグルなし。

### 11.2 #838 S-P表・得点度数分布ヒストグラム ✅ 実装完了

- 計算は共有純粋モジュール `electron-src/lib/shared/calculations/spAnalysis.ts` に集約し電子・フロント双方で共用
  （`src/` は `@/electron-src/...` で純粋モジュールを import 可。`learningAdviceCalculator.ts` が前例）。
  - `computeSpTable`: 生徒（正答数降順）×設問（正答者数降順）の二値マトリクス＋**佐藤の注意係数**（CS/CP、分母0は null）。
  - `computeFrequencyDistribution`: 合計点を約10階級に等分、母平均・母標準偏差。満点は最終階級。
- Excel: `spTableSheetCreator.ts`（S曲線=行右罫線/P曲線=列下罫線、注意係数列・行）、`frequencyDistributionSheetCreator.ts`（度数・割合・簡易バー・平均/SD）。`excelExportMain.ts` に配線（計5シート）。
- プレビュー: `useSpAnalysis.ts`＋`SpTablePreview.tsx`/`FrequencyDistributionChart.tsx`。`ExcelPreview.tsx` を grid-cols-3→5 にし「S-P表」「得点分布」タブ追加。
- トグルなし（常時出力）。テスト `spAnalysis.test.ts`（8件、注意係数の手計算検証含む）。

### 11.3 #834 R / exametrika 向けエクスポート ✅ 実装完了

- `electron-src/lib/export/r-exametrika/rDataExporter.ts`（設問×生徒の正誤行列を CSV/JSON、保存ダイアログ付き）
- 欠席/未採点は欠測（CSV空欄・JSON `binary:null`）、無回答は誤答(0)。JSONは元の `status` も保持し再コード可能
- IPC `export-r-data`（`exportHandlers.ts`）＋ preload `exportRData`（`exportApi.ts`/`exportApi.d.ts`）
- UI: 採点データExcelタブ内に CSV/JSON ボタン（`ExportOptionsCard.onExportRData`＋`ExportMainView.handleExportRData`）。新タブは作らず「オプション」路線で低リスク化
- `exportHandlers.ts` にIPC、`ExportOptionsCard.tsx` に出力導線（新タブ or オプション）

### 11.4 スキーマ判定

| issue | 新規テーブル | 新規カラム | マイグレーション | JSON設定 |
| ----- | ------------ | ---------- | ---------------- | -------- |
| #833  | なし         | なし       | **不要**         | なし     |
| #838  | なし         | なし       | **不要**         | なし     |
| #834  | なし         | なし       | **不要**         | なし     |

→ 学級統計の再設計（Phase 2でスキーマ変更あり）とは**完全に独立**。統計強化は純計算で完結。#833 → #838 → #834 の順に**すべて実装完了**。

---

## 12. 実装進捗と再開手順（コンパクション越しの継続用）

### 12.1 完了済み

- **設計合意**: 1〜11章すべて（3スイッチ・役割分担・受験日統一・memberships[0]廃止・削除2段階modal・JSON脱却B・PDF学級成績表見送り・統計強化はトグルなし）。
- **統計強化 #833/#838/#834 すべて実装完了**（スキーマ・JSON設定・トグルなし）:
  - **#833 α係数・D値**: `statisticsCalculator.ts` に `calculateCronbachAlpha`/`calculateDValues`。
    Excel `itemAnalysisSheetCreator.ts`（α行＋D値列）、`useItemAnalysis.ts`（`ItemAnalysisResult`+`dValue`）、`ItemAnalysisPreview.tsx`。
  - **#838 S-P表・得点度数分布**: 共有純粋計算 `electron-src/lib/shared/calculations/spAnalysis.ts`
    （`computeSpTable`＝佐藤の注意係数 / `computeFrequencyDistribution`）を電子・フロント双方で共用。
    Excel `spTableSheetCreator.ts`/`frequencyDistributionSheetCreator.ts`（`excelExportMain.ts` に配線）、
    プレビュー `useSpAnalysis.ts`＋`SpTablePreview.tsx`/`FrequencyDistributionChart.tsx`（`ExcelPreview.tsx` に S-P表/得点分布タブ追加）。
  - **#834 R/exametrikaエクスポート**: `electron-src/lib/export/r-exametrika/rDataExporter.ts`（設問×生徒の正誤行列をCSV/JSON、欠席/未採点は欠測）。
    IPC `export-r-data`（`exportHandlers.ts`）、preload `exportRData`（`exportApi.ts`＋`exportApi.d.ts`）、
    UI は採点データExcelタブ内に CSV/JSON ボタン（`ExportOptionsCard.tsx`＋`ExportMainView.handleExportRData`）。
  - **テスト**: `__tests__/calculations/itemAnalysisStats.test.ts`（11件）/`spAnalysis.test.ts`（8件）。
    `npx vitest run __tests__/calculations/` で計86件パス。typecheck・lint クリーン。

### 12.1.5 学級再設計 Phase 0〜4a 実装完了（2026-06-29、未コミット）

すべて作業ツリーに保持（未コミット）。フルテスト 856 passed / 1 failed（残り1件は既存の日付相対 grade テスト `gradeStudentCrud`、本変更前から失敗・無関係）。typecheck クリーン、自分のファイルは lint クリーン。

- **Phase 0 受験日統一（P3）**: `examClass.ts` の在籍解決 `getStudentClassInfoForExam`/`getStudentClassInfo` ＋一覧系 `getExamClasses`/`getAdministeredClasses`（旧 `endDate:null`）を `membershipFilterAt(getExamReferenceDate(examId))` に統一。テスト `__tests__/exam/integration/examStudentClass.test.ts`。
- **Phase 1 集計エンジン（P1/P2）**: `examClass.ts` に `getClassMembersForExam`（登録学級→受験日所属生徒・**重複カウント**）新設。`excel/dataFetcher.ts` の表示用学級情報を `memberships[0]` → order解決値へ（individual-report も `fetchExportData` 経由で是正）。フォールバック付き。
- **Phase 2 スキーマ＋移行**: `ExamClass` に `teacherStat`/`studentReport`、`ExamSubtotalGroup` に `selectedForTable`/`selectedForBoxPlot` 追加。migration `20260629120000_class_output_flags`（列追加＋ `teacherStat=旧statistics` / `studentReport=administered` の値移行）。archive `CURRENT_VERSION 1.15.0`（新フラグ optional、creator は旧フラグから補完、トランスフォーマー不要＝範囲方式）。
  - **⚠️ 実DBに適用済み**: `npm run dev` 起動時に `migrationDeployer` が `data/database.db` へ自動適用済み（teacherStat/studentReport あり、statistics 無し）。コードは未コミットだが**DBは先行**している。
- **Phase 3 statistics 完全削除＋UI**: schema から `statistics` 削除＋ `20260629130000_drop_examclass_statistics`（実DB適用済み）。`getStatisticsClasses` 関数・IPC・preload・d.ts・05チェックボックスを全撤去。05は「再採番」のみに簡素化。08左カードに **「統計対象学級」タブ**（`StatClassSelector`、教員集計/生徒表示の2列チェック）を追加。
  - **⚠️ 消し残り注意**: `statistics` 書き込みは examClass.ts だけでなく `import/exam-archive/dataCreator.ts`・`import/merge/idIntegrationImporter.ts`・テストヘルパー（`testExamBuilder`/`seed-in-test`）にも在った。Prisma7 の create 入力型が緩く typecheck で全部は捕捉できない→ **grep で全 `statistics:` 書き込みを洗うこと**。
- **Phase 4a Excel学級平均行（主成果）**: `excel/averageRows.ts` `appendClassAverageRows`（全体平均＋teacherStat学級ごとの平均、母集団=学級全体・全受験生徒データから集計）。`sheetCreators.createScoreSheet` に配線、`excelExportMain` で `fetchExportData(examId,[])`＋teacherStat学級を取得して渡す。テスト `__tests__/calculations/classAverageRows.test.ts`。
- **Phase 4b 個人成績表の複数学級比較（2026-06-30 実装）**: `StatisticsData.class`（単一）→ `classes: ClassStatEntry[]`（学級ごと average/stdDev/boxPlot/total/rank＋`memberStudentIds`）。`personal.classRank` 廃止→各エントリ `rank` へ。`statisticsCalculator.calculateStatisticsForStudent` は第4引数を `StudentClassForStats[]` に変更し学級ごと算出。`dataFetcher` が `getClassMembersForExam(examId).filter(studentReport)` ∩ 本人所属で `studentClasses` を構築。renderer `computeReportData.computeFilteredStats` は `memberStudentIds` で母集団を絞って再計算、`buildStatsItems` は学級ごとに「学級平均/順位」を展開（複数時は学級名付きラベル）。**消費は types/statisticsCalculator/dataFetcher/computeReportData の4ファイルのみ**（BoxPlotChart/ScoreTablePreview は `statistics.class` 不使用、generatePrintHtml は buildStatsItems 経由で自動対応）。テスト更新 `statisticsCalculator.test.ts`/`computeReportData.test.ts`（複数学級・空学級ケース追加）。
- **Phase 4c 小計グループのフラグ移行（2026-06-30 実装）**: source of truth を settingsJson から `ExamSubtotalGroup.selectedForTable/selectedForBoxPlot` へ。prisma `getSubtotalGroupSelection`/`setSubtotalGroupSelection`（指定外を false リセット）＋IPC `get/set-subtotal-group-selection`＋preload＋`cropRegionApi.d.ts`。`useExportPage`：読込時にフラグから `selectedGroupIds` を hydrate、保存時に `setSubtotalGroupSelection` 書込＋JSONから `selectedGroupIds` を `[]` 除去（`enabled` は JSON 維持）。migration `20260629140000_backfill_subtotal_selection_flags`（`json_each` で enabled=true の選択のみバックフィル、deployer の `;` 分割で2文・temp DB 検証済み）。レンダリングフィルタ `filterSubtotalScores` は selectedGroupIds 流用で無改修。アーカイブは Phase 2 で対応済み（dataCollector/dataCreator/型）。亡霊IDは ExamSubtotalGroup の FK カスケード削除で解消。テスト `__tests__/exam/integration/subtotalGroupSelection.test.ts`（4件）。
  - **フルテスト 862 passed / 1 failed**（残り1件は既存の日付相対 grade `gradeStudentCrud`、無関係）。typecheck クリーン。

### 12.2 次にやること（Phase 5）

- **Phase 5 UI共通化**: `src/components/common/class-roster/ClassRosterManager.tsx` 抽出（flagColumns 可変＝試験は再採番1列・成績/資料は0列）、3エンティティ（試験/成績/資料）の学級登録UI移行、**削除2段階modal**（3章：所属データ有無で分岐）、grade/coursework に class reorder API（`setClassOrders`）。教員用/生徒用フラグ(teacherStat/studentReport)は05に出さず08側UIで操作（既存）。

### 12.3 実装上の不変条件（壊さないこと）

- 統計強化(#833/#838/#834)は **スキーマ変更ゼロ・JSON設定追加なし・トグルなし**（11.0）。
- 学級の母集団は **受験日スナップショット**（`membershipFilterAt(exam.examDate)`）で判定（2.6）。
- 学級平均の母集団は **学級全体**（生徒選択チェックは母集団に無関係、5.1）。
- 用途1（採番）は1人1学級、用途2/3（教員/生徒統計）は重複カウント（2.4）。
- エンティティ参照はJSONに入れない（4.1）。
- 既定値（合意 2026-06-29）: **teacherStat=旧statistics**（生徒ごと追加=true/登録だけ=false）、**studentReport=administered**。`statistics` は廃止。
- **並行セッション注意**: 別 Claude が同一ツリーで grade/coursework を編集中。schema.prisma・テストDB(`data/test-database.db`) を共有し、同時テストで `prisma db push` が "table User already exists" で衝突する。git 操作・テストは衝突回避を意識。自分のファイルのみ add。
- 検証は常に `npx vitest run` ＋ `npm run typecheck`。
