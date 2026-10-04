# アーカイブ（インポート／エクスポート）アーキテクチャ

**書き出しは統合アーカイブ（`.sao`）だけである。** 試験・資料・成績算出・解答用紙定義と、
共通の実体（生徒・学級・小計グループ・タグ）を、1つのファイルに選んだ範囲で入れる。
旧5種（`.score` / `.coursework` / `.grade` / `.asb` / `.students`）は**読み込みだけを残して
凍結した形式**で、書き出しのコードはもう無い。

本書は「どのファイルが何をするか」と「スキーマを変えたときにやること」を置く。
**範囲・照合・衝突の規則とその理由は [unified-archive-design.md](./unified-archive-design.md)
が正本**で、本書はそこへの道案内である。

## 目次

1. [統合アーカイブ（`.sao`）](#統合アーカイブsao)
2. [取り込みの3択](#取り込みの3択)
3. [読み込みの入口](#読み込みの入口)
4. [旧5種（読み込みだけの凍結した形式）](#旧5種読み込みだけの凍結した形式)
5. [スキーマを変えたときにやること](#スキーマを変えたときにやること)

---

## 統合アーカイブ（`.sao`）

### 中身

```
<名前>.sao  (ZIP)
├── manifest.json   形式の識別子と版・アプリの版・最後の migration・範囲・外したもの・行数
├── archive.db      現行スキーマと同じ SQLite（選んだ範囲の行だけ）。_prisma_migrations を含む
└── files/          データディレクトリからの相対パスのまま（模範解答・答案・解答用紙の画像）
```

**スキーマの版は `_prisma_migrations` そのもの**で、`*_CURRENT_VERSION` も変換器も持たない。
取り込みは、アプリ起動時と同じ migration を `archive.db` に当てて現行化してから読む。
アーカイブの型（`manifest.json` の形と定数）は `src/types/unifiedArchive.types.ts`。

### 書き出し（`electron-src/lib/export/unified-archive/`）

|                            |                                                                                          |
| -------------------------- | ---------------------------------------------------------------------------------------- |
| `archiveTableRegistry.ts`  | **表ごとの役割と外部キーの登録表**。範囲の規則はここから表どうしのつながりを取る         |
| `archiveScopeResolver.ts`  | 入れる行を決める（設計 §5）。既定は関連データを全て含め、利用者が外したものを外す        |
| `archiveDatabaseWriter.ts` | 元の DB を複製し、範囲外の行を消す。外部キーが閉じていなければ失敗させる                 |
| `archiveFileCollector.ts`  | `archive.db` の行が指すファイルを集める。ファイルのパスを持つ列は `ARCHIVE_FILE_COLUMNS` |
| `archiveExportPreview.ts`  | 書き出し画面の下見（範囲を決めるだけで DB は書かない）                                   |
| `unifiedArchiveCreator.ts` | 上を束ねて ZIP を作る                                                                    |

### 取り込み（`electron-src/lib/import/unified-archive/`）

|                                                               |                                                                                                     |
| ------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `archiveOpener.ts`                                            | 開く・守る・現行化（設計 §4.1）。外から来たファイルとして ZIP・manifest・DB を1つずつ確かめる       |
| `archiveManifestParser.ts`                                    | `manifest.json` を `unknown` から実行時に検証して型へ絞る                                           |
| `archiveImportSessions.ts`                                    | 開いたアーカイブを段（開く → 試し取り込み → 取り込む）をまたいで持つ                                |
| `archiveRowImporter.ts`                                       | **汎用の書き込み**。表を外部キーの親が先の順に1表ずつ「決めて、書く」。表ごとの手書きの処理は無い   |
| `archiveTableOrder.ts`                                        | 表を書く順（登録表の references から位相順）                                                        |
| `archiveTableResolver.ts`                                     | 1表分の行の行き先を決める（照合の決定・3択・一意制約の衝突の解決・付け替え）                        |
| `archiveUniqueIndexes.ts` / `archiveUniqueCollisions.ts`      | 一意制約での衝突を引く（取り込み先とは SQLite に比べさせる）                                        |
| `archiveIdRenamer.ts`                                         | 取り込み先の行の id を付け替え、子の外部キーも `UPDATE` で付け替える（削除して作り直さない）        |
| `archiveRowPlanning.ts`                                       | 1行を作る・置き換える・残すのどれにするかと、書く値。3択は `importValuePolicy.ts` をそのまま使う    |
| `archiveRowReader.ts`                                         | `archive.db` から行を読む。「別で追加」で振り直す id もここで決める                                 |
| `archiveEmbeddedIds.ts`                                       | 外部キーでない列に埋め込まれた id の書き換え（**名指しの一覧** `ARCHIVE_EMBEDDED_ID_COLUMNS`）      |
| `archiveMatchCandidates.ts`                                   | id で一致しなかった共通の実体に、学籍番号・名前などで候補を当てる（付加機能。`ARCHIVE_MATCH_KEYS`） |
| `archiveFileImporter.ts`                                      | `files/` をデータディレクトリへ写す（コミットの後。写すのは書いた行が指すファイルだけ）             |
| `archiveGradeInputChanges.ts` / `archiveGradeImpactSource.ts` | 試し取り込みで、成績算出が読む表へ書いた行の前後と、評価項目へ写す手がかりを返す（設計 §7.5）       |

### IPC と画面

IPC は `ipc-handlers/unifiedArchiveHandlers.ts`（`unifiedArchive:previewExport` /
`selectExportPath` / `export` / `open` / `analyze` / `import` / `close` ほか）。
`analyze` は**本番と同じ処理を実際に書いてからロールバックする試し取り込み**で、確認画面の
件数・衝突・成績算出への影響はこれが返す。

画面は `src/components/unified-archive/` の `export/UnifiedArchiveExportDialog.tsx`（書き出し）と
`import/UnifiedArchiveImportWizard.tsx`（取り込み）。表名・列名の日本語は
`archiveTableLabels.ts`（載っていない名前はそのまま出る）。

書き出しの入口は各画面の書き出しボタンで、どれも同じダイアログを、押した画面の実体を選んだ
状態で開く。

---

## 取り込みの3択

**人は取り込みの最初に1回だけ選ぶ。** 選んだ操作は取り込む全レコードの全ての値に、
例外なく同じように効く（項目ごとの選択も、実体ごとの特別扱いも作らない）。

| 選択        | 既存と一致した行                             | 新しく作る行                             |
| ----------- | -------------------------------------------- | ---------------------------------------- |
| `overwrite` | 無条件に置き換え。`updatedAt` = 取り込み時刻 | `createdAt`/`updatedAt` = 取り込み時刻   |
| `merge`     | LWW（新しい方が勝つ）。`updatedAt` はその値  | `createdAt`/`updatedAt` = アーカイブの値 |
| `separate`  | （id を振り直すので一致が起きない）          | `createdAt`/`updatedAt` = アーカイブの値 |

型は `src/types/importAction.types.ts`、**適用は
`import/merge/importValuePolicy.ts` の1箇所**に寄せてある。統合版と、旧形式の試験・資料・
生徒の取り込みがこれを共有する。一意制約の衝突での id の選び方は設計 §7.3。

---

## 読み込みの入口

**各一覧（試験・資料・成績算出・解答用紙定義・生徒表）のツールバーにある「読み込み」1つ**
から入る。ファイル選択は `.sao` と旧5種の拡張子を全て受け付け、拡張子（大文字小文字を区別
しない）で振り分ける。

| 選んだファイル | 開く画面                                     |
| -------------- | -------------------------------------------- |
| `.sao`         | 統合版の取り込みウィザード                   |
| `.score`       | 試験の取り込み（`ImportWizardModal`）        |
| `.coursework`  | 資料の取り込み（`CourseworkImportDialog`）   |
| `.grade`       | 成績の取り込み（`GradeImportDialog`）        |
| `.asb`         | 解答用紙定義の取り込み                       |
| `.students`    | 生徒の取り込み（`StudentImportWizardModal`） |

どの一覧から押しても全ての拡張子を受け付ける（試験一覧で `.grade` を選べば成績の取り込みが
開く）。旧形式の画面は、選んだファイルを最初から受け取って開く。

---

## 旧5種（読み込みだけの凍結した形式）

**書き出しは無く、取り込みだけが残っている。** 手元に残った旧形式のファイルを読めるように
するためのもので、形式そのものはもう変わらない。

| 種             | 拡張子        | 取り込み                                  | 変換器                     | IPC                             |
| -------------- | ------------- | ----------------------------------------- | -------------------------- | ------------------------------- |
| 試験           | `.score`      | `import/exam-archive/` ＋ `import/merge/` | `import/transformers/`     | `archiveHandlers.ts`            |
| 試験外成績資料 | `.coursework` | `import/coursework-archive/`              | `coursework-transformers/` | `courseworkHandlers.ts`         |
| 成績           | `.grade`      | `import/grade-archive/`                   | `grade-transformers/`      | `gradeHandlers.ts`              |
| 解答用紙       | `.asb`        | `import/asb-archive/`                     | `asb-transformers/`        | `answerSheetBuilderHandlers.ts` |
| 生徒           | `.students`   | `import/student-archive/`                 | `student-transformers/`    | `studentArchiveHandlers.ts`     |

### 凍結の意味

- **版を上げない。** `src/types/<種>Archive.types.ts` の `*_CURRENT_VERSION` は今の値で止まり、
  変換器も足さない。読めるのは、その版までのファイルである
- **スキーマが変わったら、取り込みが今のスキーマで動くことだけを保つ。** 旧形式の取り込みが
  書いている表を変えたら、投入の処理を直す（新しい列には取り込み側で既定値を入れる）。
  アーカイブの型と変換器は触らない
- **取り込みのテストは固定ファイルを読む。** 旧形式のファイルはもう作れないので、
  `__tests__/fixtures/legacy-archives/` に置いた固定ファイルを取り込んで確かめる。版をまたぐ
  変換は `__tests__/import-export/unit/*TransformerChain.test.ts`
- 取り込む JSON の実行時検証（#1077）は、この旧形式の読み込みだけが対象になる
  （統合版の `manifest.json` は `archiveManifestParser.ts` が既に検証している）

### 共通の骨格

```
archiveExtractor（ZIP を開き、版を判定し、変換チェーンを通す） → 照合 → 投入
```

- ZIP を開くのは `adm-zip`。中身は `manifest.json` ＋ JSON のセクション（＋試験と解答用紙は画像）
- 変換チェーンの基盤は `import/shared/transformChain.ts`（`detectVersionInRange` と
  `runTransformChain`）で、5種が共有する。1段の変換器は `V<FROM>_to_V<TO>.ts` で、入力の版から
  出力の版へ1段だけ上げる
- **`manifest.version` は信用しきらない。** 過去に固定値を書き続けて嘘をついていた版があるので、
  形状を見て下方へ補正する。版でセクション名が変わるとき、extractor は「読めた方だけ」を載せる
  （両方載せると、新しい版のアーカイブが旧版に見えてデータを捨てる）
- **既定値はチェーンの「あと」で埋める。** 試験は `archiveExtractor` の `withDefaultedSections`。
  チェーンの途中で埋めると、後続の変換器が「無い」と「既定値」を区別できなくなる
- テストのフィクスチャで、`manifest.version` に現行版を書いて中身は旧い形、という組み合わせを
  作らない。形状ベースの判定が効いて、検証したいはずの経路を通らなくなる

### 試験（`.score`）

```
manifest.json  exam.json  students.json  classes.json  users.json
subtotals.json  scores.json  tags.json  master-images/  answer-sheets/
```

照合と投入は `import/merge/` が持つ。

|                                       |                                                                                                                                     |
| ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `matcher.ts` ／ `matchers/`           | 事前照合（生徒: uuid → 学籍番号 → 氏名、学級: uuid → 名前 → `classroomCode`、小計グループ: uuid → 名前、利用者: uuid → `username`） |
| `idIntegrationImporter.ts`            | **Stage 1**。単一トランザクションで全部入れる（`executeIdIntegrationImport`）                                                       |
| `processors/`                         | 生徒・学級・小計点グループの id 統合（新規作成／既存紐づけ／ID 変更予約）                                                           |
| `idChangeExecutor.ts`                 | **Stage 2**。ID 変更（複製 → FK 更新 → 旧レコード削除）                                                                             |
| `importExamCore.ts` ほか `import*.ts` | 試験骨格・付随データ・小計・採点層・同期記録の投入                                                                                  |
| `imageImporter.ts`                    | 画像のコピーと行の作成                                                                                                              |
| `separateExamRewriter.ts`             | `separate` のとき、試験まわりの id を振り直す                                                                                       |
| `scoringConflictDetector.ts`          | 採点の食い違いの検出（`examStudentId` + `cropRegionId`）                                                                            |
| `decisionMergePolicy.ts`              | 確定層（ScoreDecision / CompoundAnswerScore）の解決を LWW に一本化                                                                  |

**Stage 2 の罠:** `idChangeExecutor` の生徒 ID 変更は**delete ＋ 再作成**である。`Student` に
カスケードの子を足したら、**必ずここへ `updateMany` を足すこと。** 足し忘れると旧形式の
取り込みで黙って消える（統合版の付け替えは `UPDATE` で、この罠は無い）。

外部形式（`import/external-formats/` の `hsz/`（tkinter 版の `.hsz` / `.dat`）と
`reattendant/`）は、`.score` の凍結した版の形へ変換してから、この取り込みへ流す。

### 試験外成績資料（`.coursework`）

テーブルごとの平坦なセクション（1.1.0 以降。それ以前は入れ子ツリー）。id を一次の照合に使い、
名前マッチングを付加として持ち、点数は LWW で解決する。版ごとの形は
`coursework-transformers/types.ts` と `legacyShape.ts`。生徒・学級の解決は
`coursework-archive/idRemapper.ts`（`allowCreate` で「作る／lookup のみ」が切り替わる）。

### 成績（`.grade`）

```
grade-exam.json     成績本体（評価項目・境界・観点間制約・上書き・確定値 ほか）
courseworks.json    内包する試験外成績資料（coursework-archive 形式。投入も委譲する）
```

- **外部参照が名前ベース。** 試験・小計点グループ・採点領域・比較先の成績算出は含まず、
  取り込み先に在るものを名前で lookup する（比較先の成績算出だけは uuid 一次 → 成績算出名＋
  項目名）。当たらなければ warning で伝える
- 生徒・学級は作る（`allowCreate: true`）
- **利用者を含まない。** `GradeFrozenScore.frozenByUserId` は、同じ id の利用者が取り込み先に
  居なければ null（操作者不明）になる
- 3択を持たず、取り込むたびに複製される

### 解答用紙（`.asb`）

`definition.json`（定義と全子テーブル）・`tags.json`・`images/`。**取り込みは常に新規作成**で、
`idRemapper.ts` が全ての id を振り直す。**原稿用紙と文字位置マーカーの id を振り直し忘れると、
マーカーを置いた解答用紙が一切複製できない**（主キー衝突）。

### 生徒（`.students`）

`students.json`・`classes.json`。変換器を持たない（初版のまま）。事前照合
（`performStudentPreMatching`）と投入（`executeStudentImport`）に分かれ、生徒ごとに
「統合する／別で追加する」を選ばせる。

---

## スキーマを変えたときにやること

**テーブル・フィールド・リレーションを足したり消したり改名したら、必ず次を確かめる。**
統合版はスキーマから回る汎用の書き込みなので、表ごとの書き出し・取り込みの処理を書き足す
ことは無い。手で追うのは、スキーマから読み取れない「意味」だけである。

1. **表と外部キーを登録表に載せる** — `export/unified-archive/archiveTableRegistry.ts` の
   `ARCHIVE_TABLES` に、表の役割（`root` / `shared` / `owned` / `link` / `optional`）と、親の列
   （`owner`）と、外部キー（`references`。必須か、成績算出が使うので外せないか）を足す・直す。
   **規約テスト `__tests__/import-export/unit/unifiedArchiveRegistry.test.ts` が schema.prisma との
   一致を縛る**（モデルの過不足・外部キーの列・参照先・必須か）
2. **ファイルのパスを持つ列を足したら** — `export/unified-archive/archiveFileCollector.ts` の
   `ARCHIVE_FILE_COLUMNS` に足す（同梱と取り込みでの写しがこれに従う）。パスに id を区切りとして
   入れる表は、一意制約を持たせず照合の対象にもしない（`unifiedArchiveImportConflict.test.ts` の
   規約テスト）
3. **外部キーでない列に id を埋め込んだら** — `import/unified-archive/archiveEmbeddedIds.ts` の
   `ARCHIVE_EMBEDDED_ID_COLUMNS` に名指しで足す（「別で追加」と id の付け替えで書き換わる）
4. **migration は設計 §8 の規約4つを守る** — 既存の行の id と時刻を変えない／他の行を参照するのは
   範囲の内側だけ／参照先が無いときは元の値を保つ／既存のデータから新しい行を作るのは一意制約を
   持つ表だけ。**回帰テスト `__tests__/migration/unifiedArchiveMigrationCommutes.test.ts` が、
   固定データ（`__tests__/fixtures/unifiedArchiveBaseline.sql`）より後の migration を全体と一部の
   DB の両方に当てて突き合わせる。** 固定データの作り直しは
   `UPDATE_UNIFIED_ARCHIVE_BASELINE=1` を付けてこのテストを走らせる（作り直すと、それまでの
   migration は検査の対象から外れる）
5. **旧5種の読み込み** — 変えた表を旧形式の取り込みが書いているなら、取り込みが今のスキーマで
   動くよう投入の処理を直す。**変換器は足さず、`*_CURRENT_VERSION` も上げない**（凍結）。
   `Student` にカスケードの子を足したら `idChangeExecutor` の罠（上記）も見る
6. **画面の見せ方（必要なら）** — 表名・列名の日本語は
   `src/components/unified-archive/archiveTableLabels.ts`。成績算出が読む表に、値に効かない列
   （名前・並び順など）を足したら、`src/components/unified-archive/import/archiveGradeInputDiff.ts`
   の `VALUE_NEUTRAL_COLUMNS` に足す（載っていない列は値に効くものとして扱われるので、足し忘れても
   警告が増えるだけで見落としはしない）
