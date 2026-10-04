import { Badge } from "@/components/ui/badge"
import type { CourseworkSummary } from "@/types/coursework.types"

/** 資料一覧の名前セルの2行目（タグ・説明・生徒数・評価項目数） */
export function CourseworkRowSummary({
  coursework,
}: {
  coursework: CourseworkSummary
}) {
  return (
    <span className="flex flex-wrap items-center gap-1">
      {coursework.tags.map((courseworkTag) => (
        <Badge
          key={courseworkTag.tag.id}
          variant="outline"
          className="text-xs font-normal"
          style={
            courseworkTag.tag.color
              ? {
                  borderColor: courseworkTag.tag.color,
                  color: courseworkTag.tag.color,
                }
              : undefined
          }
        >
          {courseworkTag.tag.name}
        </Badge>
      ))}
      <span>
        {coursework.description || "説明なし"}
        {" / 生徒: "}
        {coursework.students.length}名 / 評価項目: {coursework.items.length}
      </span>
    </span>
  )
}
