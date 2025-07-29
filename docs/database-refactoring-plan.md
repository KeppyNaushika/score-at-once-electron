# データベース・リファクタリング計画

## 概要

プロジェクトのデータベース設計を改善し、コードの保守性と直感性を向上させる包括的なリファクタリング計画。

## 1. テーブル統合

### QuestionSubtotalAssignment + SubtotalDefinition → CropSubtotal

**現状の問題:**
- 同一構造の2テーブルが存在
- 重複したCRUD操作とビジネスロジック
- 保守コストの増大

**統合後の設計:**
```prisma
model CropSubtotal {
  id             String     @id @default(uuid())
  cropRegionId   String     // 統一フィールド名
  subtotalId     String
  assignmentType String     @default("SUBTOTAL_DEFINITION")
  createdAt      DateTime   @default(now())
  updatedAt      DateTime   @updatedAt
  subtotal       Subtotal   @relation(fields: [subtotalId], references: [id], onDelete: Cascade)
  cropRegion     CropRegion @relation(fields: [cropRegionId], references: [id], onDelete: Cascade)

  @@unique([cropRegionId, subtotalId])
  @@index([cropRegionId])
  @@index([subtotalId])
  @@index([assignmentType])
}
```

**assignmentType値:**
- `SUBTOTAL_DEFINITION`: 小計定義（旧SubtotalDefinition）
- `QUESTION_ASSIGNMENT`: 設問割り当て（旧QuestionSubtotalAssignment）

## 4. 追加のテーブル構造更新

### 更新されるテーブル構造

```prisma
model SubtotalGroup {
  id        String     @id @default(uuid())
  name      String
  projectId String
  createdAt DateTime   @default(now())
  updatedAt DateTime   @updatedAt
  project   Project    @relation(fields: [projectId], references: [id], onDelete: Cascade)
  subtotals Subtotal[]

  @@unique([projectId, name])
  @@index([projectId])
}

model Subtotal {
  id                      String                   @id @default(uuid())
  name                    String
  subtotalGroupId         String
  order                   Int                      @default(0)
  createdAt               DateTime                 @default(now())
  updatedAt               DateTime                 @updatedAt
  subtotalGroup           SubtotalGroup            @relation(fields: [subtotalGroupId], references: [id], onDelete: Cascade)
  cropSubtotals           CropSubtotal[]
  subtotalDefinitions     SubtotalDefinition[]

  @@unique([subtotalGroupId, name])
  @@index([subtotalGroupId])
  @@index([subtotalGroupId, order])
}
```

**影響範囲:**
- 修正ファイル: 35ファイル
- 修正行数: 1200-1800行
- 新API: 8-12個
- 既存API更新: 15-25個

## 2. テーブル名変更

### LayoutRegion → CropRegion

**変更理由:**
- 実際の機能: ドラッグ&ドロップによる画像切り取り領域定義
- 技術的正確性: システムはcrop処理を実行
- 実装整合性: 座標データ(x,y,width,height)による矩形範囲指定

**影響範囲:**
- 61ファイルで406箇所の変更
- 9つのリレーション更新
- 全TypeScript型定義の更新

### QuestionGroup → SubtotalGroup

**変更理由:**
- 実際の用途: 小計グループの管理
- 機能的正確性: 設問そのものではなく小計計算のためのグルーピング
- 直感的理解: 「小計グループ」として即座に理解可能

### QuestionGroupItem → Subtotal

**変更理由:**
- 実際の概念: 個別の小計項目
- 簡潔性: より短く直感的な名前
- 機能適合: 小計計算の基本単位

## 3. 構造的問題の解決：ProjectPage中心設計

### 現在の設計の問題点

**MasterImage・AnswerSheetの危険な関係性:**
- pageNumberのみで関連付け（脆弱な設計）
- 適切なrelationがない（整合性保証なし）
- unique制約なし（重複データの危険性）
- LayoutRegionの歪な依存関係（LayoutRegion ← MasterImage ← Project と LayoutRegion ← Project の併存）

### 提案する新設計：ProjectPage中心アーキテクチャ

**理想的な階層構造:**
```
Project
├── ProjectPage[]           // 試験の各ページ（ページ番号で管理）
    ├── MasterImage        // そのページの模範解答（1:1）
    ├── AnswerSheet[]      // そのページの生徒解答（1:N）
    └── CropRegion[]       // そのページの採点領域（1:N）
```

