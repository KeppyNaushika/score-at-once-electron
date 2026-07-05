# インポート/エクスポート機能 テスト説明書

## 概要

このドキュメントは、Score at Once のインポート/エクスポート機能に関するテストスイートの全体像を説明します。

- **テストファイル数**: 25
- **合計テスト数**: 268（パス） + 5（todo）= 273
- **テストフレームワーク**: Vitest
- **テスト用DB**: `data/test-database.db`（SQLite）
- **レンダラテスト環境**: jsdom + @testing-library/react

## ディレクトリ構成

```
__tests__/
├── helpers/                         # テスト用ヘルパー
│   ├── testExamBuilder.ts          # DBに試験データ一式を作成
│   ├── testImageHelper.ts             # テスト用PNG画像の生成・管理
│   ├── testArchiveHelper.ts           # ZIPアーカイブ操作（Electron非依存）
│   ├── testDataFactory.ts             # テスト用データ生成ファクトリ
│   └── testPrismaClient.ts            # テスト用Prisma接続
├── import-export/
│   ├── unit/                        # ユニットテスト（DB不要）
│   │   ├── manifestValidator.test.ts    # マニフェスト検証
│   │   ├── archiveCreatorUtils.test.ts  # ファイル名生成
│   │   ├── dataCollector.test.ts        # データ構造の生成
│   │   ├── exportMode.test.ts           # エクスポートモード別ファイル名
│   │   ├── idMappings.test.ts           # IDマッピング操作
│   │   └── scoringConflictResolver.test.ts # 採点競合の解決戦略
│   ├── integration/                 # 統合テスト（実DB使用）
│   │   ├── bulkExportExams.test.ts       # 一括エクスポート
│   │   ├── collectExamData.test.ts      # データ収集パイプライン
│   │   ├── collectExamDataExportMode.test.ts # エクスポートモード別データ収集
│   │   ├── archiveRoundTrip.test.ts     # アーカイブ作成→抽出の往復
│   │   ├── preMatching.test.ts          # 事前照合ロジック
│   │   ├── idIntegrationImporter.test.ts # ID統合インポート全体
│   │   ├── subtotalGroupProcessor.test.ts # 小計グループ処理
│   │   ├── studentProcessor.test.ts     # 生徒処理
│   │   ├── classroomProcessor.test.ts   # 学級処理
│   │   ├── idChangeExecutor.test.ts     # ID変更の実行
│   │   └── scoringConflictDetector.test.ts # 採点競合の検出
│   └── scenarios/                   # シナリオテスト
│       ├── exportImportRoundTrip.test.ts  # E2Eラウンドトリップ
│       ├── edgeCases.test.ts              # エッジケース
│       └── bugReproduction.test.ts        # 既知バグ (B1-B11) の再発防止
├── renderer/                        # レンダラ（React）テスト（jsdom環境）
│   ├── setup.ts                       # jsdom環境セットアップ
│   ├── helpers/
│   │   ├── mockElectronAPI.ts           # window.electronAPI モックファクトリ
│   │   ├── mockData.ts                  # テスト用データファクトリ
│   │   └── mockWizard.ts               # useImportWizard モックファクトリ
│   ├── hooks/
│   │   └── useImportWizard.test.ts      # フックテスト（47テスト）
│   └── components/
│       ├── ImportWizardModal.test.tsx    # モーダルテスト（8テスト）
│       └── steps/
│           ├── FileSelectStep.test.tsx    # ファイル選択ステップ（4テスト）
│           ├── FileOverviewStep.test.tsx   # ファイル概要ステップ（7テスト）
│           └── ExecuteStep.test.tsx        # 実行ステップ（6テスト）
└── globalSetup.ts                   # DB初期化（prisma db push）
```

---

## テスト用ヘルパー

### testExamBuilder.ts

DBに完全な試験データを一式作成するヘルパー。

| 関数                                  | 説明                                                                                                     |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `createFullTestExam(prisma, options)` | User, Exam, Pages, CropRegions, Students, Classroom, QuestionScores 等を一括作成し、全エンティティを返す |

オプションで `pageCount`, `studentCount`, `includeV140Data`, `includeScores` などを制御可能。

### testImageHelper.ts

| 関数                                                               | 説明                                           |
| ------------------------------------------------------------------ | ---------------------------------------------- |
| `createMinimalPngBuffer()`                                         | 68バイトの最小PNG画像バッファを生成            |
| `createMinimalPng(filePath)`                                       | 指定パスにPNGファイルを書き出し                |
| `createTestImageFiles(baseDir, examId, pageCount, studentNumbers)` | マスター画像・答案画像のディレクトリ構造を作成 |
| `cleanupTempDir(dir)`                                              | 一時ディレクトリを安全に削除                   |

### testArchiveHelper.ts

| 関数                                                                      | 説明                                           |
| ------------------------------------------------------------------------- | ---------------------------------------------- |
| `createTestArchive(collectedData, outputPath, examId, examName, options)` | CollectedDataからZIPアーカイブ（.score）を作成 |
| `verifyArchiveContents(archivePath)`                                      | アーカイブ内のJSON検証                         |
| `createMinimalCollectedData(overrides)`                                   | DB不要の最小CollectedDataを生成                |

---

## ユニットテスト（6ファイル、54テスト）

DB接続不要で、純粋なロジックを検証します。

### manifestValidator.test.ts（8テスト）

