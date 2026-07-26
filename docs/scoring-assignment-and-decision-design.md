# 設問別採点担当割当と確定フローの設計

対象 issue: **#840**（設問別の採点担当割当／分散採点）、および #839（匿名採点モード）を併記。
検討日: 2026-07-26。OWNER との対話で方針確定済み（末尾の「未決事項」を除く）。

---

## 0. 前提となる調査結果（重要）

### 0-1. 確定（final）のUI導線が存在しない

**`setShowScoreComparison(true)` がコードベースのどこからも呼ばれていない。**

- 定義: `src/components/exams/07-score-at-once/ScoringMain/hooks/useScoringMainState.ts:28`
- 唯一の使用箇所は `ScoringMainView.tsx:844` の `() => setShowScoreComparison(false)`
- キーボードショートカット（`ScoringMain/constants/keyboardShortcuts.ts`、全19行）にも該当コマンドなし

`ScoreComparisonModal`（比較・最終決定モーダル）は**到達不能な死んだUI**。バックエンドは完成している:

| 要素                         | 場所                                                          |
| ---------------------------- | ------------------------------------------------------------- |
| `ScoreDecision` モデル       | `prisma/schema.prisma:272-293`                                |
| 確定権限チェック             | `electron-src/lib/prisma/scoreDecision.ts:43`                 |
| `finalizeQuestionScore`      | `electron-src/lib/prisma/questionScore.ts`                    |
| `getQuestionScoreComparison` | `electron-src/lib/prisma/questionScore.ts:537`                |
| リゾルバの確定優先           | `electron-src/lib/shared/calculations/scoreResolution.ts:109` |

総合(overall) が「境界セット作成導線が無く実質存在しない」として撤去された件（コミット a940b77a）と同じパターン。

### 0-2. 出力前警告は既に存在する。問題は「行き止まり」と「埋没」

> ⚠ 本ドキュメント初版で「競合セルが黙って未採点として出力される」と記載したのは**誤り**。訂正済み。

競合は出力前警告に既に出ている。

| 要素           | 場所                                                                                         |
| -------------- | -------------------------------------------------------------------------------------------- |
| 競合の識別子化 | `electron-src/lib/shared/utilities/validateScoringData.ts:6`（`buildConflictIdentifiers`）   |
| 検証結果の生成 | 同 `:43`（`validateScoringData`）                                                            |
| 警告モーダル   | `src/components/exams/08-export/components/ExportWarningModal.tsx`（紫セクション `:86-105`） |
| 呼び出し       | `src/components/exams/08-export/ExportMainView.tsx:198-207`                                  |

`excel/dataFetcher.ts:86-91` の `console.warn` は二重の保険にすぎない。
**したがって「出力ゲートを新設する」は不要。既存モーダルの改修に置き換える。**

実際の欠陥は2つ。

**(a) 警告が「できないこと」を指示している**

`ExportWarningModal.tsx:94` は「採点画面の比較モーダルから、試験の所有者が結果を確定してください」と表示するが、
**その比較モーダルは開けない**（0-1 参照）。指示通りに操作しても辿り着けない行き止まりの警告。

**(b) 本当に対処が要る警告が、正常な作業途中の警告に埋没する**

- 警告はすべて `"生徒名 - 設問ラベル"` のフラットな文字列配列（`validateScoringData.ts:59`）
- 描画は `<div>• {item}</div>` の素の全件列挙。上限も折りたたみも無い（`ExportWarningModal.tsx:75-79` ほか）
- 40人×25問＝1000セルの試験で採点が半分なら `noScoringData` だけで **500行**
- 4カテゴリが同じ強さで縦に積まれ、**競合（紫）は3番目**

結果、対処が要る競合3件が、正常な作業途中を示すだけの500行に埋もれる。
未採点は採点途中に出力すれば必ず出るため、毎回オオカミ少年になって読まれなくなる。

### 0-3. `canDecideScore` の個人利用フォールバックはほぼ死んでいる

`scoreDecision.ts:56-60` は「`UserExam` が1件も無い試験は制限しない」としているが、

- `createExam` が作成者を必ず OWNER として登録（`electron-src/lib/prisma/exam.ts:176`）
- インポートも現在ユーザーを OWNER として1件作成（`exam-archive/dataCreator.ts:259`）

