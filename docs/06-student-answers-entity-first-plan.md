# 06-生徒答案 データ設計是正計画（entity-first）

> 目的: 06-student-answers の**データの持ち方・渡し方**を規約に合わせて正す。機能追加ではない。
> **UI/UX は変えない。** 変えるのはデータ構造・同定・受け渡しのみ。
> 本計画は `06-student-answers-cell-architecture-plan.md` の**データモデル設計（`AnswerItem` 投射）を破棄・置換**する
> （あの計画は「Prisma 素通し」と書きつつ投射型を保存後データにまで敷衍しており、原則違反だった）。
> 作成: 2026-07-12。

---

## 0. 最重要原則（絶対遵守・ここから外れない）

1. **保存後（DB）データは Prisma `include` が作るエンティティグラフをそのまま持つ。** 射影・平坦化・scalar 抜き出しの中間型（`AnswerItem` / `convertAnswerSheetsToFiles` / 旧 `ProcessedStudentAnswer`）を**作らない**。
2. **表示値（`pageNumber`・氏名など）は「最後の表示」でエンティティから計算するだけ。** state / props には持たせない。列見出しは `examPage.pageNumber`、氏名は `student.lastName + firstName` をその場で導出。
3. **同定・key は id のみ。** sqlite-nas-sync は **id 以外の unique を同期違反**として扱う（二次 unique は LWW 収束するが本質的ハザード）。→ **`pageNumber` 等の序数は恒久的に key になり得ない。** セル・列・答案の同定は `id` / `examPageId` / `studentId`(=Student.id) で行う。DnD の droppable も `cell:${studentId}:${examPageId}`。
4. これは**規約遵守のデータ設計リファクタ**。DnD 修正はその副次物。**操作体験は不変。**

---

## 0.5 実装開始前の起点確立（git baseline・着手前に必須）

> このリポジトリは**複数の Claude Code セッションが同一作業ツリーで並行**する。着手前に必ず起点を固定すること（`git branch --show-current` で自分のブランチにいるか毎回確認。共有 dirty ツリーで `reset`/`checkout`/`merge` を打つ前に特に確認。他セッションが HEAD を勝手に別ブランチへ動かしている事故が実在した）。

**着手時点の事実**:

- 旧 `06-student-answers-cell-architecture-plan.md`（`AnswerItem` 投射設計）の実装が**作業ツリーに未コミットで存在**する。これは本計画が**撤去・置換する対象**（§6）。現時点で typecheck はグリーン。
- DnD 修正 **#964**（upload 方式A の「有効ファイルのみ並べ替え＝trash を巻き込まない」修正）は**既に `origin/main` にマージ済み**。

**手順（実装開始前に1回だけ）**:

1. `git fetch origin` → **`origin/main`（#964 込み）を base に専用ブランチを作成**する。他セッションのブランチ上・共有 dirty ツリー直で始めない。
2. 現在の作業ツリー（旧設計 WIP・グリーン）を専用ブランチに**チェックポイント commit**（復旧点。以後の各段階 diff がこの baseline 基準で読める）。
   - この WIP には §6「保持」対象（DnD 方式B実装・Phase0 backend）と「撤去」対象（`AnswerItem` 層）が混在する。**両方この baseline に含めてよい**——保持分は活かし、撤去分は Step 2 の diff として消す。
3. 以後 §8 の Step 1→4 を、各段階 typecheck/lint/test グリーンで進める。

**#964 の非回帰（厳守）**: upload 方式A の並べ替えは「**同一コンテナ（main=有効 / trash=無効）内のファイルだけ**を対象にし、trash を巻き込まない」不変条件を持つ。Step 4 で `FileState`/`UploadData` を `examPageId` 化する際、この不変条件を**回帰させない**（実装参照: `useDragDropHandlers.ts` の方式A分岐、`getEnabledFiles()`/`getDisabledFiles()` でコンテナ限定）。

---

## 1. 一元化するデータ実体：`StudentAnswerImage`

新規追加（upload）と確認（view）で、テーブル・DnD が扱う実体を **`StudentAnswerImage`（`examPage`・`student` 込み）に統一**する。投射型もアダプターも置かない。

**スキーマ事実**（`prisma/schema.prisma`）:

```
model StudentAnswerImage {
  id String @id @default(uuid())
  examPageId String       // 必須
  studentId  String       // 必須（→ Student.id）
  imagePath  String       // 必須（ディスク上のパス）
  examPage ExamPage @relation(...)   // 子
  student  Student  @relation(...)   // 子
  @@unique([examPageId, studentId])
}
```

