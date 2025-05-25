import React from "react"

export default function ExamLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <div className="h-full">{children}</div>
}