マニフェスト（manifest.json）のバリデーションロジックを検証。

| ID   | テスト名                                       | 検証内容                                                       |
| ---- | ---------------------------------------------- | -------------------------------------------------------------- |
| MV-1 | 有効なマニフェストが検証を通過する             | 正常なマニフェストが `success: true` を返す                    |
| MV-2 | 必須フィールド欠落で失敗する                   | version, exportedAt, examId, examName, counts の各欠落でエラー |
| MV-3 | 不正バージョン形式で失敗する                   | "abc", "1.0", "v1.0.0" 等の不正形式を拒否                      |
| MV-4 | 未来バージョンは非互換として拒否される         | version "99.0.0" が `success: false` となる                    |
| MV-5 | 最小サポートバージョン未満で失敗する           | version "0.9.0" が最小バージョン未満として拒否                 |
| MV-6 | 古い互換バージョンはrequiresUpgrade=trueとなる | version "1.0.0" はアップグレード必要フラグが付く               |
| MV-7 | 現在バージョンはrequiresUpgrade=falseとなる    | 現行バージョンではアップグレード不要                           |
| MV-8 | nullやオブジェクト以外のマニフェストで失敗する | null, undefined, 文字列, 数値, 不正counts                      |

### archiveCreatorUtils.test.ts（3テスト）

エクスポートファイル名の生成ロジックを検証。

| ID   | テスト名                             | 検証内容                                 |
| ---- | ------------------------------------ | ---------------------------------------- |
| AC-1 | ファイル名が正しい形式で生成される   | `{name}-yyyy-MM-dd-hh-mm-ss.score` 形式  |
| AC-2 | 特殊文字がアンダースコアに置換される | `<>:"/\|?*` が `_` に変換される          |
| AC-3 | 日本語の試験名がそのまま保持される   | "数学Ⅰ　期末考査　2025年度" が維持される |

### dataCollector.test.ts（16テスト）

テスト用データ構造（ArchiveStudentsData等）の生成と整合性を検証。

| テスト名                                                   | 検証内容                     |
| ---------------------------------------------------------- | ---------------------------- |
| 生徒データが正しい形式で生成される                         | ArchiveStudentsDataの構造    |
| 複数の生徒データを生成できる                               | 複数生徒の一括生成           |
| 空の配列を渡した場合、空の生徒リストを返す                 | 空入力の処理                 |
| IDを指定できる                                             | カスタムID指定               |
| 学級と所属データが正しい形式で生成される                   | ArchiveClassesDataの構造     |
| 試験データがデフォルト設定で生成される                     | ArchiveExamDataのデフォルト  |
| ページ数とリージョン数を指定できる                         | カスタム設定                 |
| cropRegionのexamPageIdが正しいページを参照する             | FK整合性                     |
| v1.4.0以前のフィールドは空配列で初期化される               | 後方互換                     |
| 採点データが正しい形式で生成される                         | ArchiveScoresDataの構造      |
| partialScoreがnullの場合もサポートする                     | null許容                     |
| 小計グループと小計が正しくリンクされる                     | 小計データの関連             |
| デフォルト値で完全なアーカイブデータが生成される           | ExtractedArchiveDataの既定値 |
| 個別のデータをオーバーライドできる                         | カスタマイズ                 |
| エクスポートデータのpartialScoreはstring\|nullで表現される | Decimal型のシリアライズ      |
| 日時フィールドはISO8601形式である                          | 日時の形式確認               |

### idMappings.test.ts（9テスト）

IDマッピングデータ構造の操作を検証。

| テスト名                                       | 検証内容               |
| ---------------------------------------------- | ---------------------- |
| 全カテゴリの空マッピングを生成する             | 初期化の正常性         |
| マッピングにエントリを追加できる               | エントリ追加           |
| 複数のカテゴリに独立してマッピングを追加できる | カテゴリ間の独立性     |
| 同じimportIdに対して上書きできる               | 上書き動作             |
| 既存IDからインポートIDを検索できる             | 逆引き検索             |
| 複数のマッピングで正しく逆引きできる           | 複数マッピングの逆引き |
| 全カウンタがゼロで初期化される                 | カウンタ初期値         |
| 4つのカテゴリ全てが空カウントで初期化される    | ImportCountsの初期化   |
| カウントをインクリメントできる                 | カウント増加操作       |

### scoringConflictResolver.test.ts（12テスト）

採点データが競合した際の解決戦略を検証。

| ID     | テスト名                                      | 検証内容                     |
| ------ | --------------------------------------------- | ---------------------------- |
| SCR-1  | import_wins: 常にインポートデータを採用       | import_wins戦略の基本動作    |
| SCR-2  | import_wins: 既存が新しくてもインポート採用   | タイムスタンプ無視           |
| SCR-3  | existing_wins: 常に既存データを維持           | existing_wins戦略の基本動作  |
| SCR-4  | existing_wins: インポートが新しくても既存維持 | タイムスタンプ無視           |
| SCR-5  | newer_wins: インポート新しい→採用             | 新しい方を採用               |
| SCR-6  | newer_wins: 既存が新しい→維持                 | 新しい方を維持               |
| SCR-7  | newer_wins: 同じ日時→既存維持                 | 同一タイムスタンプは既存優先 |
| SCR-8  | manual: 手動設定import                        | 手動で "import" を選択       |
| SCR-9  | manual: 手動設定existing                      | 手動で "existing" を選択     |
| SCR-10 | manual: 手動設定なし→newer_wins動作           | 未設定時のフォールバック     |
| SCR-11 | config未定義→newer_wins動作                   | config省略時の既定動作       |
| SCR-12 | config未定義+既存新→existing                  | config省略で既存が新しい場合 |

