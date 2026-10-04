import { Badge } from "@/components/ui/badge"
import type { ExamSummary } from "@/lib/examStatus"

/** 試験一覧の名前セルの2行目（タグと説明） */
export function ExamRowSummary({ exam }: { exam: ExamSummary }) {
  return (
    <span className="flex flex-wrap items-center gap-1">
      {exam.tags.map((tag) => (
        <Badge
          key={tag.id}
          variant="outline"
          className="text-xs font-normal"
          style={
            tag.color ? { borderColor: tag.color, color: tag.color } : undefined
          }
        >
          {tag.name}
        </Badge>
      ))}
      <span>{exam.description || "説明なし"}</span>
    </span>
  )
}