したがって**新規試験でこの分岐に入ることはない**。実質は旧データ専用の経路。個人利用の判定材料としては使えない。

### 0-4. `QuestionScore` に unique 制約が無い

`prisma/schema.prisma:254-267` に `(cropRegionId, studentId, userId)` の unique が無く、書き込みは
`findFirst` → `update` / `create` の read-modify-write（`questionScore.ts:270-330`）。
NAS 同期下で**同一採点者の重複提案行**が生まれ得る。複数担当を本格運用すると踏みやすくなる。

> CLAUDE.md の「QuestionScoreのunique_final_score制約に注意」は現行スキーマに存在せず、記述が古い。

### 0-5. 権限の現状（OWNER / GRADER）

`UserExam.role = "OWNER" | "GRADER"`（`schema.prisma:229`）。**採点行為そのものに権限差は無い。**

OWNER だけができること:

| 操作                              | 実装                  |
| --------------------------------- | --------------------- |
| 採点結果の確定（`ScoreDecision`） | `scoreDecision.ts:64` |
| メンバー招待                      | `userExam.ts:132`     |
| メンバー削除（OWNER 自身は不可）  | `userExam.ts:190,205` |
| オーナー移譲                      | `userExam.ts:247`     |

`User.role`（`"teacher"` / `"admin"`）というグローバルロールも別に存在するが、**表示に出るだけで権限判定には一切使われていない**（初期ユーザーが admin になる `databaseSetup.ts:42` のみ）。

---

## 1. 設計の中心原則

> **確定が必須なのは「リゾルバが値を出せなかったセル」だけ。**

`resolveEffectiveScores`（`scoreResolution.ts:109`）は生徒×設問ごとに4分岐する:

| 状況                 | 結果                             | 確定の要否 |
| -------------------- | -------------------------------- | ---------- |
| 提案が1件            | そのまま採用                     | 不要       |
| 複数の提案が全一致   | 合意として採用                   | 不要       |
| 複数の提案が食い違う | 値を出せず `conflicts` へ        | **必須**   |
| `ScoreDecision` あり | 確定を採用（`isStale` 判定あり） | 済         |

これにより「単独採点者は確定フローを一生見ない／協調採点では確実に通る」が**運用ルールではなくデータの実態で**自動的に両立する。単独採点では提案が常に1件なので競合は構造的にゼロになる。

**全セルを確定して回る必要は無い。**

---

## 2. 確定した設計判断

### 2-1. 担当割当は新テーブル（複数担当が要件）

```prisma
model CropRegionAssignment {
  id           String     @id  // uuidv5(cropRegionId + userId) で決定論的に生成
  cropRegionId String
  userId       String
  assignedBy   String?    // 割り当てたOWNER（監査用）
  createdAt    DateTime   @default(now())
  updatedAt    DateTime   @default(now()) @updatedAt
  cropRegion   CropRegion @relation(fields: [cropRegionId], references: [id], onDelete: Cascade, onUpdate: NoAction)
  user         User       @relation(fields: [userId], references: [id], onDelete: Cascade, onUpdate: NoAction)
  assigner     User?      @relation("AssignedByUser", fields: [assignedBy], references: [id], onDelete: SetNull, onUpdate: NoAction)

  @@unique([cropRegionId, userId])
  @@index([userId])
}
```

- **id は決定論的に生成する。** `@default(uuid())` だと2端末が同じ (設問, 担当者) ペアを割り当てたとき
  uuid 違い・unique 同値の行が sync で衝突する。同一 id なら LWW で収束する。
- 割当先は `UserExam` のメンバーに限定（招待は既存の `MemberInviteDialog` の責務）。
- 編集権限は OWNER のみ（`canDecideScore` と同型の `canManageAssignments` を追加）。
- sqlite-nas-sync はテーブルを自動検出するので `syncTableConfig.ts` への登録は不要（除外リスト方式）。

**却下した案**: `CropRegion.assignedUserId String?` の列追加。1設問1担当しか表現できず、複数担当（ダブルチェック）の要件を満たさないため。

### 2-2. 担当割当は「選択可能な設問集合」を定義する

権限で弾くのではなく、**担当外の設問はその人の選択肢に出てこない**（`QuestionNavigator` のプルダウン、前/次移動、グリッド表示対象が連動）。バックエンドでの拒否は書かない。

