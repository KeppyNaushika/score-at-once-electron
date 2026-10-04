import { Badge } from "@/components/ui/badge"
import type { GradeSummary } from "@/types/grade.types"

/** 成績算出一覧の名前セルの2行目（タグ・学級・生徒数・評価項目数） */
export function GradeRowSummary({ grade }: { grade: GradeSummary }) {
  const classroomNames = grade.gradeClassrooms
    .map((gradeClassroom) => gradeClassroom.classroom.name)
    .join("、")
  return (
    <span className="flex flex-wrap items-center gap-1">
      {grade.gradeTags.map((gradeTag) => (
        <Badge
          key={gradeTag.tag.id}
          variant="outline"
          className="text-xs font-normal"
          style={
            gradeTag.tag.color
              ? {
                  borderColor: gradeTag.tag.color,
                  color: gradeTag.tag.color,
                }
              : undefined
          }
        >
          {gradeTag.tag.name}
        </Badge>
      ))}
      <span>
        {classroomNames || "学級未登録"}
        {" / 生徒: "}
        {grade.gradeStudents.length}名 / 評価項目: {grade.gradeItems.length}
      </span>
    </span>
  )
}