- **view（保存後）**: `StudentAnswerImageGetPayload<{ include: { examPage, student } }>` を**DB からそのまま**保持。
- **upload（未保存）**: 同じ**フィールド構造**の「まだ保存されていない `StudentAnswerImage`」。
  - `id` = client 側で uuid 発行（`crypto.randomUUID()`）。
  - `examPage` / `student` = **既存実体を参照**（供給クエリの `examPages` / 名簿の `student`）。セルに配置された時に代入。未配置（トレイ/無効化）時は null。
  - バイトは **state 上の `buffer`**（現状どおりメモリ保持）。`imagePath` は保存まで null。
  - **差分は「画像バイトの在り処（`buffer` か `imagePath` か）」の1点のみ。** これはエンティティを潰す投射ではなく、未永続バイトのための任意フィールド追加に過ぎない。
- **テーブルに渡るのは配置済み（`examPage`/`student` あり）の同一構造だけ。** 未配置の pending 項目は upload 側 hook が別に管理する（下記 §3）。

> 型は実装時に確定するが、目安: view = 上記 Prisma payload そのまま。upload = `Omit<…payload, "imagePath"> & { imagePath: string | null; buffer?: ArrayBuffer }`（＝**構造は同じ・バイト源だけ可変**）。

---

## 2. 供給層：Exam 根の複合 1 クエリ

現状の 3 本（`getStudentsForExam` / `getStudentAnswersByExamId` / `getExamPagesByExamId`）を、`Exam` を根にした**複合 1 include** に寄せ、そのまま保持する。

```ts
prisma.exam.findUnique({
  where: { id: examId },
  include: {
    examStudents: {
      orderBy: [{ customOrder: "asc" }, { student: { studentNumber: "asc" } }],
      include: {
        student: { include: { memberships: { include: { classroom: true } } } },
      },
    },
    examPages: {
      orderBy: { pageNumber: "asc" },
      include: { studentAnswerImages: { include: { student: true } } },
    },
  },
})
```

- **行 = `examStudents`（ExamStudent 実体）／列 = `examPages`（ExamPage 実体）／セル = そのマスの `studentAnswerImage`（実体）or 空。**
- `modelAnswerCount = Math.max(pageNumber)` の**合成は廃止**。列は `examPages` を回すだけ。
- `ExamForDetail`（`prismaExtensions.ts:153`）で確立済みのパターン。06 専用の軽量版を新設（cropRegions/score は含めない）。

---

## 3. モード差は hooks が吸収する（テーブルは共通）

**テーブル（描画）は共通コンポーネント。** 渡るのは同じ `StudentAnswerImage` 構造だけ。モード固有の一切は hooks に閉じる。

- **upload hook**: メモリ state・`buffer`・配置（セルへの `examPage`/`student` 代入）・マーカー補正（buffer 上で実行）・確定時のディスク保存＋`StudentAnswerImage` 挿入（既存 `ExamPage`/`Student` へ nested `connect`）。
- **view hook**: DB 実体保持・pendingChange 生成・`applyStudentAnswerPlacements` 適用。

テーブルは「配置済み `StudentAnswerImage` を描画し、表示値を末端で計算する」ことだけを知る。buffer/imagePath/マーカー補正/確定 vs 適用の差は**テーブルに漏らさない**。

---

## 4. DnD（方式別・座標は id）

- **view = 方式B（グリッドドロップ + swap）**: 素の `useDraggable`（答案 = `studentAnswerImage.id`）＋ `useDroppable`（マス = `cell:${studentId}:${examPageId}`）。sortable は使わない（reflow で他マスが動かない）。空マスへ = 移動、占有マスへ = 2者入れ替え、それ以外に影響しない。
- **upload = 方式A（`SortableContext` + sortable）**: 束画像の並べ替え割り当て。
- `cell` droppable・`FileState`・pendingChange・`UploadData` を**すべて `examPageId` 基準**へ（`pageNumber` を key に使わない）。表示のページ番号は `examPage.pageNumber`。

---

## 5. 配置適用・保存（examPageId 直指定）

- `applyStudentAnswerPlacements`（view 適用）を **`finalExamPageId` 受け**に（現状の `finalPageNumber` → `ExamPage.findFirst` 解決を廃止し id 直指定）。採点安全モデル（追従/破棄・`QuestionScore`＋`ScoreDecision` 同時処理）は**維持**。
- `uploadStudentAnswers`（upload 保存）を **`examPageId` 受け**に（現状の `pageNumber` から `ExamPage` find/create を廃止し、既存 `ExamPage.id` へ `connect`）。

---

## 6. 廃止・是正リスト（現状コードからの差分）