### exportMode.test.ts（6テスト）

エクスポートモード別のファイル名生成ロジックを検証。

| ID   | テスト名                                                             | 検証内容                              |
| ---- | -------------------------------------------------------------------- | ------------------------------------- |
| EM-1 | fullモードではサフィックスが付かない                                 | fullモードの基本動作                  |
| EM-2 | exportMode未指定ではサフィックスが付かない                           | デフォルト動作（fullと同等）          |
| EM-3 | templateモードで-templateサフィックスが付く                          | templateモードのサフィックス          |
| EM-4 | template_with_subtotalsモードで-template-subtotalsサフィックスが付く | template_with_subtotalsのサフィックス |
| EM-5 | 特殊文字のサニタイズとモードサフィックスが両立する                   | サニタイズとの共存                    |
| EM-6 | 拡張子は全モードで.score                                             | 拡張子の統一性                        |

---

## 統合テスト（11ファイル、119テスト）

実際のSQLiteデータベースを使用して、モジュール間の連携を検証します。

### bulkExportExams.test.ts（7テスト）

複数試験の一括エクスポート `executeBulkExport` を検証。

| ID   | テスト名                                                   | 検証内容               |
| ---- | ---------------------------------------------------------- | ---------------------- |
| BE-1 | 複数試験を順次エクスポートし全て成功する                   | 基本的な一括処理       |
| BE-2 | 存在しない試験IDは失敗し残りは続行する                     | 部分的失敗時の継続動作 |
| BE-3 | 全試験が失敗した場合はsuccess=falseになる                  | 全失敗時の動作         |
| BE-4 | 単一試験でも正常に動作する                                 | 単一入力の処理         |
| BE-5 | 空の試験配列ではsuccess=falseで結果も空                    | 空入力の処理           |
| BE-6 | 出力パスが指定ディレクトリ内の正しいファイル名で構成される | ファイルパスの正確性   |
| BE-7 | 生成された.scoreファイルが有効なZIPアーカイブである        | 出力ファイルの妥当性   |

### collectExamDataExportMode.test.ts（18テスト）

エクスポートモード別（full/template/template_with_subtotals）のデータ収集を検証。

| ID    | テスト名                                                        | 検証内容                                  |
| ----- | --------------------------------------------------------------- | ----------------------------------------- |
| EM-F1 | デフォルト（引数なし）はfullモードと同じ結果を返す              | デフォルト動作                            |
| EM-F2 | fullモードは全データを含む                                      | fullモードの完全性                        |
| EM-T1 | templateモード: 生徒データが空になる                            | 生徒除外                                  |
| EM-T2 | templateモード: 学級データが空になる                            | 学級除外                                  |
| EM-T3 | templateモード: 採点データが空になる                            | 採点除外                                  |
| EM-T4 | templateモード: 答案画像が空になる                              | 答案画像除外                              |
| EM-T5 | templateモード: 小計データが空になる                            | 小計除外                                  |
| EM-T6 | templateモード: Subject/SubjectSubtotalGroupが空になる          | 教科データ除外                            |
| EM-T7 | templateモード: 試験基本データ・ページ・領域・模範解答は保持    | テンプレート要素の保持                    |
| EM-T8 | templateモード: マーク設定（v1.4.0+）は保持される               | v1.4.0設定の保持                          |
| EM-T9 | templateモード: ユーザーデータは保持される                      | ユーザーの保持                            |
| EM-S1 | template_with_subtotals: 生徒・学級・採点・答案が空になる       | templateと同じ除外                        |
| EM-S2 | template_with_subtotals: 小計データが含まれる                   | 小計の保持（templateとの差分）            |
| EM-S3 | template_with_subtotals: Subject/SubjectSubtotalGroupが含まれる | 教科データの保持                          |
| EM-S4 | template_with_subtotals: 基本データ・ページ・領域は保持         | テンプレート要素の保持                    |
| EM-S5 | template_with_subtotals: CropSubtotalが含まれる                 | CropSubtotalの保持                        |
| EM-C1 | templateモードのcountsが実データ長と一致する                    | countsの整合性（template）                |
| EM-C2 | template_with_subtotalsモードのcountsが実データ長と一致する     | countsの整合性（template_with_subtotals） |

### collectExamData.test.ts（12テスト）

DBから試験データを収集する `collectExamData` 関数を検証。

| ID    | テスト名                                       | 検証内容                   |
| ----- | ---------------------------------------------- | -------------------------- |
| DC-1  | 全エンティティ型を含む試験のデータが収集される | 全データ種別の収集確認     |
| DC-2  | 現在ユーザーの採点データのみ収集される         | ユーザー別フィルタリング   |
| DC-3  | 現在ユーザーのアノテーションのみ収集される     | アノテーションのフィルタ   |
| DC-4  | 存在しない試験IDでエラーが返る                 | 異常系：存在しない試験     |
| DC-5  | 存在しないユーザーIDでエラーが返る             | 異常系：存在しないユーザー |
| DC-6  | countsが実データの件数と一致する               | カウント値の正確性         |
| DC-7  | 日時がISO8601文字列でシリアライズされる        | シリアライズ形式           |
| DC-8  | partialScoreが文字列でシリアライズされる       | Decimal→string変換         |
| DC-9  | v1.4.0データが収集される                       | ExamMarkingFormat等の収集  |
| DC-10 | Subject/SubjectSubtotalGroupデータが収集される | 教科データの収集           |
| DC-11 | 画像パスが相対パスで取得される                 | パス形式の確認             |
| DC-12 | Classroomがメンバーシップ経由で収集される      | 学級の間接収集             |