**新しいスキーマ設計:**
```prisma
model ProjectPage {
  id           String        @id @default(uuid())
  projectId    String
  pageNumber   Int
  createdAt    DateTime      @default(now())
  updatedAt    DateTime      @updatedAt
  project      Project       @relation(fields: [projectId], references: [id], onDelete: Cascade)
  masterImage  MasterImage?  // 1:1関係
  answerSheets AnswerSheet[] // 1:N関係
  cropRegions  CropRegion[]  // 1:N関係

  @@unique([projectId, pageNumber])
  @@index([projectId])
}

model MasterImage {
  id            String      @id @default(uuid())
  projectPageId String      @unique  // ProjectPageに対して1つだけ
  imagePath     String
  createdAt     DateTime    @default(now())
  updatedAt     DateTime    @updatedAt
  projectPage   ProjectPage @relation(fields: [projectPageId], references: [id], onDelete: Cascade)

  @@index([projectPageId])
}

model AnswerSheet {
  id                 String        @id @default(uuid())
  projectPageId      String
  studentId          String
  originalImagePath  String
  processedImagePath String?
  scoredPdfPath      String?
  isScored           Boolean       @default(false)
  totalScore         Float?
  isAbsent           Boolean       @default(false)
  createdAt          DateTime      @default(now())
  updatedAt          DateTime      @updatedAt
  version            Int           @default(1)
  projectPage        ProjectPage   @relation(fields: [projectPageId], references: [id], onDelete: Cascade)
  student            Student       @relation(fields: [studentId], references: [id])
  questionScores     QuestionScore[]

  @@unique([projectPageId, studentId])  // studentId+ProjectPageの複合に対して1つだけ
  @@index([projectPageId])
  @@index([studentId])
}

model CropRegion {
  id            String      @id @default(uuid())
  projectPageId String      // MasterImageではなくProjectPageに直接関連付け
  label         String
  type          String
  x             Float
  y             Float
  width         Float
  height        Float
  points        Int?
  orderIndex    Int?
  createdAt     DateTime    @default(now())
  updatedAt     DateTime    @updatedAt
  projectPage   ProjectPage @relation(fields: [projectPageId], references: [id], onDelete: Cascade)
  questionScores QuestionScore[]
  cropSubtotals  CropSubtotal[]

  @@index([projectPageId])
}
```

### 新設計の利点

1. **強制される制約:**
   - MasterImage: `projectPageId @unique` により ProjectPageに対して1つだけ
   - AnswerSheet: `@@unique([projectPageId, studentId])` により 複合キーに対して1つだけ

2. **効率的なアクセス:**
   ```typescript
   // ProjectPageからMasterImageを即座に取得
   const masterImage = await prisma.masterImage.findUnique({
     where: { projectPageId }
   })
   
   // ProjectPage + Student から AnswerSheet を即座に取得
   const answerSheet = await prisma.answerSheet.findUnique({
     where: {
       projectPageId_studentId: { projectPageId, studentId }
     }
   })
   ```

3. **論理的整合性:**
   - ページという自然な概念で整理
   - CropRegionが属するページが明確
   - 歪な依存関係の解消

4. **安全性の向上:**
   - 適切なrelationと制約による整合性保証
   - pageNumberだけに依存しない安全な設計
   - データ重複の完全防止

## 5. 実装戦略

### フェーズ1: 構造的改革（4-5週間）

**1週目: ProjectPage導入**
```sql
-- ProjectPageテーブル作成
CREATE TABLE ProjectPage (
  id TEXT PRIMARY KEY,
  projectId TEXT NOT NULL,
  pageNumber INTEGER NOT NULL,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(projectId, pageNumber)
);

-- 既存データからProjectPage作成
INSERT INTO ProjectPage (id, projectId, pageNumber)
SELECT DISTINCT 
  generate_uuid(), 
  projectId, 
  pageNumber 
FROM MasterImage;
```