| 対象                                                                    | 是正                                                        |
| ----------------------------------------------------------------------- | ----------------------------------------------------------- |
| `AnswerItem`（保存後データの投射型）                                    | **撤去**。view は `StudentAnswerImage` 実体を直接描画       |
| `convertAnswerSheetsToFiles`（射影）                                    | **撤去**                                                    |
| `existingAnswerOccupancy` `{id,studentId,pageNumber}`（占有信号の射影） | **撤去**。占有は `examPages[].studentAnswerImages` から導出 |
| `modelAnswerCount = Math.max(pageNumber)`                               | **撤去**。列は `examPages` 実体                             |
| cell droppable `cell:studentId:pageNumber`                              | `cell:studentId:examPageId`                                 |
| `UploadData.pageNumber` / `FileState.pageNumber`                        | `examPageId`                                                |
| 3 本の供給クエリ                                                        | Exam 根の複合 1 クエリ                                      |

**保持（既に正しい・作り直さない）**:

- Phase 0 backend `applyStudentAnswerPlacements` の 2 軸（examPageId + studentId）・採点安全ロジック（`finalPageNumber` → `finalExamPageId` の引数化のみ）。
- 本セッションの DnD 方式B 実装（`DraggableAnswerCell` / 素の draggable+droppable / 孤立答案枠）。**key を examPageId 化する差分のみ**適用し、挙動は不変。

**孤立答案（orphan）導出の要件（黙って捨てない）**:

- orphan = `examPages[].studentAnswerImages` のうち、その `student` が現ロスター（`examStudents`）に居ない画像（除籍等でマスに置けない）。占有は実体から導出し、`AnswerItem`/`partitionAnswerItemsByPlacement` のような射影は使わない。
- **配置できない画像は必ず孤立枠に可視化する。** 集計・マップ構築の途中で対象を上書き・欠落させて画面から消してはならない（旧 `partitionAnswerItemsByPlacement` は同一セル衝突時に先勝ちで後続を無言破棄していた——エンティティモデルでは `@@unique([examPageId, studentId])` によりセル衝突自体が構造的に起きないが、「解決不能な画像を黙って落とさない」原則は導出ロジックで担保すること）。

---

## 7. スコープ外（本計画では一切触れない）

- **`StudentAnswerImage` を `ExamStudent` へ繋ぎ直す件**（本来 `ExamStudent` に繋ぐべきものを `Student` に繋いでいる）は、**別の直後タスク（スキーマ変更）**。本計画は「型・データの持ち方の是正」に限定し、これには踏み込まない・将来案も書かない。
  - （検討済み）「全データフローを `studentId=Student.id` で examPageId 化 → 直後に再接続」は同じ経路を二度触るコストがある。それでも本計画は**スコープ厳守と UI/UX 不変**を優先し、再接続は後続タスクに切り出す方針で確定。examPageId 化で導入する同定基盤は再接続後もそのまま使えるため、二度手間は key 張り替えではなく `studentId` 参照先の差し替えに限られる。
- `pageNumber` 以外の UI/機能変更なし。

---

## 8. 実装順（各段階で typecheck/lint/test グリーン・UI/UX 不変）

0. **起点確立（§0.5）**: `origin/main`（#964 込み）base の専用ブランチを作り、現 WIP をチェックポイント commit。ここを baseline にする。
1. **供給層**: 複合 include + IPC + 型（例 `StudentAnswersDataset`）を新設。06 hook を 1 本化し、`examStudents`/`examPages`(+answers) を実体保持。`modelAnswerCount` 合成廃止。
2. **view のデータ実体化**: `AnswerItem`/`convertAnswerSheetsToFiles`/`existingAnswerOccupancy` を撤去。view テーブル・セル・DnD を `StudentAnswerImage` 実体＋`examPageId` 基準へ。表示値は末端計算。
3. **配置適用/保存の examPageId 化**: `applyStudentAnswerPlacements` / `uploadStudentAnswers` を id 直指定に。
4. **upload のデータ実体化**: pending 項目を `StudentAnswerImage` 形（uuid・既存 examPage/student 参照・buffer は state）に。マーカー補正・確定保存を hook に閉じる。
5. **検証**: typecheck/lint/test、`npm run dev` で UI/UX 不変を実機確認。

---

## 9. 検証観点（UI/UX 不変の担保）

- 表の見た目・列（ページ）順・行（生徒）順・空/無効表示・氏名表示が従来と同一。
- view の move/swap、upload の並べ替え、保存・適用の結果が従来と同一。
- **孤立答案が従来どおり全て可視化される**（除籍生徒の答案・ページ範囲外の答案が孤立枠に出る。黙って消える画像が無い＝§6 の orphan 導出要件）。
- **upload 方式A の並べ替えが trash を巻き込まない**（#964 の不変条件を維持）。
- 変わるのは内部のデータ同定（pageNumber 序数 → examPageId）だけで、画面には出ない。