### archiveRoundTrip.test.ts（11テスト）

アーカイブの作成と抽出の往復を検証。

| ID    | テスト名                                        | 検証内容                      |
| ----- | ----------------------------------------------- | ----------------------------- |
| RT-1  | 作成→抽出でJSONデータが一致する                 | ラウンドトリップの整合性      |
| RT-2  | マニフェスト構造が正しい                        | manifest.jsonの必須フィールド |
| RT-3  | マスター画像が含まれ抽出できる                  | 画像ファイルの往復            |
| RT-4  | 答案画像が含まれ抽出できる                      | 答案画像の往復                |
| RT-5  | 画像なしアーカイブが正常に処理される            | 画像省略時の動作              |
| RT-6  | 画像ディレクトリ未作成でも成功する              | ディレクトリ不在時            |
| RT-7  | 存在しないアーカイブパスでエラーが返る          | 異常系：ファイル不在          |
| RT-8  | 破損ZIPファイルでエラーが返る                   | 異常系：不正なZIP             |
| RT-9  | manifest.jsonのないZIPでエラーが返る            | 異常系：マニフェスト欠落      |
| RT-10 | readManifestOnlyでマニフェストだけ取得できる    | 部分読み取り                  |
| RT-11 | subjects.json未存在で空配列になる（v1.3.0互換） | 旧バージョン互換              |

### preMatching.test.ts（9テスト）

インポート前の事前照合（生徒・学級・小計グループ・試験の一致判定）を検証。

| ID   | テスト名                                    | 検証内容             |
| ---- | ------------------------------------------- | -------------------- |
| PM-1 | 生徒がIDで一致する（byId）                  | 同一IDでの自動マッチ |
| PM-2 | 生徒が学籍番号で一致する（byStudentNumber） | 学籍番号での照合     |
| PM-3 | 生徒が氏名で一致する（byName）              | 氏名での照合         |
| PM-4 | 一致なしの生徒がnoMatchに分類される         | 照合失敗時の分類     |
| PM-5 | 学級がID/名前で一致する                     | 学級の照合ロジック   |
| PM-6 | 小計グループがID/名前で一致する             | 小計グループの照合   |
| PM-7 | 試験IDが一致する場合                        | isIdMatch=true       |
| PM-8 | 試験IDが不一致の場合                        | isIdMatch=false      |
| PM-9 | 混在シナリオ（byId + byName + noMatch）     | 複合照合結果         |

### idIntegrationImporter.test.ts（18テスト）

インポートパイプライン全体（ID統合→エンティティ作成→スコア処理→競合解決）を検証。

| ID    | テスト名                                             | 検証内容                 |
| ----- | ---------------------------------------------------- | ------------------------ |
| II-1  | 新規インポート: 全エンティティが作成される           | 初回インポートの基本動作 |
| II-2  | 新規インポート: エンティティ作成の確認               | DB上のレコード存在確認   |
| II-3  | 新規インポート: カウントが正確である                 | ImportCountsの精度       |
| II-4  | 同一試験再インポートでスコアがunchangedとなる        | 再インポートの冪等性     |
| II-5  | newer_wins戦略: 新しいインポートが採用される         | 採点競合のnewer_wins     |
| II-6  | import_wins戦略: インポートが優先される              | 採点競合のimport_wins    |
| II-7  | existing_wins戦略: 既存が維持される                  | 採点競合のexisting_wins  |
| II-8  | 別PC: by_student_number照合                          | 異なるPC間の学籍番号照合 |
| II-9  | 別PC: by_name照合                                    | 異なるPC間の氏名照合     |
| II-10 | 別PC: create_new決定                                 | 新規生徒としてインポート |
| II-12 | v1.4.0: ExamMarkingFormatが作成される                | 新規データ型の処理       |
| II-13 | v1.4.0: ExamExportSettingsが作成される               | 新規データ型の処理       |
| II-14 | v1.4.0: CropRegionMarkingOverrideが作成される        | 新規データ型の処理       |
| II-15 | v1.4.0: Subject/SubjectSubtotalGroupが作成される     | 教科データの処理         |
| II-16 | B11修正: QuestionScoreの重複が回避される             | 既知バグの再発防止       |
| II-17 | メンバーシップの冪等性                               | 重複作成されない確認     |
| II-18 | ExamClassesが正しくマッピングされる                  | 学級-試験関連            |
| II-19 | トランザクションエラー時に全変更がロールバックされる | エラー時の安全性         |

### subtotalGroupProcessor.test.ts（4テスト）

小計グループのID統合処理を検証。

| ID   | テスト名                         | 検証内容           |
| ---- | -------------------------------- | ------------------ |
| SG-1 | ID一致→既存マッピング            | 同一IDで自動マッチ |
| SG-2 | 名前一致→既存マッピング          | 名前でマッチ       |
| SG-3 | 不一致+create_new→新規作成       | DBに新レコード作成 |
| SG-4 | use_import_id→idChangeTarget追加 | ID変更対象に登録   |