**2週目: MasterImage・AnswerSheet再構築**
```sql
-- 新しいMasterImageテーブル
CREATE TABLE MasterImage_new (
  id TEXT PRIMARY KEY,
  projectPageId TEXT UNIQUE,  -- 1:1制約
  imagePath TEXT NOT NULL,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 新しいAnswerSheetテーブル  
CREATE TABLE AnswerSheet_new (
  id TEXT PRIMARY KEY,
  projectPageId TEXT NOT NULL,
  studentId TEXT NOT NULL,
  originalImagePath TEXT NOT NULL,
  processedImagePath TEXT,
  scoredPdfPath TEXT,
  isScored BOOLEAN DEFAULT FALSE,
  totalScore REAL,
  isAbsent BOOLEAN DEFAULT FALSE,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  version INTEGER DEFAULT 1,
  UNIQUE(projectPageId, studentId)  -- 複合unique制約
);

-- データ移行
INSERT INTO MasterImage_new (id, projectPageId, imagePath, ...)
SELECT mi.id, pp.id, mi.path, ...
FROM MasterImage mi
JOIN ProjectPage pp ON mi.projectId = pp.projectId AND mi.pageNumber = pp.pageNumber;

INSERT INTO AnswerSheet_new (id, projectPageId, studentId, originalImagePath, ...)
SELECT as.id, pp.id, as.studentId, as.originalImagePath, ...
FROM AnswerSheet as
JOIN ProjectPage pp ON as.projectId = pp.projectId AND as.pageNumber = pp.pageNumber;
```

**3週目: CropRegion更新**
```sql
-- CropRegionをProjectPageに直接関連付け
ALTER TABLE LayoutRegion ADD COLUMN projectPageId TEXT;

UPDATE LayoutRegion 
SET projectPageId = (
  SELECT pp.id 
  FROM ProjectPage pp 
  JOIN MasterImage mi ON pp.projectId = mi.projectId AND pp.pageNumber = mi.pageNumber
  WHERE mi.id = LayoutRegion.masterImageId
);

-- 古いmasterImageId削除
ALTER TABLE LayoutRegion DROP COLUMN masterImageId;
ALTER TABLE LayoutRegion RENAME TO CropRegion;
```

**4週目: テーブル名変更・統合**
```sql
-- テーブル名変更
ALTER TABLE QuestionGroup RENAME TO SubtotalGroup;
ALTER TABLE QuestionGroupItem RENAME TO Subtotal;

-- 統合テーブル作成
CREATE TABLE CropSubtotal (...);

-- データ移行
INSERT INTO CropSubtotal 
SELECT ..., 'SUBTOTAL_DEFINITION' FROM SubtotalDefinition
UNION ALL
SELECT ..., 'QUESTION_ASSIGNMENT' FROM QuestionSubtotalAssignment;

-- 整合性確認
```

**5週目: バックエンドAPI実装**
```typescript
// ProjectPage関連API
export const getProjectPages = async (projectId: string) => { ... }
export const getMasterImageByPage = async (projectPageId: string) => { ... }
export const getAnswerSheetByPageAndStudent = async (projectPageId: string, studentId: string) => { ... }

// 統合サービス層
export const createCropSubtotal = async (data) => { ... }
export const getAssignmentsByCropRegionId = async (cropRegionId, type?) => { ... }
export const getAssignmentsBySubtotalId = async (subtotalId, type?) => { ... }

// 互換性レイヤー（移行期間中）
export const getSubtotalDefinitionsByCropRegionId = async (cropRegionId) => {
  return getAssignmentsByCropRegionId(cropRegionId, 'SUBTOTAL_DEFINITION')
}

// 効率的なアクセス関数
export const getAnswerSheetsByPage = async (projectPageId: string) => { ... }
export const getPageWithAllData = async (projectPageId: string) => { ... }
```

### フェーズ2: フロントエンド更新（3-4週間）

**1週目: 型定義とインターフェース更新**
```typescript
// 新しい型定義
interface ProjectPageData {
  id: string
  projectId: string
  pageNumber: number
  masterImage?: MasterImageData
  answerSheets: AnswerSheetData[]
  cropRegions: CropRegionData[]
}

// 既存型の更新
LayoutRegionArea → CropRegionArea
LayoutRegionAreaType → CropRegionAreaType
QuestionGroupItem → Subtotal
QuestionGroup → SubtotalGroup
MasterImageData → 新しい構造に更新
AnswerSheetData → 新しい構造に更新
```

**2週目: コンポーネント構造変更**
```typescript
// 新しいページベースコンポーネント
ProjectPageManager → ProjectPageの管理
MasterImageViewer → ProjectPage単位での表示
AnswerSheetGrid → ProjectPage単位での生徒解答表示

// 既存コンポーネント更新
LayoutRegionEditor → CropRegionEditor （ProjectPageベース）
TemplateCreator → ProjectPageベースでの領域作成
```

