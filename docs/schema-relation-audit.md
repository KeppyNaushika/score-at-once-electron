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

4.1 と同じく「制約の代用コード」が書かれている状態。

ただし `@@unique` を足すだけでは済まない。`@default(uuid())` のままだと、2端末が同じ組み合わせを
作ったとき id 違い・unique 同値の行ができて NAS 同期で衝突する。この表は真の多対多なので
中間テーブル自体は残り、**unique を持つなら決定論的 id が要る**（手順は §6.2）。

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

---

## 6. 残作業

4.1 は #1124 / PR #1125 で対応済み。以降も 4.4 を除いて対応した。

| 項目                                               | 節  | 状態                  |
| -------------------------------------------------- | --- | --------------------- |
| Asb 系の同期除外リストが子テーブルに追随していない | 5.1 | ✅ 対応済み（§6.1）   |
| `ExamSubtotalGroup` に `@@unique` が無い           | 4.2 | ✅ 対応済み（§6.2）   |
| `GradeDataSource.examId` の型ごとの意味を明文化    | 4.3 | ✅ 対応済み（§6.3）   |
| 個人成績表の設定が 1:1 の2枚に割れている           | 4.4 | 見送り（理由は §6.3） |
| OMR ハンドラの実行時テストが無い                   | 6.4 | ✅ 対応済み（§6.4）   |

対応の過程で判明し、別 issue へ切り出したもの:

| issue | 内容                                                                      |
| ----- | ------------------------------------------------------------------------- |
| #1126 | 解答用紙定義を同期対象にしたが、保存方式（delete→recreate）と噛み合わない |
| #1127 | 解答用紙定義の所有と共有の設計（`userId` 絞り込みと `getCurrentUser`）    |
| #1128 | 複合uniqueを持つ中間テーブルの id を決定論的にする（14テーブル）          |

### 6.1 Asb 系の同期除外（5.1）✅ 対応済み

**調査結果**: 行はスキップされず**投入される**。ライブラリの接続は `journal_mode` しか
設定せず `foreign_keys` を触らない（SQLite 既定は OFF）。`applyInsert` が捕まえる例外も
`SQLITE_CONSTRAINT_UNIQUE` と `..._PRIMARYKEY` だけなので、参照先が無くても INSERT は通り、
dangling 行が溜まる。

さらに非対称がある。除外テーブルは changelog トリガー自体が作られない（トリガーは
`config.tables` にのみ設置）ので**作成は伝わらない**が、子テーブルは同期対象なので
**削除は伝わる**。端末Aで小問を消すと子の削除だけが端末Bへ届き、Bでは枠だけ残って
中身が消えた。

**採った方針**: 業務データはすべて共有する。除外に残すのは端末ごとの設定
（`UserKeyboardShortcut` / `UserPreference`）だけとし、Asb 系は親も子も同期対象にした。
`AsbHeaderField` に `createdAt` / `updatedAt` を追加している（migration
`20260802030000_asb_header_field_timestamps`）— この2列が無いとライブラリの自動検出から
外れるため。

**再発防止**: `__tests__/sync/syncTableConfig.test.ts` が schema.prisma を読んで
「同期されるテーブルが除外されたテーブルを参照していない」ことを検査する。原因そのものを
見ているので、次に子テーブルが増えても漏れれば落ちる。

なお画像ファイルの実体はローカル（`getDataDirectory()`）にあり NAS 共有は DB だけなので、
`AsbImageElement` の行は同期されてもファイルは相手端末に無い。これは `ExamPage.imagePath` や
`StudentAnswerImage` も同じ既存の性質で、画像共有自体は別課題（#1052）。

### 6.2 `ExamSubtotalGroup` の unique（4.2）✅ 対応済み

**unique の追加だけでは足りない。id の決定論化とセットで行う。**

`@@unique([examId, subtotalGroupId])` を足しただけだと、2人の教員が同じ試験に同じ小計点グループを
追加したとき、`@default(uuid())` のせいで **id 違い・unique 同値**の行が2つでき、NAS 同期で衝突する。
これは既知の罠で、`CropRegionAssignment` / `GradeConstraintViewpoint` /
`GradeConstraintLabelValue` / `GradeConstraintExclusionLabel` / `GradeDataSourceEstimationSource` は
id を親子キーから決定論的に組み立てることで回避している（同一 id なら行レベル LWW が1行へ収束する）。

§4.1 で `examPageId @unique` を避けたのと同じ制約がここにも効く。違いは、あちらは 1:1 なので
畳めば unique 自体が要らなくなったのに対し、こちらは真の多対多なので中間テーブルが残り、
**unique を持つなら決定論的 id が要る**という点。