### studentProcessor.test.ts（11テスト）

生徒レコードのID統合処理を検証。

| テスト名                                                         | 検証内容                           |
| ---------------------------------------------------------------- | ---------------------------------- |
| 同一IDの生徒が存在する場合、自動でマッピングされる               | byId照合                           |
| 学籍番号が一致する場合、same_personとして自動マッピングされる    | by_student_number照合              |
| 氏名が一致する場合、same_personとして自動マッピングされる        | by_name照合                        |
| 一致するレコードがない場合、新規生徒がDBに作成される             | create_new処理                     |
| 既存IDを使用してマッピングされ、ID変更ターゲットには追加されない | use_existing_id決定                |
| 既存IDにマッピングされつつ、idChangeTargetsにも追加される        | use_import_id決定                  |
| スキップカウントが増加し、マッピングは作成されない               | skip決定                           |
| 学籍番号にサフィックスを付与して新規作成する                     | B5バグ修正確認                     |
| use_importが指定されたフィールドがインポートデータで更新される   | フィールド更新（use_import）       |
| インポートデータの方が新しい場合にフィールドが更新される         | フィールド更新（use_newer/新しい） |
| インポートデータの方が古い場合はフィールドが更新されない         | フィールド更新（use_newer/古い）   |

### classroomProcessor.test.ts（9テスト）

学級レコードのID統合処理を検証。

| テスト名                                                       | 検証内容                     |
| -------------------------------------------------------------- | ---------------------------- |
| 同一IDの学級が存在する場合、自動でマッピングされる             | byId照合                     |
| 名前が一致する場合、same_personとして自動マッピングされる      | by_name照合                  |
| 一致するレコードがない場合、新規学級がDBに作成される           | create_new処理               |
| 既存IDを使用してマッピングされる                               | use_existing_id決定          |
| 既存IDにマッピングされつつ、idChangeTargetsにも追加される      | use_import_id決定            |
| スキップカウントが増加し、マッピングは作成されない             | skip決定                     |
| クラス名にサフィックスを付与して新規作成する                   | B5類似バグ修正確認           |
| use_importが指定されたフィールドがインポートデータで更新される | フィールド更新（use_import） |
| インポートデータの方が新しい場合にフィールドが更新される       | フィールド更新（use_newer）  |

### idChangeExecutor.test.ts（9テスト）

Stage 2のID変更処理（レコード再作成 + FK更新 + 旧レコード削除）を検証。

| テスト名                                                           | 検証内容                     |
| ------------------------------------------------------------------ | ---------------------------- |
| 新しいIDでレコードを作成し、FK参照を更新し、古いレコードを削除する | 小計グループの基本ID変更     |
| ID変更後にidMappingsの全エントリが更新される                       | マッピング更新の確認         |
| 複数のFK参照が全て更新される                                       | ExamSubtotalGroup + Subtotal |
| temp-value方式により生徒のIDが変更される                           | UNIQUE制約回避（生徒）       |
| temp-value方式により学級のIDが変更される                           | UNIQUE制約回避（学級）       |
| 変更対象の生徒が存在しない場合、スキップされる                     | 異常系：生徒不在             |
| 変更対象の学級が存在しない場合、スキップされる                     | 異常系：学級不在             |
| 変更対象の小計グループが存在しない場合、スキップされる             | 異常系：グループ不在         |
| 全カテゴリのID変更が正常に処理される                               | 一括処理の動作確認           |

### scoringConflictDetector.test.ts（11テスト）

インポート時の採点データ競合を検出するロジックを検証。

| テスト名                                                                | 検証内容                 |
| ----------------------------------------------------------------------- | ------------------------ |
| 既存のスコアがない場合、全てnewCountとして扱う                          | 競合なし（新規のみ）     |
| 同じ生徒×CropRegionで異なるstatusのスコアがある場合、競合として検出する | status不一致の検出       |
| partialScoreのみ異なる場合も競合として検出する                          | 部分点の差異検出         |
| statusとpartialScoreが同一の場合、unchangedとしてカウントする           | 同一スコアの判定         |
| cropRegionIdMappingが空の場合、全て新規として扱う                       | マッピング空時の動作     |
| studentIdMappingにないスコアは新規として扱う                            | マッピング不在時         |
| 新規・同一・競合が混在する場合、それぞれ正しくカウントされる            | 混合パターン             |
| 試験IDが一致しない場合、全て新規として扱い競合なし                      | 試験不一致               |
| ID一致の生徒と既存CropRegionで異なるスコアがある場合、競合を検出する    | 完全パイプラインでの検出 |
| 学籍番号一致の生徒もマッピングに含めて競合検出する                      | by_student_number戦略    |
| create_new決定の生徒はマッピングから除外され、新規として扱われる        | 決定による除外           |

---

## シナリオテスト（3ファイル、13テスト + 5 todo）

実際の使用パターンを模擬した包括的テスト。

### exportImportRoundTrip.test.ts（5テスト）

エクスポート→アーカイブ作成→DB初期化→インポートのE2Eパイプラインを検証。

| ID    | テスト名                                                    | 検証内容               |
| ----- | ----------------------------------------------------------- | ---------------------- |
| E2E-1 | フルパイプライン: エクスポート→インポートでデータが一致する | 基本的な往復テスト     |
| E2E-2 | 既存試験へのマージインポート                                | 既存データとの統合     |
| E2E-3 | 異なるユーザーからのインポート                              | 別ユーザーのデータ取込 |
| E2E-4 | エクスポート時の画像パス確認                                | 画像データの整合性     |
| E2E-5 | v1.4.0データのラウンドトリップ                              | 新規データ型の往復     |

