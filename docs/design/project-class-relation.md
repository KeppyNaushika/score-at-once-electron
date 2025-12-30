# ProjectClass リレーション設計書

## 概要

プロジェクトとクラスの多対多関係を管理するテーブル。
受験生徒の追加元クラスと、統計集計用クラスを柔軟に設定可能にする。

---

## 背景・課題

### 現状の問題

1. **クラス認識が固定的**
   - 生徒のクラスは `StudentClassMembership` の最新レコードから取得
   - プロジェクト単位でのクラス指定ができない

2. **複数グループでの集計不可**
   - 例: 生徒は「1-A」から追加したいが、統計は「サッカー部」でも出したい
   - 現状は1つのクラスでしか集計できない

3. **プロジェクトとクラスの関連が不明確**
   - どのクラスがこのテストの対象なのか、データとして保存されていない

---

## 設計

### データモデル

```prisma
model ProjectClass {
  id           String   @id @default(uuid())
  projectId    String
  classId      String
  administered Boolean  @default(false)  // 受験生徒追加用
  statistics   Boolean  @default(false)  // 統計集計用
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  project      Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)
  class        Class    @relation(fields: [classId], references: [id], onDelete: Cascade)

  @@unique([projectId, classId])
  @@index([projectId])
  @@index([classId])
}
```

### カラム説明

| カラム         | 型      | 説明                                       |
| -------------- | ------- | ------------------------------------------ |
| `administered` | Boolean | `true`: このクラスから受験生徒を追加できる |
| `statistics`   | Boolean | `true`: このクラスで統計集計を行う         |

### フラグの組み合わせ

| administered | statistics | 用途                                 |
| ------------ | ---------- | ------------------------------------ |
| true         | false      | 受験生徒追加のみ（統計には使わない） |
| false        | true       | 統計集計のみ（生徒追加には使わない） |
| true         | true       | 両方で使用                           |
| false        | false      | 無効（削除候補）                     |

---

## 使用例

### シナリオ: 学年末テスト

1年生全クラス（1-A, 1-B, 1-C）が受験し、クラス別・学年全体で統計を出す。

```
| projectId | classId   | administered | statistics |
|-----------|-----------|--------------|------------|
| exam-001  | class-1A  | true         | true       |
| exam-001  | class-1B  | true         | true       |
| exam-001  | class-1C  | true         | true       |
```

### シナリオ: 部活動の学力テスト

サッカー部員（複数クラスに所属）のテスト。クラス別ではなく部活単位で統計。

```
| projectId | classId       | administered | statistics |
|-----------|---------------|--------------|------------|
| exam-002  | class-1A      | true         | false      |
| exam-002  | class-1B      | true         | false      |
| exam-002  | class-2A      | true         | false      |
| exam-002  | club-soccer   | false        | true       |
```

### シナリオ: 習熟度別クラスのテスト

生徒は通常クラスから追加、統計は習熟度別クラスで集計。

```
| projectId | classId        | administered | statistics |
|-----------|----------------|--------------|------------|
| exam-003  | class-1A       | true         | false      |
| exam-003  | class-1B       | true         | false      |
| exam-003  | math-advanced  | false        | true       |
| exam-003  | math-standard  | false        | true       |
| exam-003  | math-basic     | false        | true       |
```

---

## API設計

### クラス取得

```typescript
// 受験生徒追加用クラス一覧
async function getAdministeredClasses(projectId: string): Promise<Class[]> {
  const projectClasses = await prisma.projectClass.findMany({
    where: { projectId, administered: true },
    include: { class: true },
  })
  return projectClasses.map((pc) => pc.class)
}

// 統計集計用クラス一覧
async function getStatisticsClasses(projectId: string): Promise<Class[]> {
  const projectClasses = await prisma.projectClass.findMany({
    where: { projectId, statistics: true },
    include: { class: true },
  })
  return projectClasses.map((pc) => pc.class)
}
```

### クラス設定

```typescript
// プロジェクトにクラスを追加
async function addProjectClass(
  projectId: string,
  classId: string,
  options: { administered?: boolean; statistics?: boolean }
): Promise<ProjectClass> {
  return prisma.projectClass.upsert({
    where: { projectId_classId: { projectId, classId } },
    create: {
      projectId,
      classId,
      administered: options.administered ?? false,
      statistics: options.statistics ?? false,
    },
    update: {
      administered: options.administered,
      statistics: options.statistics,
    },
  })
}
```

---

## UI設計

### プロジェクト設定画面

