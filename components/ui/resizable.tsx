"use client"

import { GripVertical } from "lucide-react"
import {
  Group,
  Panel,
  Separator,
  type GroupProps,
  type SeparatorProps,
} from "react-resizable-panels"

import { cn } from "@/lib/utils"

const ResizablePanelGroup = ({ className, ...props }: GroupProps) => (
  <Group
    className={cn("flex h-full w-full", className)}
    style={{ display: "flex", ...props.style }}
    {...props}
  />
)

const ResizablePanel = Panel

const ResizableHandle = ({
  withHandle,
  className,
  ...props
}: SeparatorProps & {
  withHandle?: boolean
}) => (
  <Separator
    className={cn(
      "bg-border hover:bg-primary/20 relative flex w-1 cursor-col-resize items-center justify-center",
      className
    )}
    {...props}
  >
    {withHandle && (
      <div className="bg-border z-10 flex h-6 w-3 items-center justify-center rounded-sm border">
        <GripVertical className="h-3 w-3" />
      </div>
    )}
  </Separator>
)

export { ResizableHandle, ResizablePanel, ResizablePanelGroup }
