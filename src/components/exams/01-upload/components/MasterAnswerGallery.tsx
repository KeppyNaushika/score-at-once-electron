"use client"

import type { MasterAnswerGalleryProps } from "@/components/exams/01-upload/types"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area"

import { MasterAnswerCard } from "./MasterAnswerCard"

/**
 * MasterAnswerGallery - 模範解答ページ一覧を表示するコンポーネント
 *
 * 画像が無いページも隠さずに出す。旧バージョンでは「答案が残っているページから
 * 模範解答だけを削除する」ことができ、そのページは一覧に現れないまま残っていた。
 * 出しておけば差し替えるか削除するかを選べる。
 */
export function MasterAnswerGallery({
  answers,
  imageUrls,
  deletingAnswerId,
  replacingAnswerId,
  isMoving,
  onDeleteAnswer,
  onReplaceAnswer,
  onMoveAnswer,
  onPageSizeChange,
}: MasterAnswerGalleryProps) {
  if (answers.length === 0) {
    return null
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>模範解答 ({answers.length}ページ)</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="w-full rounded-md border whitespace-nowrap">
          <div className="flex space-x-4 p-4">
            {answers.map((answer, index) => (
              <MasterAnswerCard
                key={answer.id}
                answer={answer}
                imageUrl={imageUrls[answer.id] ?? ""}
                index={index}
                totalAnswers={answers.length}
                isDeleting={answer.id === deletingAnswerId}
                isReplacing={answer.id === replacingAnswerId}
                isMoving={isMoving}
                onDelete={(confirmedCounts) =>
                  onDeleteAnswer(answer.id, confirmedCounts)
                }
                onReplace={(file) => onReplaceAnswer(answer.id, file)}
                onMoveLeft={() => onMoveAnswer(index, "left")}
                onMoveRight={() => onMoveAnswer(index, "right")}
                onPageSizeChange={(pageSize) =>
                  onPageSizeChange(answer.id, pageSize)
                }
              />
            ))}
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </CardContent>
    </Card>
  )
}