```
┌─────────────────────────────────────────────────────┐
│ 対象クラス設定                                        │
├─────────────────────────────────────────────────────┤
│                                                     │
│  クラス名     │ 受験生徒 │ 統計集計 │               │
│  ─────────────┼──────────┼──────────┤               │
│  1年A組       │   [✓]    │   [✓]    │               │
│  1年B組       │   [✓]    │   [✓]    │               │
│  サッカー部   │   [ ]    │   [✓]    │               │
│                                                     │
│  [+ クラスを追加]                                    │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### 受験生徒追加モーダル

```
┌─────────────────────────────────────────────────────┐
│ 受験生徒を追加                                        │
├─────────────────────────────────────────────────────┤
│                                                     │
│  追加元クラス:  [1年A組 ▼]  ← administered=true のみ │
│                                                     │
│  □ 全員選択                                         │
│  ☑ 山田太郎 (1)                                     │
│  ☑ 鈴木花子 (2)                                     │
│  ☑ 佐藤次郎 (3)                                     │
│  ...                                                │
│                                                     │
│            [キャンセル]  [追加]                       │
└─────────────────────────────────────────────────────┘
```

---

## 出力への影響

### Excel出力

#### 変更前

- クラス列: 生徒の最新 membership から取得
- クラス別集計: なし

#### 変更後

- クラス列: 生徒の最新 membership から取得（変更なし）
- **クラス別集計シート追加**: `statistics=true` のクラスごとに平均・最高・最低・人数

```
┌─────────────────────────────────────────────────────┐
│ シート: クラス別集計                                  │
├─────────────────────────────────────────────────────┤
│ クラス名 │ 人数 │ 平均点 │ 最高点 │ 最低点 │ 標準偏差 │
│ ─────────┼──────┼────────┼────────┼────────┼─────────│
│ 1年A組   │  35  │  72.5  │   98   │   45   │  12.3   │
│ 1年B組   │  34  │  68.2  │   95   │   32   │  15.1   │
│ サッカー部│  22  │  70.1  │   92   │   48   │  11.8   │
└─────────────────────────────────────────────────────┘
```

### 個人成績表PDF

#### 変更前

- クラス統計: 生徒の membership クラスで集計

#### 変更後

- クラス統計: `statistics=true` のクラスのうち、その生徒が所属するクラスで集計
- 複数該当する場合は、最初に見つかったクラスを使用（または全て表示）

---

## 統計集計ロジック

### 生徒のクラス判定

```typescript
function getStudentStatisticsClass(
  student: StudentWithMemberships,
  statisticsClasses: Class[]
): Class | null {
  // 統計用クラスのうち、生徒が所属しているものを探す
  for (const statsClass of statisticsClasses) {
    const membership = student.memberships.find(
      (m) => m.classId === statsClass.id
    )
    if (membership) {
      return statsClass
    }
  }
  // 該当なし: 統計集計から除外、または「その他」グループに
  return null
}
```

### 集計処理

```typescript
function calculateClassStatistics(
  students: StudentWithScores[],
  statisticsClasses: Class[]
): Map<string, ClassStatistics> {
  const result = new Map<string, ClassStatistics>()

  for (const statsClass of statisticsClasses) {
    // このクラスに所属する生徒を抽出
    const classStudents = students.filter((s) =>
      s.memberships.some((m) => m.classId === statsClass.id)
    )

    const scores = classStudents.map((s) => s.totalScore)

    result.set(statsClass.id, {
      className: statsClass.name,
      count: classStudents.length,
      average: calculateAverage(scores),
      max: Math.max(...scores),
      min: Math.min(...scores),
      stdDev: calculateStdDev(scores),
    })
  }

  return result
}
```

---

## マイグレーション計画

### Phase 1: スキーマ追加

1. `ProjectClass` テーブルを作成
2. Project モデルに `projectClasses` リレーション追加
3. Class モデルに `projectClasses` リレーション追加

### Phase 2: バックエンド実装

1. CRUD用のPrisma関数作成
2. IPC ハンドラー追加
3. 既存の出力ロジックに統計クラス対応追加

### Phase 3: フロントエンド実装

1. プロジェクト設定画面にクラス設定UIを追加
2. 受験生徒追加モーダルを `administered` クラスでフィルタ
3. 出力設定画面で統計クラスを確認可能に

### Phase 4: データ移行（オプション）

- 既存プロジェクトに対して、受験生徒の membership から自動的に ProjectClass を生成
- `administered=true, statistics=true` として追加

---

## 関連ファイル

### 変更が必要なファイル

**スキーマ**

- `prisma/schema.prisma`

**バックエンド**

- `electron-src/lib/prisma/projectClass.ts` (新規)
- `electron-src/lib/export/excel/data-fetcher.ts`
- `electron-src/lib/export/individual-report/data-fetcher.ts`
- `electron-src/ipc-handlers/project-handlers.ts`

**フロントエンド**

- `components/projects/05-students/components/project-student-add-modal/`
- `app/projects/[projectId]/settings/` (新規または既存拡張)

**型定義**

- `types/common.types.ts`
- `types/electron.d.ts`

---

## 今後の拡張可能性

1. **クラス別の配点設定**: クラスによって異なる配点を適用
2. **クラス別のレポート生成**: クラス単位でPDFを分割出力
3. **クラス担任への共有**: 特定クラスの結果のみを担任に共有
