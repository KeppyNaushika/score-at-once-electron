# スキーマのリレーション監査（冗長な中間テーブル・分割の洗い出し）

## 1. 背景

`GradeBoundarySet` は属性を1つも持たない容器で、`@@unique([gradeId, gradeItemId])` によって実質 1:1 に
縮退していた。存在理由だった「総合（overall）」— 評価項目に属さない境界 — が
`20260725170000_drop_grade_overall_target` で撤去された時点で、中間テーブルである必要は消えていた。

残していた間、次の実害が出ていた。

- 境界を全行消してもセット行が生き残り、「境界は無いのに設定済み」という状態が作れた
- 進捗判定が `Grade._count.boundarySets` を見ていたため、上記の空セットで嘘をついた
- 容器を消すためだけの削除 API が必要だった
- `gradeId` は `gradeItem.gradeId` から辿れる冗長列で、id 以外の unique は sqlite-nas-sync の方針に反した

これは `GradeItemBoundary` へ畳んで解消した（#1122）。**本書は「同じことが他にも起きていないか」を
スキーマ全71モデルに対して調べた記録である。**

---

## 2. 判定基準

`GradeBoundarySet` の特徴は次の2条件の同時成立だった。

> **属性を持たない（id と外部キーとタイムスタンプしか無い）** ∧ **真の多対多ではない**

多対多であれば、属性ゼロの中間テーブルは正当である。「行があること」自体が情報だからで、
畳む先が存在しない。片側が unique で 1:1 や 1:N に縮退しているとき初めて、子が親を直接指せばよく、
中間テーブルは余分なホップになる。

`AsbTextElement` が `AsbSubQuestion` と `AsbBranchQuestion` の両方を参照する dual FK は、
この基準では**正当**である。小問にも枝問にもテキストを書けるという要件そのものであり、
代替は要素テーブルを2つに割ること（重複）しかない。`AsbImageElement` / `AsbOmrConfig` も同型で同じ判定。

---

## 3. 結論：`GradeBoundarySet` と同型のものは他に無い

属性を持たないテーブルは5つある。いずれも真の多対多で、行の存在そのものが情報である。

| テーブル             | 関係                     | 判定                                      |
| -------------------- | ------------------------ | ----------------------------------------- |
| `TagSubtotalGroup`   | Tag × SubtotalGroup      | 正当（M:N）                               |
| `ExamTag`            | Tag × Exam               | 正当（M:N）                               |
| `AsbDefinitionTag`   | Tag × AsbDefinition      | 正当（M:N）                               |
| `CourseworkTag`      | Tag × Coursework         | 正当（M:N）                               |
| `GradeItemExclusion` | GradeStudent × GradeItem | 正当（M:N。「除外されている」＝行がある） |

属性を持つ中間テーブル（`ExamStudent` / `UserExam` / `ExamClassroom` / `GradeClassroom` /
`GradeStudent` / `CropSubtotal` / `CompoundAnswerMember` / `StudentClassroomMembership` /
`GradeConstraintViewpoint` / `GradeDataSourceEstimationSource`）は、いずれも中間テーブルでしか
表現できない属性を持っており対象外。

**畳むべき中間テーブルは残っていない。** 以下は別種の冗長として見つかったものである。

---

## 4. 見つかった冗長

### 4.1 `ExamPage` ↔ `MasterImage` が実質 1:1 なのに 1:N ✅ 対応済み

**`MasterImage` を `ExamPage` へ畳んで解消した**（migration `20260801120000_fold_master_image_into_exam_page`、
アーカイブ v1.23.0）。以下は当時の記録。

`GradeBoundarySet` の裏返しである。あちらは容器が空だったが、こちらは**実体が2行に割れている** —
`ExamPage`（`schema.prisma:132-143`）は `examId` と `pageNumber` しか持たず、中身の `imagePath` /
`pageSize` は `MasterImage`（`schema.prisma:146-154`）側にある。

