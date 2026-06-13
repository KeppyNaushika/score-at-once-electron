-- AlterTable: 罫線種別ごとの破線/点線ダッシュ長・間隔（線幅に対する倍率）。
-- いずれも任意（NULL=既定 dash3倍/gap2倍）。
ALTER TABLE "AsbDefinition" ADD COLUMN "borderOuterBorderDashRatio" REAL;
ALTER TABLE "AsbDefinition" ADD COLUMN "borderOuterBorderGapRatio" REAL;
ALTER TABLE "AsbDefinition" ADD COLUMN "borderMajorDividerDashRatio" REAL;
ALTER TABLE "AsbDefinition" ADD COLUMN "borderMajorDividerGapRatio" REAL;
ALTER TABLE "AsbDefinition" ADD COLUMN "borderSubDividerDashRatio" REAL;
ALTER TABLE "AsbDefinition" ADD COLUMN "borderSubDividerGapRatio" REAL;
ALTER TABLE "AsbDefinition" ADD COLUMN "borderBranchDividerDashRatio" REAL;
ALTER TABLE "AsbDefinition" ADD COLUMN "borderBranchDividerGapRatio" REAL;
ALTER TABLE "AsbDefinition" ADD COLUMN "borderMajorNumberDividerDashRatio" REAL;
ALTER TABLE "AsbDefinition" ADD COLUMN "borderMajorNumberDividerGapRatio" REAL;
ALTER TABLE "AsbDefinition" ADD COLUMN "borderSubNumberDividerDashRatio" REAL;
ALTER TABLE "AsbDefinition" ADD COLUMN "borderSubNumberDividerGapRatio" REAL;
ALTER TABLE "AsbDefinition" ADD COLUMN "borderBranchNumberDividerDashRatio" REAL;
ALTER TABLE "AsbDefinition" ADD COLUMN "borderBranchNumberDividerGapRatio" REAL;
ALTER TABLE "AsbDefinition" ADD COLUMN "borderManuscriptCharDividerDashRatio" REAL;
ALTER TABLE "AsbDefinition" ADD COLUMN "borderManuscriptCharDividerGapRatio" REAL;
ALTER TABLE "AsbDefinition" ADD COLUMN "borderManuscriptLineDividerDashRatio" REAL;
ALTER TABLE "AsbDefinition" ADD COLUMN "borderManuscriptLineDividerGapRatio" REAL;