**3-4週目: 業務ロジック更新**
```typescript
// 採点ロジックの更新（ProjectPageベース）
ScoringInterface → ProjectPageベースの採点画面
SubtotalCalculator → ProjectPageベースの集計
ExportLogic → ProjectPageベースのPDF/Excel出力

// API統合更新
getLayoutRegionsByProjectId → getCropRegionsByProjectPageId
getMasterImagesByProject → getMasterImagesByProjectPage
getAnswerSheetsByProject → getAnswerSheetsByProjectPage
```

### フェーズ3: クリーンアップ（1週間）

- 旧テーブル削除
- 互換性レイヤー削除
- ドキュメント更新
- 包括的テスト実行

## 6. リスク管理

### 高リスク要素
- **構造的変更**: ProjectPage導入による大規模なデータ移行
- **関係性の再構築**: MasterImage・AnswerSheet・CropRegionの関連変更
- **データ移行**: 完全バックアップ、段階実行、ロールバック計画
- **ビジネスロジック**: 採点・集計・出力処理の継続性確保
- **同時開発**: 開発チーム間の調整

### 新たなリスク要因
- **pageNumber依存**: 既存コードのpageNumber依存箇所の洗い出し
- **unique制約**: 複合unique制約の移行時整合性チェック
- **パフォーマンス**: 新しいJOIN構造による性能影響

### 対策
- 移行期間中の互換性レイヤー維持
- 段階的デプロイとフィーチャーフラグ
- 包括的な自動テスト実装

## 7. 成功基準

- ✅ データ損失ゼロ
- ✅ 機能的同等性の維持
- ✅ パフォーマンス維持
- ✅ コード重複の大幅削減
- ✅ 直感的な命名による保守性向上
- ✅ 構造的整合性の確立（ProjectPage中心設計）
- ✅ データ整合性の強化（適切なunique制約）
- ✅ アクセス効率の向上（O(1)での関連データ取得）

## 8. 期待効果

### 短期効果
- コード重複削減（2テーブル→1テーブル）
- API数削減と統合
- 保守負荷軽減
- データ整合性の大幅向上
- pageNumber依存の危険性解消

### 長期効果
- 新機能追加の容易性
- 開発者の理解容易性
- システム拡張性向上
- **構造的安全性**: 適切な制約による不正データの完全防止
- **論理的明確性**: ページ概念による自然な階層構造
- **パフォーマンス**: unique制約を活用した高速データアクセス

---

**推定工期**: 10-12週間
**影響範囲**: 120ファイル、1800-2500行の変更
**優先度**: 高（構造的問題の根本解決、安全性向上）

## 9. 変更後のテーブル構造サマリー

### 変更前 → 変更後
- `LayoutRegion` → `CropRegion`
- `QuestionGroup` → `SubtotalGroup` 
- `QuestionGroupItem` → `Subtotal`
- `QuestionSubtotalAssignment` + `SubtotalDefinition` → `CropSubtotal`
- **新規**: `ProjectPage` （ページ概念の導入）
- `MasterImage` → ProjectPageベース（1:1関係）
- `AnswerSheet` → ProjectPageベース（複合unique制約）

### 最終的なリレーション
```
Project
├── ProjectPage[]                    // ページ概念で整理
│   ├── MasterImage (1:1)           // そのページの模範解答
│   ├── AnswerSheet[] (1:N)         // そのページの生徒解答
│   └── CropRegion[] (1:N)          // そのページの採点領域
├── SubtotalGroup[]                 // 小計グループ
│   └── Subtotal[] (1:N)           // 個別小計項目
└── CropSubtotal[] (M:N)           // 採点領域↔小計の関連付け
```

### 構造改革の要点

#### **ProjectPage中心設計の利点:**
- **安全な制約**: MasterImage（1:1）、AnswerSheet（複合unique）
- **効率的アクセス**: O(1)での関連データ取得
- **論理的整合性**: ページ概念による自然な階層
- **歪な依存解消**: CropRegion → ProjectPage の直接関係

#### **命名統一の利点:**
- `CropSubtotal`: `ProjectStudent`パターンと一貫した簡潔な命名
- 直感的で美しい命名（Assignmentの冗長性を排除）
- 技術的正確性（CropRegion + Subtotal の関連付け）