### edgeCases.test.ts（8テスト）

境界条件や特殊な状況を検証。

| ID   | テスト名                                                    | 検証内容           |
| ---- | ----------------------------------------------------------- | ------------------ |
| EC-1 | 空試験（生徒・スコアなし）がインポートできる                | 最小データの処理   |
| EC-2 | 110人以上の生徒が正しくインポートされる                     | 大量データの処理   |
| EC-3 | partialScoreがnullのスコアが正しくインポートされる          | null許容の確認     |
| EC-4 | DrawingAnnotationがインポートされる                         | 描画アノテーション |
| EC-5 | CropSubtotalsがリンクされる                                 | 小計リンクの再構築 |
| EC-6 | 2回連続インポートが冪等である                               | 冪等性の保証       |
| EC-7 | 旧バージョン（1.0.0）アーカイブが変換されてインポートできる | バージョン互換     |
| EC-8 | 手動競合解決（manual戦略）が正しく動作する                  | 手動解決フロー     |

### bugReproduction.test.ts（15テスト、うち5件はtodo）

既知のバグ（B1〜B11）が修正済みであることを継続的に検証。

| バグID | テスト名                                                          | 状態 |
| ------ | ----------------------------------------------------------------- | ---- |
| B1     | Stage 1とStage 2が統合され、一つのトランザクションで実行される    | todo |
| B2     | 画像レコード作成がトランザクション内に移動された                  | todo |
| B3     | ExamMarkingFormatがインポートで処理されることを確認               | パス |
| B3     | ExamExportSettingsがインポートで処理されることを確認              | パス |
| B3     | CropRegionMarkingOverrideがインポートで処理されることを確認       | パス |
| B3     | Subject/SubjectSubtotalGroupがインポートで処理されることを確認    | パス |
| B3     | ExamClassroomがインポートで処理されることを確認                   | パス |
| B4     | ID変更時のUNIQUE制約がtemp-value方式で回避される                  | todo |
| B5     | create_new決定では学籍番号にサフィックスを付与して新規作成する    | パス |
| B6     | 既存ページはcounts.unchanged.pages++でカウントされる              | パス |
| B7     | processExamでexistingById検出時に警告が追加される                 | todo |
| B8     | idMappings.examで正しいIDを取得                                   | パス |
| B9     | by_name戦略でbyStudentNumberのマッチも含まれる                    | パス |
| B10    | lastIndexOfで正しい画像パスを取得する                             | パス |
| B11    | QuestionScoreの重複チェック（cropRegionId+studentId）が追加された | todo |

> **todo** のテストは、テストの実装が複雑なため今後の実装予定としてマークされています。該当する修正自体は本体コードで適用済みです。

---

## レンダラテスト（5ファイル、72テスト）

レンダラ側（React）のインポートウィザード機能を検証します。jsdom環境で `@testing-library/react` を使用。

### テスト環境

- **環境切り替え**: 各テストファイルの先頭に `// @vitest-environment jsdom` を記述
- **セットアップ** (`__tests__/renderer/setup.ts`):
  - `@testing-library/jest-dom` のマッチャー拡張
  - `ResizeObserver`, `matchMedia` のグローバルモック（Radix UI用）
  - `next/navigation`, `sonner`（toast）のモジュールモック

### テスト用ヘルパー（レンダラ）

#### mockElectronAPI.ts

`window.electronAPI` のモックファクトリ。テスト内で `window.electronAPI.archive.*` の7メソッドをモック化。

| 関数                       | 説明                                                                        |
| -------------------------- | --------------------------------------------------------------------------- |
| `createMockElectronAPI()`  | `window.electronAPI` をモック化し `{ mockArchive, mockElectronAPI }` を返す |
| `cleanupMockElectronAPI()` | `window.electronAPI` を削除してクリーンアップ                               |

#### mockData.ts

型安全なテスト用データファクトリ。

| 関数                                     | 説明                                                                                 |
| ---------------------------------------- | ------------------------------------------------------------------------------------ |
| `createMockManifest(overrides?)`         | `ArchiveManifest` のモック                                                           |
| `createMockCounts(overrides?)`           | `ArchiveDataCounts` のモック                                                         |
| `createMockFileOverviewData(overrides?)` | `FileOverviewData` のモック                                                          |
| `createMockPreMatchingResult(opts?)`     | `PreMatchingResult` のモック（byId, byStudentNumber, byName, noMatchの件数指定可能） |
| `createMockMatchedItem(overrides?)`      | `MatchedItem` のモック                                                               |
| `createMockImportItem(overrides?)`       | `ImportItem` のモック                                                                |
| `createMockScoringConflictData(opts?)`   | `ScoringConflictData` のモック                                                       |
| `createMockScoringConflict(overrides?)`  | `ScoringConflict` のモック                                                           |
| `createMockImportSummary()`              | インポート結果サマリーのモック                                                       |

#### mockWizard.ts

`useImportWizard` の戻り値をモック化するファクトリ。コンポーネントテストで `wizard` prop を差し替えるために使用。

