-- 既存のSubtotalGroupを教科と関連付け

-- 「大問」のSubtotalGroupを数学と関連付け
INSERT INTO SubjectSubtotalGroup (
    "id",
    "subjectId",
    "subtotalGroupId", 
    "createdAt",
    "updatedAt"
)
SELECT 
    lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-' || '4' || substr(hex(randomblob(2)), 2) || '-' || substr('AB89', 1 + (abs(random()) % 4), 1) || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6))) as id,
    s.id as subjectId,
    sg.id as subtotalGroupId,
    datetime('now') as createdAt,
    datetime('now') as updatedAt
FROM Subject s, SubtotalGroup sg
WHERE s.name = '数学' AND sg.name = '大問';

-- 「観点別評価」のSubtotalGroupを国語と関連付け
INSERT INTO SubjectSubtotalGroup (
    "id", 
    "subjectId",
    "subtotalGroupId",
    "createdAt", 
    "updatedAt"
)
SELECT 
    lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-' || '4' || substr(hex(randomblob(2)), 2) || '-' || substr('AB89', 1 + (abs(random()) % 4), 1) || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6))) as id,
    s.id as subjectId,
    sg.id as subtotalGroupId,
    datetime('now') as createdAt,
    datetime('now') as updatedAt
FROM Subject s, SubtotalGroup sg  
WHERE s.name = '国語' AND sg.name = '観点別評価';