#### **データ整合性の強化:**
- pageNumberのみの脆弱な関連付けを排除
- 適切なrelationとunique制約による安全性確保
- 重複データの完全防止

## 10. 多対多関係の強化（2025年7月29日追加）

### Project-User関係の多対多化

**現状の問題:**
- Projectは1人のUserのみに関連付けられている
- 複数教員による協調採点が実現できない

**提案する設計:**
```prisma
model UserProject {
  id        String   @id @default(uuid())
  userId    String
  projectId String
  role      String   @default("GRADER")  // OWNER, GRADER, VIEWER等
  joinedAt  DateTime @default(now())
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  project   Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)

  @@unique([userId, projectId])
  @@index([userId])
  @@index([projectId])
  @@index([role])
}

model Project {
  id                 String            @id @default(uuid())
  name               String
  description        String?
  tag                String?
  createdAt          DateTime          @default(now())
  updatedAt          DateTime          @updatedAt
  userProjects       UserProject[]     // Userとの多対多関係
  projectSubtotalGroups ProjectSubtotalGroup[]  // SubtotalGroupとの多対多関係
  // その他の既存フィールド...
}

model User {
  id           String        @id @default(uuid())
  username     String        @unique
  email        String?       @unique
  passwordHash String
  createdAt    DateTime      @default(now())
  updatedAt    DateTime      @updatedAt
  userProjects UserProject[] // Projectとの多対多関係
  // その他の既存フィールド...
}
```

### SubtotalGroup-Project関係の多対多化

**現状の問題:**
- SubtotalGroupは特定のProjectに紐づいている
- 同一設問構成の試験で設定を再利用できない

**提案する設計:**
```prisma
model ProjectSubtotalGroup {
  id              String        @id @default(uuid())
  projectId       String
  subtotalGroupId String
  order           Int           @default(0)
  isActive        Boolean       @default(true)
  createdAt       DateTime      @default(now())
  updatedAt       DateTime      @updatedAt
  project         Project       @relation(fields: [projectId], references: [id], onDelete: Cascade)
  subtotalGroup   SubtotalGroup @relation(fields: [subtotalGroupId], references: [id], onDelete: Cascade)

  @@unique([projectId, subtotalGroupId])
  @@index([projectId])
  @@index([subtotalGroupId])
  @@index([projectId, order])
}

model SubtotalGroup {
  id                     String                  @id @default(uuid())
  name                   String
  description            String?
  createdAt              DateTime                @default(now())
  updatedAt              DateTime                @updatedAt
  subtotals              Subtotal[]
  projectSubtotalGroups  ProjectSubtotalGroup[]  // Projectとの多対多関係
  subjectSubtotalGroups  SubjectSubtotalGroup[]  // Subjectとの多対多関係

  @@index([name])
}
```

### Subject（教科）テーブルの新設

**新機能の実現:**
- 教科別でのフィルタリング表示
- 複数Project横断でのSubtotal推移追跡

**提案する設計:**
```prisma
model Subject {
  id                    String                 @id @default(uuid())
  name                  String                 @unique  // 数学、国語、英語等
  description           String?
  createdAt             DateTime               @default(now())
  updatedAt             DateTime               @updatedAt
  subjectSubtotalGroups SubjectSubtotalGroup[]

  @@index([name])
}

model SubjectSubtotalGroup {
  id              String        @id @default(uuid())
  subjectId       String
  subtotalGroupId String
  createdAt       DateTime      @default(now())
  updatedAt       DateTime      @updatedAt
  subject         Subject       @relation(fields: [subjectId], references: [id], onDelete: Cascade)
  subtotalGroup   SubtotalGroup @relation(fields: [subtotalGroupId], references: [id], onDelete: Cascade)

  @@unique([subjectId, subtotalGroupId])
  @@index([subjectId])
  @@index([subtotalGroupId])
}
```

### 期待される機能向上

#### 1. 個人成績の横断分析
```typescript
// 生徒の教科別成績推移を取得
async function getStudentProgressBySubject(studentId: string, subjectId: string) {
  return await prisma.subtotal.findMany({
    where: {
      subtotalGroup: {
        subjectSubtotalGroups: {
          some: { subjectId }
        },
        projectSubtotalGroups: {
          some: {
            project: {
              projectStudents: {
                some: { studentId }
              }
            }
          }
        }
      }
    },
    include: {
      subtotalGroup: {
        include: {
          projectSubtotalGroups: {
            include: {
              project: {
                select: { name: true, createdAt: true }
              }
            }
          }
        }
      }
    },
    orderBy: {
      subtotalGroup: {
        projectSubtotalGroups: {
          project: {
            createdAt: 'asc'
          }
        }
      }
    }
  })
}
```