| 関数                                | 説明                                                             |
| ----------------------------------- | ---------------------------------------------------------------- |
| `createMockWizard(stateOverrides?)` | `UseImportWizardReturn` のモックを生成。`state` を部分上書き可能 |

### useImportWizard.test.ts（47テスト）

`useImportWizard` フックの全状態管理ロジックを `renderHook` + `act` で検証。

#### 初期状態（4テスト）

| ID   | テスト名                                        | 検証内容                |
| ---- | ----------------------------------------------- | ----------------------- |
| IW-1 | 初期状態が正しく設定される                      | `initialState` との一致 |
| IW-2 | currentStepがfile_selectで初期化される          | 初期ステップの確認      |
| IW-3 | isProcessingがfalseで初期化される               | 処理フラグの初期値      |
| IW-4 | idIntegrationConfigがデフォルト値で初期化される | ID統合設定の初期値      |

#### selectFile - ファイル選択（11テスト）

| ID    | テスト名                                                 | 検証内容           |
| ----- | -------------------------------------------------------- | ------------------ |
| IW-10 | ファイル選択成功時にcurrentStepがfile_overviewに遷移する | ステップ遷移       |
| IW-11 | ファイル選択成功時にarchivePathが設定される              | パス保存           |
| IW-12 | ファイル選択成功時にmanifestが設定される                 | マニフェスト保存   |
| IW-13 | ファイル選択成功時にfileOverviewDataが設定される         | 事前照合データ保存 |
| IW-14 | ファイル選択中にisProcessingがtrueになる                 | 処理中フラグ       |
| IW-15 | selectImportFile失敗時にerrorが設定される                | エラー設定         |
| IW-16 | ファイル選択キャンセル時にステップが変わらない           | キャンセル処理     |
| IW-17 | analyzeArchive失敗時にerrorが設定される                  | 解析エラー         |
| IW-18 | preMatch失敗時でもfile_overviewに遷移する                | 部分成功           |
| IW-19 | 例外発生時にerrorが設定される                            | 例外処理           |
| IW-20 | selectFile完了後にisProcessingがfalseに戻る              | フラグリセット     |

#### performPreMatching - 事前照合（4テスト）

| ID    | テスト名                                     | 検証内容         |
| ----- | -------------------------------------------- | ---------------- |
| IW-25 | archivePathが未設定の場合にfalseを返す       | 前提条件チェック |
| IW-26 | 事前照合成功時にfileOverviewDataが更新される | データ更新       |
| IW-27 | 事前照合失敗時にerrorが設定される            | エラー設定       |
| IW-28 | 事前照合中にisProcessingがtrueになる         | 処理中フラグ     |

#### ID統合設定更新（7テスト）

| ID    | テスト名                                | 検証内容               |
| ----- | --------------------------------------- | ---------------------- |
| IW-30 | student設定のstrategyを更新できる       | 生徒戦略の変更         |
| IW-31 | class設定のstrategyを更新できる         | 学級戦略の変更         |
| IW-32 | subtotalGroup設定のstrategyを更新できる | 小計グループ戦略の変更 |
| IW-33 | 他のカテゴリの設定が保持される          | 部分更新の独立性       |
| IW-35 | 新しい個別決定を追加できる              | 個別決定の追加         |
| IW-36 | 既存の個別決定を上書きできる            | 個別決定の上書き       |
| IW-40 | 複数アイテムの決定を一括設定できる      | 一括設定               |

#### ステップ遷移（6テスト）

| ID    | テスト名                                      | 検証内容         |
| ----- | --------------------------------------------- | ---------------- |
| IW-45 | file_overviewからid_integrationに遷移する     | 前方遷移         |
| IW-46 | id_integrationからupdate_confirmに遷移する    | 採点競合検出経由 |
| IW-47 | update_confirmからfinal_confirmに遷移する     | 前方遷移         |
| IW-48 | final_confirmからexecuteに遷移する            | 前方遷移         |
| IW-50 | goBackでid_integrationからfile_overviewに戻る | 後方遷移         |
| IW-51 | goBackでfile_selectからは戻れない             | 先頭の境界       |

#### 採点競合設定（4テスト）

| ID    | テスト名                              | 検証内容 |
| ----- | ------------------------------------- | -------- |
| IW-60 | 採点競合方針をnewer_winsに設定できる  | 方針変更 |
| IW-61 | 採点競合方針をimport_winsに設定できる | 方針変更 |
| IW-65 | 個別の採点競合解決を設定できる        | 個別解決 |
| IW-66 | 複数の採点競合解決を一括設定できる    | 一括解決 |

#### フィールド更新決定（2テスト）

| ID    | テスト名                             | 検証内容       |
| ----- | ------------------------------------ | -------------- |
| IW-70 | フィールド単位の更新決定を設定できる | 個別フィールド |
| IW-71 | 一括更新戦略を設定できる             | 一括設定       |

#### executeImport - インポート実行（7テスト）

| ID    | テスト名                                     | 検証内容         |
| ----- | -------------------------------------------- | ---------------- |
| IW-75 | 正常実行時にresultを返す                     | 成功パス         |
| IW-76 | user未設定時にerrorが設定されnullが返る      | 認証チェック     |
| IW-77 | archivePath未設定時にnullが返る              | 前提条件チェック |
| IW-78 | fileOverviewData未設定時にerrorが設定される  | 前提条件チェック |
| IW-79 | 実行中にisProcessingがtrueになる             | 処理中フラグ     |
| IW-80 | idIntegrationImport失敗時にerrorが設定される | エラー処理       |
| IW-82 | idIntegrationImportに全設定が正しく渡される  | 引数検証         |