#### 実態

作成経路は3つあり、**すべてが新規作成した `ExamPage` に `MasterImage` を1枚だけ付ける**。

| 経路                 | 箇所                                                             |
| -------------------- | ---------------------------------------------------------------- |
| アップロード         | `electron-src/lib/prisma/masterAnswer.ts:72-88`                  |
| 解答用紙ビルダー     | `electron-src/lib/answer-sheet-builder/examConverter.ts:110-122` |
| アーカイブインポート | `electron-src/lib/import/merge/imageImporter.ts:105`             |

1枚より多い状態を作る経路も、それを利用する読み取りも存在しない。

#### 実害

1:1 だと**書けない**ため、各所が回避策を持っている。

- **読む側は7箇所すべてが `[0]`** — `pdfExport.ts:149`、`useScoringFilter.ts:554`、
  `ScoringMainView.tsx:605,622`、`useTemplateData.ts:108`、`03-region-info/page.tsx:79`、
  `useExportPage.ts:240`
- **インポートが手書きで重複を防いでいる** — `imageImporter.ts:93` の `findFirst`。unique 制約の代用
- **削除が「残り0枚なら」を数えている** — `masterAnswer.ts:139-146`。一度も2枚にならないのに

#### 対応（実施済み）

`examPageId @unique` を足すのが最短だが、id 以外の unique は sqlite-nas-sync の方針に反するため、
`ExamPage` が `imagePath` / `pageSize` を直接持つ形へ畳んだ。

争点は「模範解答の無いページ」を許すかだった。旧実装は模範解答だけを消して答案画像が残るページを
許していたが、そのページは 01-upload の一覧（模範解答の列挙）に現れないため教員からは見えず、
直すこともできない幽霊だった。OWNER 裁定で**その状態を作れなくする**方向を採り、次の3点を揃えた。

1. **削除はページごと消す**（答案画像・採点結果もカスケード削除）。答案が取り込まれている
   場合は件数を示す確認ダイアログを出す
2. **差し替えを新設**（`replaceMasterAnswerImage`）。UI に導線が無く、画像を刷り直すには
   削除して入れ直す＝答案を捨てる以外に手が無かった。画像だけを入れ替え、採点領域・答案・
   採点結果はページに紐づいたまま残る
3. **一覧は画像の無いページも隠さない。** 既存 DB の幽霊ページが可視化され、差し替えるか
   削除するかを教員が選べる

マイグレーションでは幽霊ページを消していない。消すと答案と採点結果が道連れになるためで、
アーカイブの変換器（v1.22.0 → v1.23.0）も同じ方針で引き継ぎ、件数を警告に出す。

#### `imagePath` を nullable にした理由（当初 NOT NULL にして事故った）

「アプリの操作では画像の無いページを作れない」ことを根拠に、当初は `imagePath` を NOT NULL とし、
移行してきた幽霊ページを**空文字**で表した。これは誤りだった。型が常に `string` を主張するため、
画像を読む側が欠落の分岐を書き忘れてもコンパイルが通る。実際、旧実装の `if (!masterImage)` を
機械的に `if (!examPage)` へ置き換えた結果、**その条件が二度と成立しなくなり**、
`path.join(dataDir, "")` がデータディレクトリを sharp へ渡して次が壊れた。

- 答案アップロードが1枚も保存されない（対象ページに幽霊が混ざるとバッチ全体が失敗）
- OMR マーカー検出が試験全体で停止（正常なページの結果ごと破棄）
- 用紙サイズが幽霊ページの既定値 A4 に引きずられ、mm 基準の注釈が誤った縮尺で描かれる

`String?` に変えたところ、これらの箇所がすべて型エラーとして表面化した。**「アプリが作れない状態」
でも DB に入りうるなら、番兵ではなく null で表す** — 型に守らせるためである。

