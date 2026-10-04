import { Check, ChevronRight } from "lucide-react"

import { GuardedLink } from "@/components/common/GuardedLink"
import type { WorkflowTab } from "@/components/common/WorkflowTabHeader"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import type { WorkflowPhaseGroup } from "@/lib/workflowTabs"

/**
 * 段カードの足元（「次へ」・「n/m 完了」・「前の段の完了を待機中」）の1行。
 *
 * **3態とも同じ高さにする。** ボタンだけ背が高いと、横に並べたときカードごとに
 * 区切り線の下の厚みが変わり、下端が揃わない。
 */
const FOOTER_ROW_CLASSES =
  "flex h-7 items-center justify-center text-center text-sm"

interface WorkflowPhaseCardProps {
  phase: WorkflowPhaseGroup
  tabs: readonly WorkflowTab[]
  entityHref: string
  stepCompletion: Record<string, boolean | null>
  stepCanStart: Record<string, boolean>
}

/** 段の名前とアイコンの色。済み＝緑／着手できる＝青／まだ＝灰 */
function stepTextColor(isCompleted: boolean | null, canStart: boolean): string {
  if (isCompleted) return "text-green-600"
  if (canStart) return "text-blue-600"
  return "text-gray-400"
}

/** 段の行の下地。色の意味は {@link stepTextColor} と同じ */
function stepRowBackground(
  isCompleted: boolean | null,
  canStart: boolean
): string {
  if (isCompleted) return "bg-green-50"
  if (canStart) return "bg-blue-50"
  return "bg-gray-50"
}

/**
 * 段カード1枚。まとまりの見出しの下に、**段が1行ずつ並ぶ**。
 *
 * **行そのものがリンク。** 別に「開く」ボタンを置くと、同じ行き先への口が1枚の
 * カードに2つ出て、しかもボタンの側は行き先を名前で言わない（どの段が開くのか
 * 読めない）。進行中のまとまりにだけ「次へ: 〈段の名前〉」を足す ——これは
 * 「どこから手を付けるか」を名指しするもので、行の複製ではない。
 *
 * **数えるのは判定できる段だけ**（`2/5 完了`）。出力のように材料が無い段しか
 * 無いまとまりでは数そのものを出さない（`0/1` と書くと、何度でもやってよい出力が
 * 「まだやっていない」ことになる）。％にはしない —— 5段のうち2段と言う方が、
 * 40% と言うより残りが見える。
 */
export function WorkflowPhaseCard({
  phase,
  tabs,
  entityHref,
  stepCompletion,
  stepCanStart,
}: WorkflowPhaseCardProps) {
  const steps = phase.stepIds.flatMap((stepId) => {
    const tab = tabs.find((workflowTab) => workflowTab.id === stepId)
    if (!tab) return []
    return [
      {
        tab,
        isCompleted: stepCompletion[stepId] ?? null,
        canStart: stepCanStart[stepId] ?? true,
      },
    ]
  })

  const measurableSteps = steps.filter((step) => step.isCompleted !== null)
  const completedCount = measurableSteps.filter(
    (step) => step.isCompleted === true
  ).length

  /**
   * 済んだと言えるのは、判定できる段が在って、それが全部済んだとき。
   * 判定できる段が1つも無いまとまり（出力）は「済み」という状態を持たない。
   */
  const isCompleted =
    measurableSteps.length > 0 && completedCount === measurableSteps.length
  /** 先頭の段に手を付けられるなら、このまとまりに手を付けられる */
  const canStart = steps[0]?.canStart ?? true
  const isActive = canStart && !isCompleted
  const nextStep = steps.find(
    (step) => step.isCompleted !== true && step.canStart
  )

  return (
    /*
      `Card` の既定は `gap-6 py-6`。見出しの下に `pb-4` を足すと、題と最初の段の
      あいだだけ 40px 空いて理由の分からない隙間になる。段カードは詰める。
    */
    <Card
      className={cn(
        "h-full gap-3 py-4 transition-all",
        isActive
          ? "border-blue-300 shadow-lg"
          : isCompleted
            ? "border-green-300"
            : "border-gray-200"
      )}
    >
      <CardHeader>
        <CardTitle className="flex items-start justify-between gap-2">
          <div>
            <h3 className="text-lg font-semibold">{phase.title}</h3>
            <p className="text-sm font-normal text-gray-600">
              {phase.description}
            </p>
          </div>
        </CardTitle>
      </CardHeader>

      {/*
        足元（区切り線・「n/m 完了」・「次へ」）は**カードの下端へ寄せる。** 段の数は
        まとまりごとに違うので、内容に続けて置くと横に並べたとき区切り線の高さが
        揃わず、3枚がばらばらに見える。
      */}
      <CardContent className="flex flex-1 flex-col gap-4">
        <div className="space-y-2">
          {steps.map((step) => {
            const StepIcon = step.tab.icon
            return (
              <GuardedLink
                key={step.tab.id}
                href={entityHref + step.tab.path}
                className={cn(
                  "block rounded-lg p-3 transition-all hover:shadow-sm",
                  stepRowBackground(step.isCompleted, step.canStart)
                )}
              >
                <div className="flex items-center justify-between">
                  <div className="flex flex-1 items-center gap-3">
                    <div
                      className={stepTextColor(step.isCompleted, step.canStart)}
                      aria-hidden
                    >
                      {step.isCompleted ? (
                        <div className="flex h-5 w-5 items-center justify-center rounded-full bg-green-500">
                          <Check className="h-3 w-3 text-white" />
                        </div>
                      ) : (
                        <StepIcon className="h-4 w-4" />
                      )}
                    </div>
                    <div className="flex-1">
                      <h4
                        className={cn(
                          "text-sm font-medium",
                          stepTextColor(step.isCompleted, step.canStart)
                        )}
                      >
                        {step.tab.title}
                      </h4>
                      <p className="mt-1 text-xs text-gray-600">
                        {step.tab.description}
                      </p>
                    </div>
                  </div>
                  <ChevronRight
                    className="ml-2 h-4 w-4 shrink-0 text-gray-400"
                    aria-hidden
                  />
                </div>
              </GuardedLink>
            )
          })}
        </div>

        {/*
          足元の3態は**同じ高さ**にする。ボタンだけ背が高いと、横に並べたとき
          カードごとに区切り線の下の厚みが変わって、下端が揃わない。
        */}
        {isActive && nextStep && (
          <div className="mt-auto border-t pt-4">
            <Button className={cn(FOOTER_ROW_CLASSES, "w-full")} asChild>
              <GuardedLink href={entityHref + nextStep.tab.path}>
                次へ: {nextStep.tab.title}
              </GuardedLink>
            </Button>
          </div>
        )}

        {isCompleted && (
          <div className="mt-auto border-t pt-4">
            <p
              className={cn(
                FOOTER_ROW_CLASSES,
                "gap-1 font-medium text-green-600"
              )}
            >
              <Check className="h-4 w-4" aria-hidden />
              {completedCount}/{measurableSteps.length} 完了
            </p>
          </div>
        )}

        {!isActive && !isCompleted && !canStart && (
          <div className="mt-auto border-t pt-4">
            <p className={cn(FOOTER_ROW_CLASSES, "font-medium text-gray-500")}>
              前の段の完了を待機中
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