#### reset / clearError（2テスト）

| ID    | テスト名                        | 検証内容         |
| ----- | ------------------------------- | ---------------- |
| IW-85 | resetで初期状態に戻る           | 全状態リセット   |
| IW-86 | clearErrorでerrorのみnullになる | エラーのみクリア |

### ImportWizardModal.test.tsx（8テスト）

インポートウィザードモーダルの表示・操作を検証。`useImportWizard` をモジュールモックで差し替え。

| ID   | テスト名                                              | 検証内容           |
| ---- | ----------------------------------------------------- | ------------------ |
| IM-1 | モーダルが開くとfile_selectステップが表示される       | 初期表示           |
| IM-2 | 戻るボタンがfile_selectで無効化される                 | 先頭ステップの制限 |
| IM-3 | 処理中はキャンセルボタンが無効化される                | 処理中の操作制限   |
| IM-4 | 処理中に戻るボタンが無効化される                      | 処理中の操作制限   |
| IM-5 | エラー表示時にエラーメッセージが表示される            | エラー表示         |
| IM-6 | ステップインジケーターが全ステップを表示する          | 全6ステップ表示    |
| IM-7 | キャンセルボタンクリックでonCloseが呼ばれる           | キャンセル動作     |
| IM-8 | 処理中にキャンセルボタンクリックでonCloseが呼ばれない | 処理中の保護       |

### FileSelectStep.test.tsx（4テスト）

ファイル選択ステップコンポーネントの表示・操作を検証。

| ID   | テスト名                             | 検証内容         |
| ---- | ------------------------------------ | ---------------- |
| FS-1 | ファイル選択ボタンが表示される       | ボタン表示       |
| FS-2 | ボタンクリックでselectFileが呼ばれる | クリック動作     |
| FS-3 | 処理中にローディング表示になる       | ローディング表示 |
| FS-4 | 処理中にボタンが無効化される         | 操作制限         |

### FileOverviewStep.test.tsx（7テスト）

ファイル概要ステップコンポーネントの統計表示・操作を検証。

| ID   | テスト名                                               | 検証内容                     |
| ---- | ------------------------------------------------------ | ---------------------------- |
| FO-1 | 試験名がmanifestから表示される                         | 試験名表示                   |
| FO-2 | カテゴリ別統計が正しく表示される                       | 生徒・学級・小計グループ件数 |
| FO-3 | 自動紐づけ件数が正しく表示される                       | byId件数の表示               |
| FO-4 | 判断が必要な件数が正しく表示される                     | noMatch件数の表示            |
| FO-5 | 次へボタンクリックでgoToNextStepが呼ばれる             | 次へ操作                     |
| FO-6 | fileOverviewData未取得時にperformPreMatchingが呼ばれる | 自動照合実行                 |
| FO-7 | fileOverviewData未取得時にヘルプメッセージが表示される | ヘルプ表示                   |

### ExecuteStep.test.tsx（6テスト）

実行ステップコンポーネントの自動実行・結果表示を検証。

| ID   | テスト名                                        | 検証内容           |
| ---- | ----------------------------------------------- | ------------------ |
| EX-1 | マウント時にexecuteImportが自動実行される       | 自動実行           |
| EX-2 | 実行中にプログレス表示がされる                  | ローディング表示   |
| EX-3 | 成功時に完了メッセージが表示される              | 成功表示           |
| EX-4 | 成功時に試験を開くボタンが表示される            | 成功時のアクション |
| EX-5 | 失敗時にエラーメッセージが表示される            | エラー表示         |
| EX-6 | 試験を開くボタンでonCompleteとonCloseが呼ばれる | コールバック動作   |

---

## テスト実行方法

```bash
# 全テスト実行（test scriptは未定義のため直接実行）
npx vitest run

# インポート/エクスポートのテストのみ（メインプロセス側）
npx vitest run __tests__/import-export/

# レンダラ側テストのみ
npx vitest run __tests__/renderer/

# フックテストのみ
npx vitest run __tests__/renderer/hooks/

# コンポーネントテストのみ
npx vitest run __tests__/renderer/components/

# 特定ファイルのみ
npx vitest run __tests__/import-export/unit/manifestValidator.test.ts

# ウォッチモード（ファイル変更時に自動再実行）
npx vitest __tests__/import-export/
```

## テスト設計の注意点

- **SQLite制限**: `fileParallelism: false` を設定し、テストファイル間の並列実行を無効化しています
- **各テストの独立性**: `beforeEach` でテスト用データを作成し、`afterEach` で削除しています
- **Electronモック**: `vi.mock("electron")` と `vi.mock("electron-src/lib/dataManager")` により、Electron環境なしでテスト可能です
- **画像インポートモック**: `vi.mock("electron-src/lib/import/merge/imageImporter")` により、ファイルシステムへの画像コピーをスキップしています
- **jsdom環境切り替え**: レンダラテストはファイル先頭の `// @vitest-environment jsdom` コメントで環境を切り替えています
- **useAuthモック**: `vi.mock("@/contexts/AuthContext")` でAuthContextをモック化し、`beforeEach` でデフォルトユーザーをリセットしています
- **window.electronAPIモック**: `Object.defineProperty` で `window.electronAPI` を設定し、`afterEach` で削除しています