用紙サイズの選び方は `shared/utilities/examPaperSize.ts` の `resolveExamPaperSize` に集約した。
mm 換算の基準がずれると同じ注釈が経路ごとに違う大きさで出るのに、選択ロジックが採点画面と
PDF 出力に複製されており、過去2回のずれに続く3回目をここで作ったため。

### 4.2 `ExamSubtotalGroup` にだけ `@@unique` も `@@index` も無い

`schema.prisma:272-282`。同型の中間テーブルはすべて `@@unique([親, 子])` を持つが、これだけ持たない。

- `addSubtotalGroupToExam` は素の `create`（`electron-src/lib/prisma/subtotalGroup.ts:354`）なので、
  同じ組で2回呼べば重複行ができる
- インポート側は `findFirst` で手動回避している（`electron-src/lib/import/merge/importExamCore.ts:201`）

4.1 と同じく「制約の代用コード」が書かれている状態。`@@unique([examId, subtotalGroupId])` の追加で済むが、
既存 DB に重複行があれば先に潰す必要がある。

### 4.3 `GradeDataSource.examId` は `crop_region` 型で冗長

`schema.prisma:937-975`。`cropRegionId` → `CropRegion.examPage.examId` で辿れる。

ただし `subtotal` 型では**必要**である。`SubtotalGroup` は `Exam` と多対多なので、
どの試験のスコアを合計するかは `subtotalId` からは辿れない。

つまり同じ列が型によって意味を持ったり持たなかったりする。`AddDataSourceInline.tsx:191-193` は
「coursework 以外なら examId を入れる」と一括で埋めており、型ごとの差を表現していない。

型ごとに列を分けるのは 5 種の polymorphic 参照を増やすだけなので、**畳むより型ごとの意味を
スキーマのコメントに書く方が実害に見合う**と判断する。優先度は低い。

### 4.4 個人成績表の設定が同じ `Exam` に対する 1:1 の2枚

`ExamIndividualReportSettings`（`schema.prisma:557`）と
`ExamIndividualReportGraphSettings`（`schema.prisma:635`）。

常に一緒に取得され、`individualReport` という単一オブジェクトへ合流する
（`electron-src/lib/prisma/examSettings.ts:66,68`）。分割線が機能ではなく実装都合になっている。
害は小さいので優先度は低い。

---

## 5. 冗長ではないが、調査中に見つかった不整合

### 5.1 Asb 系の同期除外リストが子テーブルに追随していない

`SYNC_EXCLUDE_TABLES`（`electron-src/lib/sync/syncTableConfig.ts:17-25`）が除外している Asb 系は
`AsbDefinition` / `AsbHeaderField` / `AsbMajorQuestion` / `AsbSubQuestion` / `AsbBranchQuestion` の5つ。

一方、同期対象は「`id` と `updatedAt` を持つテーブル」の自動検出である
（sqlite-nas-sync `src/types.ts:69`）。そのため次の6つは**同期される**。

`AsbTextElement` / `AsbImageElement` / `AsbOmrConfig` / `AsbOmrChoiceOption` / `AsbCharGuide` /
`AsbDefinitionTag`

親（`AsbSubQuestion` 等）は同期されないのに子だけ同期される形になっている。除外リストが書かれた後に
追加されたテーブル（`AsbCharGuide` は #913、`AsbDefinitionTag` はタグ対応）が追随していない、という
見え方をする。

**未検証**: 実行時に何が起きるか（ライブラリが FK 違反行をスキップするのか投入するのか）は
追っていない。対応前に確認すること。

### 5.2 `AsbHeaderField` だけ `updatedAt` を持たない

71モデル中これだけ（`schema.prisma:1343-1360`）。`updatedAt` は sqlite-nas-sync の LWW 解決に使う列で、
無いテーブルは自動検出の対象外になる。

ただし `AsbHeaderField` は 5.1 の除外リストにも入っているため、**実害は無い**（二重に除外されている）。
5.1 を直して Asb 系を同期対象にするなら、このとき初めて `updatedAt` の追加が必要になる。