migration `20260802040000_exam_subtotal_group_deterministic_id` で対応した。以下は実施内容。

1. **重複行の確認**（あれば移行で潰す）

   ```sql
   SELECT examId, subtotalGroupId, COUNT(*) FROM ExamSubtotalGroup
   GROUP BY examId, subtotalGroupId HAVING COUNT(*) > 1;
   ```

2. **`deterministicId.ts` に `buildExamSubtotalGroupId(examId, subtotalGroupId)` を足す。**
   既存の `joinIds` に倣って単純連結にすること。uuidv5 ではない理由が同ファイルの冒頭に書いてある —
   既存行の id を振り直すマイグレーションが同じ id を組み立てられる必要があり、SQLite に sha1 が
   無いので SQL 側で uuidv5 を再現できない
3. **マイグレーション**: 重複を潰し、既存行の id を決定論的 id へ振り直し、`@@unique` と `@@index`
   を追加する。他テーブルからの FK は無いので、DB 内で id を変えること自体は安全（確認してから進める）
4. **アーカイブの扱いを決める。** `ExamSubtotalGroup.id` は他テーブルからは参照されないが、
   **試験アーカイブが id を運んでいる**（`dataCollector.ts` が書き出し、`importExamCore.ts` が
   その id で作る）。旧アーカイブの id は uuid 形式なので、そのまま取り込むと決定論的 id の
   前提が崩れる。取り込み時に `buildExamSubtotalGroupId` で組み直すか、変換器で id を
   置き換えるかを決めること。**「同じ組み合わせの行が、ローカルには決定論的 id で、
   アーカイブには uuid で入っている」状態が unique 違反になる**ので、ここは飛ばせない
5. **スキーマに `@id` のみ**（`@default(uuid())` を外す）と、決定論的 id の理由をコメントで残す。
   他の決定論的 id テーブルと同じ書き方に揃える
6. **代用コードを外す** — `addSubtotalGroupToExam` は素の `create` から upsert へ
   （`electron-src/lib/prisma/subtotalGroup.ts`）、インポートの `findFirst`
   （`electron-src/lib/import/merge/importExamCore.ts`）は id 一致で足りるようになる

#### 何が直るか

重複行があると `selectedForTable` / `selectedForBoxPlot` が行ごとに食い違い、どちらが効くかが
読み取り順次第になる。Excel の小計点テーブルと箱ひげ図の対象が非決定的になる、という形で出る。

### 6.3 低優先の2件（4.3 ✅ / 4.4 見送り）

**4.3 は対応済み。** `GradeDataSource` に type ごとの参照列の表をコメントで置いた。
特に `examId` は `subtotal` 型では必須（`SubtotalGroup` は `Exam` と多対多なので、どの試験の
スコアを集計するかは `subtotalId` から辿れない）で、`crop_region` 型では冗長という違いがある。
消されないように、その理由まで書いている。

**4.4 は見送る。** `ExamIndividualReportSettings` と `ExamIndividualReportGraphSettings` を
1枚にまとめる案だが、次の理由で今は動かさない。

- この2枚は `20260731000200_normalize_exam_export_settings` で**意図して作られた**もので、
  出力設定のJSON埋め込みを6テーブルへ正規化した際の分割線である。作られて日が浅く、
  分割の意図が失われる前に潰すのは早い
- 得られるのはテーブル1枚の削減だけで、監査時の評価どおり実害が無い。対して費用は
  マイグレーション＋アーカイブ版上げ＋変換器＋`examSettings.ts` の書き換えと小さくない
- 同じ正規化で作られた他の4枚（1:N のもの）は形が違うので、統合するなら
  「1:1 の設定表をどう持つか」を6枚まとめて決める方がよい

個人成績表の設定を作り直す機会が来たら、そのとき6枚まとめて見直す。

### 6.4 OMR ハンドラのテスト空白 ✅ 対応済み

`__tests__/helpers/ipcHandlerHarness.ts` の `captureIpcHandler` を追加した。
`ipcMain.handle` のモックに記録された呼び出しからチャンネル名でコールバックを取り出し、
`_event` を補って呼ぶ。OMR に限らずどのハンドラにも使える。

これを使って `__tests__/omr/integration/detectMasterMarkers.test.ts` を置いた。型では守れない
「画像を持つページが1枚も無ければエラーを返す」分岐（ページはあるが画像が無い状態を
"検出0件で成功" にすると UI が沈黙する）と、「画像の無いページを飛ばしつつ持つページは
検出する」ことを見ている。ガードを外すと実際に落ちることを確認済み。

ハンドラに切り出せない判断だけをここで見る方針は変えない。main の関数に出せる処理は
そちらでテストする方が軽い。
