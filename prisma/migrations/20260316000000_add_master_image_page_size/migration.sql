-- AlterTable: MasterImage に pageSize を追加
ALTER TABLE "MasterImage" ADD COLUMN "pageSize" TEXT NOT NULL DEFAULT 'A4';

-- DrawingAnnotation: strokeWidth と fontSize をピクセル値からmm値に概算変換
-- A4 portrait + PDF scale=2.0 基準: 1px ≈ 210mm / 1190px ≈ 0.1765mm
-- 小数第2位に丸める
UPDATE "DrawingAnnotation"
SET "strokeWidth" = ROUND("strokeWidth" * 210.0 / 1190.0, 2),
    "fontSize" = ROUND("fontSize" * 210.0 / 1190.0, 2);