- **担当0人の設問は「全員担当」とみなす。** そうしないと割当漏れの設問が誰の選択肢にも入らず採点不能になる。
  割当を一度も使っていない試験は全設問が担当0なので**従来通り全員が全設問**となり、後方互換が自動的に保たれる。
- **OWNER は担当に関係なく全設問を選択可**（裁定者のため）。OWNER が自分にも担当を割り当てる運用とも両立。
- 実装上、`useScoringEffects.ts:88-96` の「最初の QUESTION_ANSWER を自動選択」を担当集合の先頭に変える必要がある。

### 2-3. リゾルバ（`resolveEffectiveScores`）は変更しない

担当割当は**完了状況の計算材料としてのみ**使い、有効スコアの解決ルールは現状のまま。

- 理由: このリゾルバは Excel・PDF・個人レポート・成績連携・返却スナップショットの**全出力が依存する中核**。
  ここに担当集合を通すと影響範囲が大きすぎる。
- 「参考」のような**永続化された別状態は作らない**。担当者集合に入っていない人の提案は、確定パネルが表示時に色分けするだけ。
- **帰結（OWNER 了承済み・要最終確認）**: 担当2人のうち1人しか採点していないセルも、その1人の値が合意として出力に出る。
  ブロックしない。OWNER が確定パネルで「1/2」と見て判断する運用。

> 検討過程では「未完了」状態をリゾルバに導入する案もあったが、上記理由により**採用しない**。
> これにより当初見積 7〜8日 → 5〜6日 に減った。

### 2-4. 保証点は既存の `ExportWarningModal` の改修（新設しない・ブロックしない）

「協調採点を使った場合は確実に確定フローを通る」の担保は**出力の直前**に置く。
ただし 0-2 の通り既に存在するので、**新設ではなく `ExportWarningModal` と `validateScoringData` の作り直し**とする。

**コンポーネント名は `ExportWarningModal` のまま据え置く。** ダイアログのタイトルも「警告」を維持する
（「出力前の確認」等に柔らげると、警告であるという信号が弱まる）。変えるのは中身の構造だけ。

**方針: カテゴリを「対処が要る」と「知っておけばよい」の二層に分ける。** 現状は4カテゴリが横並びだが性質が違う。

| カテゴリ                                               | 性質                               | 扱い                                     |
| ------------------------------------------------------ | ---------------------------------- | ---------------------------------------- |
| 採点者間の食い違い（`conflicted`）                     | **値が出ない**。OWNER しか直せない | 要対処・常に展開・行動ボタン付き・最上位 |
| 採点データなし／未採点（`noScoringData` / `ungraded`） | 作業途中なら**正常**               | 件数のみ・折りたたみ                     |
| 部分点の未入力（`missingPartialScore`）                | 入力漏れの可能性                   | 件数のみ・折りたたみ                     |

```
┌─ 警告 ───────────────────────────────────────┐
│ ⚠ 対処が必要                                   │
│   採点者間で結果が食い違っています  3件         │
│     田中 太郎  問3（5点）  正解 / 3点          │
│     鈴木 花子  問7（3点）  3点 / 1点           │
│     佐藤 次郎  問3（5点）  正解 / 0点          │
│   → 合計点が最大13点低く出ます                 │
│   [ 確定パネルを開いて解決する ]               │
│                                               │
│ ℹ 確認（出力は可能です）                       │
│   未採点              320件   [▸ 内訳]         │
│   部分点の未入力        2件   [▸ 内訳]         │
│                                               │
│ [ キャンセル ]        [ このまま出力 ]         │
└───────────────────────────────────────────────┘
```

具体的な改修点:

1. **内訳は設問ごとに集約する。** 現状の `"生徒名 - 設問ラベル"` 全列挙（500行）ではなく
   「問3: 12名未採点」「問7: 32名未採点（未着手）」（25行）に。行数が減るだけでなく行動に繋がる情報になる。
2. **競合には具体を出す。** 生徒名・設問・配点・各採点者の判定、および「合計点が最大N点低く出ます」という
   点数影響。「未採点として出力されます」だけでは何が起きるか伝わらない。
