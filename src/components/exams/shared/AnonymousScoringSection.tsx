"use client"

import { useMutation, useQuery } from "@tanstack/react-query"
import { EyeOff } from "lucide-react"

import { Switch } from "@/components/ui/switch"
import { parseExamRole } from "@/lib/shared/examRoles"
import { examDetailQuery } from "@/queries/exam"
import {
  type ExamMemberRow,
  setExamAnonymousScoringEnforcedMutation,
} from "@/queries/userExam"

interface AnonymousScoringSectionProps {
  examId: string
  members: ExamMemberRow[]
  /** 固定を変えられるか（試験のオーナー）。false なら状態だけを見せる */
  canManage: boolean
}

/**
 * 匿名採点を試験として固定する（docs/scoring-scope-and-permissions-design.md §3-5）。
 *
 * 固定すると、オーナー以外は「7. 採点」で生徒の名前・答案の氏名欄・名簿順を見られず、
 * 自分では解除できない。オーナーは採点の確定で名前が要るので対象にならない。
 *
 * **結果出力を許可した採点者がいれば、止めずに伝える。** 結果出力では氏名と得点の対応が
 * 見えるので、匿名性は実質的に無くなる。許可は既定でオンなので、何もしなければこの状態になる。
 */
export function AnonymousScoringSection({
  examId,
  members,
  canManage,
}: AnonymousScoringSectionProps) {
  const { data: exam } = useQuery(examDetailQuery(examId))
  const setEnforced = useMutation(
    setExamAnonymousScoringEnforcedMutation(examId)
  )
  const isEnforced = Boolean(exam?.anonymousScoringEnforced)

  /** 結果出力を許可されている採点者（固定していても氏名と得点の対応が見える） */
  const exportingEditors = members.filter(
    (member) =>
      parseExamRole(member.role) === "EDITOR" && member.canExportResults
  )

  return (
    <div className="mt-4 space-y-2 rounded-md border p-3">
      <div className="flex items-center gap-3">
        <EyeOff className="h-4 w-4 text-muted-foreground" />
        <div className="flex-1">
          <div className="text-sm font-medium">匿名採点を固定する</div>
          <div className="text-xs text-muted-foreground">
            オンの間、オーナー以外は採点の画面で生徒の名前・答案の氏名欄・名簿の順を見られず、自分では解除できません
          </div>
        </div>
        <Switch
          checked={isEnforced}
          onCheckedChange={(checked) => setEnforced.mutate(checked)}
          disabled={!canManage || !exam || setEnforced.isPending}
          aria-label="匿名採点を固定する"
        />
      </div>
      {isEnforced && exportingEditors.length > 0 && (
        <p className="rounded bg-amber-50 px-2 py-1 text-xs text-amber-800">
          結果出力を許可している採点者が{exportingEditors.length}人います（
          {exportingEditors.map((member) => member.user.name).join("、")}
          ）。結果出力では氏名と得点の対応が見えるので、この人たちには匿名になりません。
          {canManage && "下の一覧の「結果出力」を切ると止められます。"}
        </p>
      )}
    </div>
  )
}
