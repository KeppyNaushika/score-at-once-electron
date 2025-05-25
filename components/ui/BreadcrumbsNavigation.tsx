import React from "react"
import { ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"

interface BreadcrumbStep {
  id: string
  label: string
  isCompleted: boolean
  isDisabled: boolean
}

interface BreadcrumbsNavigationProps {
  steps: BreadcrumbStep[]
  currentStepId: string
  onStepClick: (stepId: string) => void
  className?: string
}

const BreadcrumbsNavigation: React.FC<BreadcrumbsNavigationProps> = ({
  steps,
  currentStepId,
  onStepClick,
  className,
}) => {
  return (
    <nav aria-label="Breadcrumb" className={cn("p-2", className)}>
      <ol className="flex items-center space-x-1 md:space-x-2">
        {steps.map((step, index) => (
          <li key={step.id} className="flex items-center">
            <button
              onClick={() => !step.isDisabled && onStepClick(step.id)}
              disabled={step.isDisabled}
              className={cn(
                "text-sm font-medium",
                currentStepId === step.id
                  ? "text-primary"
                  : step.isCompleted
                    ? "text-foreground hover:text-primary/80"
                    : "text-muted-foreground",
                step.isDisabled && currentStepId !== step.id
                  ? "cursor-not-allowed opacity-50"
                  : "hover:underline",
              )}
              aria-current={currentStepId === step.id ? "page" : undefined}
            >
              {step.label}
            </button>
            {index < steps.length - 1 && (
              <ChevronRight className="text-muted-foreground mx-1 h-4 w-4 shrink-0 md:mx-2" />
            )}
          </li>
        ))}
      </ol>
    </nav>
  )
}

export default BreadcrumbsNavigation
export type { BreadcrumbStep }