3. **`ExportWarningModal.tsx:94` の行き止まり文言を、確定パネルを開くボタンに置き換える**（Phase 1 の中心）。
4. **採点画面ではブロックしない。** 採点中に競合が出るのは正常な過程であり、止めると邪魔なだけ。
5. **出力は止めない**（→ 未決事項1の結論）。ただし競合ありで続行した場合は `exam.export` の監査ログ
   （`AUDIT_ACTIONS`、`electron-src/lib/prisma/auditActions.ts:55`）に競合件数と対象を記録する。
   配布物（Excel/PDF）は汚さず、後から「あの出力は競合N件込みだった」を辿れるようにする。
6. 同じ警告は PDF・個人レポート・返却スナップショットにも効かせる（全て同じリゾルバを通る）。

### 2-5. 可視性の3段階

| 段階       | 条件                         | 見え方                                                               |
| ---------- | ---------------------------- | -------------------------------------------------------------------- |
| 単独採点   | 採点者が1人                  | **何も出ない**。パネル起動ボタンも出さない                           |
| 協調採点中 | 採点者が複数 or 担当割当あり | サイドパネルに起動ボタン。競合セルはグリッド上でも印                 |
| 出力時     | 競合 > 0                     | `ExportWarningModal` の「対処が必要」層に上がり、パネルへ誘導（2-4） |

第1段階の判定は**実際に採点した distinct なユーザー数**で行う。`UserExam` の件数では判定できない（0-3 参照）。

`ExportWarningModal` 自体は未採点等でも開くが、**競合は単独採点では構造的にゼロ**（提案が1件なら常に解決される）。
したがって「対処が必要」層は協調採点で実際に食い違ったときにしか出現しない。
**滅多に出ない警告は読まれる** — この希少性を保つことが、2-4 の二層化の狙いでもある。

### 2-6. UI は 07 内の統合パネル1枚（画面遷移なし）

現行 `ScoreComparisonModal` は `studentId × cropRegionId` を props に取る**セル1個専用**の作り（`ScoreComparisonModal.tsx:33-41`）。
競合が10件あれば10回開くことになり使えない。導線が無いまま放置された理由もここにあると思われる。

**採用する構成**: サイドパネルのボタンとショートカットから開く、画面をほぼ覆う1枚のダイアログ。

```
┌─ 採点の割り当てと確定 ───────────────────────────────┐
│  設問       担当         完了        要裁定   確定済     │
│ ─────────────────────────────────────────────────────── │
│  問1  [A先生][B先生][+]  32/32 32/32    3件      29/32   │
│  問2  [A先生]        [+] 30/32          －      0/32     │
│  問3  （担当なし）   [+] 12/32          －      0/32     │
│   └ 展開すると要裁定の生徒行 → 右ペインに比較・確定      │
└──────────────────────────────────────────────────────────┘
```

- 左が設問行。担当バッジは OWNER なら直接編集（`+` で追加、バッジ × で解除）。GRADER には読み取り専用。
- 完了列は担当者ごとの採点済み件数。担当なしの設問は全体進捗のみ。
- 設問行を開くと要裁定の生徒が並び、選ぶと右ペインに比較・確定フォーム。**モーダルの入れ子を作らない**のが肝。
- 既存 `ScoreComparisonModal` は殻（Dialog）を捨てて中身をコンポーネント化し、右ペインとして再利用する。
  `getQuestionScoreComparison` / `finalizeQuestionScore` はそのまま使える。
- GRADER が開けば「自分の担当と進み具合」のダッシュボードとして機能する。

**03-region-info には置かない。** あそこは領域の構造定義であって運用情報ではない。

> ⚠ **実装時の罠**: この設問×担当者マトリクスは
> [密行列UIの添字結合の罠](../CLAUDE.md) で過去に踏んだパターンそのもの。
> 行に `CropRegion` 実体、バッジに `User` 実体を同梱し、割当の書き込みは必ず `(cropRegionId, userId)` のペアで行う。
> `i` / `j` から引かない。

### 2-7. アーカイブ

- バージョン **1.20.0**（1.19.0 = delete-sync-redesign の上に積む）
- **実装では `assignments.json` を新設せず、`scores.json`（`ArchiveScoresData.cropRegionAssignments`）に載せた。**
  `scoreDecisions` / `returnSnapshots` と同じ採点層の付随データであり、
  ファイルを増やすと archiveCreator / archiveExtractor の両方に配管が生えるため。