#### 2. 協調採点機能の完全実現
```typescript
// プロジェクトに参加している教員一覧を取得
async function getProjectCollaborators(projectId: string) {
  return await prisma.userProject.findMany({
    where: { projectId },
    include: {
      user: {
        select: { id: true, username: true, email: true }
      }
    },
    orderBy: { joinedAt: 'asc' }
  })
}

// 教員をプロジェクトに招待
async function inviteUserToProject(projectId: string, userId: string, role: string = 'GRADER') {
  return await prisma.userProject.create({
    data: {
      projectId,
      userId,
      role
    }
  })
}
```

#### 3. 教科別フィルタリング
```typescript
// 特定教科のプロジェクト一覧を取得
async function getProjectsBySubject(subjectId: string, userId: string) {
  return await prisma.project.findMany({
    where: {
      userProjects: {
        some: { userId }
      },
      projectSubtotalGroups: {
        some: {
          subtotalGroup: {
            subjectSubtotalGroups: {
              some: { subjectId }
            }
          }
        }
      }
    },
    include: {
      projectSubtotalGroups: {
        include: {
          subtotalGroup: {
            include: {
              subjectSubtotalGroups: {
                include: {
                  subject: true
                }
              }
            }
          }
        }
      }
    }
  })
}
```

### 移行戦略

#### フェーズ1: 基盤テーブル作成（1週間）
```sql
-- Subject テーブル作成
CREATE TABLE Subject (
  id TEXT PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  description TEXT,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- UserProject テーブル作成
CREATE TABLE UserProject (
  id TEXT PRIMARY KEY,
  userId TEXT NOT NULL,
  projectId TEXT NOT NULL,
  role TEXT DEFAULT 'GRADER',
  joinedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(userId, projectId)
);

-- ProjectSubtotalGroup テーブル作成
CREATE TABLE ProjectSubtotalGroup (
  id TEXT PRIMARY KEY,
  projectId TEXT NOT NULL,
  subtotalGroupId TEXT NOT NULL,
  order INTEGER DEFAULT 0,
  isActive BOOLEAN DEFAULT TRUE,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(projectId, subtotalGroupId)
);

-- SubjectSubtotalGroup テーブル作成
CREATE TABLE SubjectSubtotalGroup (
  id TEXT PRIMARY KEY,
  subjectId TEXT NOT NULL,
  subtotalGroupId TEXT NOT NULL,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(subjectId, subtotalGroupId)
);
```

#### フェーズ2: 既存データ移行（1週間）
```sql
-- 既存のProject-User関係をUserProjectに移行
INSERT INTO UserProject (id, userId, projectId, role, joinedAt)
SELECT 
  generate_uuid(),
  userId,
  id,
  'OWNER',
  createdAt
FROM Project;

-- 既存のSubtotalGroup-Project関係をProjectSubtotalGroupに移行
INSERT INTO ProjectSubtotalGroup (id, projectId, subtotalGroupId, order)
SELECT 
  generate_uuid(),
  projectId,
  id,
  0
FROM SubtotalGroup;

-- SubtotalGroupからprojectId外部キーを削除
ALTER TABLE SubtotalGroup DROP COLUMN projectId;
```

#### フェーズ3: API・フロントエンド更新（2-3週間）
- 多対多関係に対応したCRUD API実装
- 協調採点UI（招待・権限管理）の実装
- 教科別フィルタリング機能の実装
- 横断分析画面の実装

### 期待効果

#### 短期効果
- **複数教員協調採点**: プロジェクトに複数教員を招待可能
- **設定の再利用**: 同一SubtotalGroupを複数Projectで使用
- **教科別管理**: 教科ごとのプロジェクト整理

#### 長期効果
- **個人成績追跡**: 生徒の長期的な学習推移の可視化
- **教科横断分析**: 教科間での成績相関分析
- **効率的な採点ワークフロー**: 複数教員での分担採点
- **データの一元管理**: 全教科データの統合管理

---

**追加推定工期**: 4-5週間
**追加影響範囲**: 40ファイル、600-800行の変更
**優先度**: 中（機能拡張、協調採点の実現）