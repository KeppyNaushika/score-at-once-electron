# renderer 型リファクタ 残計画

型規約に沿った renderer 側データ構造の整理。**規約の全文はメモリ `feedback_type_conventions.md`（＋核心は `docs/coding-style.md` §型管理の方針）**。要点：

- renderer で DB 管理データは原則 **Prisma 拡張型**（`Prisma.XGetPayload<{ include }>`）で DB と構造一致。
- DB 由来データを計算した値 → 原則そのコンポーネント内で計算。長い→引数渡し or フック。複数箇所→共通フック。
- Decimal→number / string→literal union は**境界での型注入**（`Omit<Model,"f"> & { f: 補正型 }` ＋ `toX()`/`.toNumber()`）。`SerializedQuestionScore` / `ScoringStatus` が前例。
- ファイル書き出し（Excel/PDF）は DB 非反映の read-out ＝**型制限の対象外**。ただし「必要な型」を渡す（乱立禁止）。
- **独自型を制限する目的＝ DB への書き込み整合性の保護。**

---

## 完了済み（merge 済み or 実装済み・緑）

- **Task 1（PR #935 merge 済み）**: placement を renderer 側解決へ。専用 IPC（`getStudentClassInfo` map / `getStudentClassInfoSingle` single）と main `getStudentClassInfo`（単一）・未使用 `ExamClassroomPlacementMap` を撤去。新設 `src/lib/examClassroomPlacement.ts` の `resolveExamClassroomPlacement(administeredClasses)` が既存 `getAdministered`（DB 構造 IPC）から採番を計算。併せて受験生徒型を nested `ExamStudentWithDetails` へ集約・08 選択を `useStudentSelection` へ・06 並び替えを customOrder のみへ・`ExamClassroomPlacement` に `Classroom` 同梱。
- **Task 2（実装済み・未コミット・緑）**: 06 のフラット `UnifiedStudent` を撤廃し `ExamStudentWithDetails`（nested）を持ち回る（16 ファイル、`.id`→`.studentId` / 氏名→`.student.X`）。**副産物の大発見**: `student-answer-management` に放棄された「管理グリッド」実装が丸ごとデッド（現行は `student-answer-table` パス）。`StudentGridRow`/`StudentCell`/`AnswerCell`/`useStudentAnswerUploadMain`/`useStudentManagement`/`useFileProcessing` ＋ 専用型（`StudentGridRowProps` 他・`StudentWithAnswers`・`hooks/types.ts` 丸ごと・06 root の未使用 `TableCell`/`TableData`）を削除。classroom バッジは唯一 dead な `StudentCell` のみが消費していたため、**06 は placement 自体が不要**になり loadData から撤去（placement は 05 のみ利用）。

---

## 残タスク（この設計で確定）

### 3. export（Excel/PDF）を renderer 主導に

- 型制限の対象外。renderer が採番を含む**必要な**データを export IPC に渡し、`dataFetcher` の `getStudentClassInfoForExam` 呼び出し（main 側採番解決）を撤去。
- 「好きな型」ではなく必要な型（乱立防止）。
- 完了時: main `getStudentClassInfoForExam` を撤去 → 境界型 `ExamClassroomPlacement` は renderer 専用になるので `src/lib/examClassroomPlacement.ts` へ移す。併せて `resolveExamClassroomPlacement` の単体テストを追加（現状は main の `getStudentClassInfoForExam` テストがロジックを担保）。

### 4. coding-style.md へ規約差分を追記（並行セッション完了後）

- 追記内容: 目的＝DB書き込み保護 / 書き出しは対象外＋必要な型 / 計算はコンポーネント・フック / Decimal・union の型注入。
- **`docs/coding-style.md` は現在並行セッションが編集中**のため、そのセッション完了を待って反映。

---

## 進め方メモ

- 残るは 3（export 付け替え）→ 4（coding-style.md 追記）。各段で typecheck ゲート。
- 並行セッション所有ファイル（`coding-style.md` / `identifier-vs-entity-audit.md` / `type-convention-audit.md`）は触らない。
- Task 1 は PR #935 で merge 済み。Task 2 は未コミット（緑）。