- **id は持ち回らない。** `(cropRegionId, userId)` から決定論的に再生成する
  （`buildAssignmentId`）。移行先でどの端末がインポートしても同じ id になり同期で1行へ収束する。
  `assignedBy` も持ち回らず、インポート実行者で埋める（監査用の付随情報のため）。
- **ユーザーはアーカイブを越えない**（`dataCollector.ts:532` で `userExams: []`、`users.json` は currentUser 1件のみ、
  `QuestionScore.userId` も import 時に全行 currentUser へ上書き）。
  したがって割当は **`username` を denormalize** して持たせ、import 時に移行先DBの `User.username` で lookup、
  解決不能なら破棄＋警告（grade-archive の「既存前提lookup」流儀）。新規ユーザーは作らない。

---

## 3. フェーズ分割

|                     | 内容                                                                                                                                                                                     | 工数  |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| **Phase 1**         | 統合パネルの骨格＋確定導線の復活（`ScoreComparisonModal` の中身を右ペイン化）＋ `ExportWarningModal` / `validateScoringData` の二層化改修（0-2 の (a)(b) 解消）＋ `exam.export` 監査ログ | 2日   |
| **Phase 2**         | `CropRegionAssignment` + パネルへの割当UI + 担当別完了状況 + 選択可能設問の絞り込み + archive 1.20.0                                                                                     | 3日   |
| **Phase 3（任意）** | `QuestionScore` の `@@unique` 追加＋重複マージ migration（0-4）                                                                                                                          | 0.5日 |

- **Phase 1 は担当割当なしで単独に成立する。** それだけで「警告が行き止まりを指示している」「対処すべき警告が
  500行に埋没する」という現在の実害が解消する。別 issue を立てて先行させる価値がある（→ 未決事項1）。
- Phase 2 は同じパネルに列を足していく形なので作り直しは発生しない。

---

## 4. 決着した論点と未決事項

### 決着済み

**出力を止めるか（旧・未決事項1）→ 止めない。**
OWNER の裁定「成績表を出した人が分かってそうしているなら、それで良い。問題はちゃんと伝わるか」。
判断者の裁量を妨げず、**設計努力は「止める」ではなく「伝える」に全振りする**（2-4 の具体策）。
競合ゼロまでブロックする案は、回避策として「中身を見ずに適当に確定する」を誘発し、
かえって質を下げるため却下。締切直前に1セルで出力不能になるリスクも許容できない。

**担当未完了セルの扱い（旧・未決事項2）→ 値を出す。**
リゾルバは変更せず（2-3）、`ExportWarningModal` の「知っておけばよい」層に
「担当者が採点を終えていないセルが N 件（採点済み1名分の値で出力されます）」として情報表示する。
これによりリゾルバを触らずに「ダブルチェックしたつもりで実は片手落ち」のリスクだけ潰せる。

**Phase 1 を別 issue にするか（旧・未決事項）→ #840 に含める。** issue は一本、PR を2本に分ける。

### 実装時に加えた判断（設計時に想定していなかったもの）

- **裁定サマリの取得失敗を空配列にしない。** `ScoringValidationResult.conflictCheckError` を立てて
  必ず警告を出す。空の `conflicted` が「食い違いなし」と読まれるのが、この設計で唯一
  「伝える」に失敗する経路だったため。
- **サマリ取得は全採点行に氏名 join を効かせない。** リゾルバに要る列だけで引き、
  氏名は裁定対象セル（通常わずか）が確定してから引く。400人×40設問×3人 ≒ 4.8万行で効く。
- **監査ログは出力の完了後に書く。** 保存ダイアログのキャンセルで
  「配った」という嘘の記録が残らないようにする。
- **担当が外れた設問に留まらせない。** `currentCropRegionId` が選択可能集合から
  外れたら null に戻し、担当集合の先頭を選び直させる。

### 未決

なし（Phase 3 は任意）。

---

## 5. #962 との関係（順序）

**#840 を先に実行してよい。コストは爆発しない。**

#962 は `StudentAnswerImage` / `QuestionScore` / `ScoreDecision` のキーを Student → ExamStudent へ昇格するかの
**設計検討**（label: question）。影響範囲は `electron-src/lib` だけで `studentId` 参照 66ファイル、
`questionScore.` / `scoreDecision.` 参照 24ファイル。

- **`CropRegionAssignment` は `studentId` を一切持たない**（キーは `cropRegionId` × `userId`）。#962 の対象層と直交する。
- #840 が #962 に足す負担は、確定パネルが `studentId` の消費者として1〜2ファイル増えるだけ。66ファイルに対して数％。
  しかも `getQuestionScoreComparison` / `finalizeQuestionScore` は #962 がどのみち書き換える対象。
- 逆順（#962 先）のほうが危険。#962 は結論が出ていない設計検討であり、
  確定済みの機能を未決の検討でブロックすることになる。#962 自身が「片方だけ ExamStudent 化すると層がねじれる」と
  述べており、**「変更しない」で終わる可能性もある**。
- アーカイブのバージョンは #840 が 1.20.0 を取り、#962 が実施されるならその上に積む。順序の問題だけでコスト増ではない。

---

## 6. 併記: #839 匿名採点モード

#840 とは独立。スキーマ変更なし。**0.5〜1日**。

### 現状

`showStudentNames`（UserPreference KV、`src/lib/userPreferences.ts:8`、デフォルト `true`）が既に存在するが、

- **実効範囲は `ScoringGrid/GridCell.tsx:146,155` のグリッドのラベル1箇所のみ**
- **UIトグルが無い**。`useScoringShortcuts.ts:253` の `view.toggleStudentNames` ショートカットからしか切り替えられない

つまり新機能というより**既存機能の穴埋め＋UI露出**。

### 漏れ経路の棚卸し

| 箇所                                                  | 内容                                                                                   | 状態   |
| ----------------------------------------------------- | -------------------------------------------------------------------------------------- | ------ |
| `ScoringGrid/GridCell.tsx:146,155`                    | セル下の氏名ラベル                                                                     | 対応済 |
| `ScoringGrid/GridCell.tsx:127`                        | `alt="○○の答案"`                                                                       | 未対応 |
| `ScoringIndividual/StudentAnswerPanel.tsx:80,87`      | 生徒セレクト（氏名＋出席番号）                                                         | 未対応 |
| `ScoringSidePanel/AnnotationBrowserPanel.tsx:333,481` | 生徒一覧                                                                               | 未対応 |
| `ScoringMain/ScoreComparisonModal.tsx:197`            | 競合解決モーダルの氏名                                                                 | 未対応 |
| 個別表示のページ画像                                  | ページ全体描画なので氏名欄が写る                                                       | 未対応 |
| グリッドの答案画像                                    | 通常は設問領域にクロップされるが `expandMargin` 拡張時や領域が氏名欄と重なる場合に写る | 未対応 |

### 実装ポイント

- 採点画面は `getQuestionAnswerRegionsByExamId`（`electron-src/lib/prisma/cropRegion.ts:231`）で
  **QUESTION_ANSWER 型しかロードしていない**ため `STUDENT_NAME` / `STUDENT_ID` 領域を持っていない。
  既存の `getCropRegionsByExamId`（全型を返す、06 の `useNameRegion.ts` で使用中）で追加取得する。
- 画像マスクの差し込みは2箇所:
  - 個別表示: `ScoringIndividual/hooks/core/useCanvasDrawing.ts:267` の `ctx.drawImage` 直後
  - グリッド: `ScoringMain/CroppedAnswerImage.tsx` の可視矩形（`newX/newY/newWidth/newHeight`）と交差するときだけ塗る

### 設計提案（未承認）

- `showStudentNames` を **`anonymousScoring`（デフォルト `false`）に一本化**し、`showStudentNames` は削除。
  「名前ラベルだけ隠すが画像の氏名欄は出す」中間状態に実用的意味がなく、2キー並存は必ず片方の漏れを生む。
  UserPreference は `SYNC_EXCLUDE_TABLES`（`syncTableConfig.ts:18`）で端末ローカルなので、
  移行は「旧キーが `false` なら新キー `true` として読む」フォールバック1回で済む。
- **「採点完了後に自動解除」は実装しない。** 勝手に匿名が解けるのは事故のもと。明示トグルのみで受け入れ条件を満たす。
- **任意提案**: 並び順が `customOrder`（出席番号順、`useScoringFilter.ts:120-141`）のままなので、
  名簿を把握している教員は順序から生徒を推測できる。匿名モード中は `studentAnswerImage.id`（uuid）順にすると、
  名簿と無関係かつ再読込しても安定した並びになる。バイアス低減という目的からするとここが本丸の可能性がある。
