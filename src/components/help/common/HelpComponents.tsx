"use client"

import React from "react"

import { Badge } from "@/components/ui/badge"

interface HelpSectionProps {
  icon: React.ReactNode
  title: string
  children: React.ReactNode
  className?: string
}

export function HelpSection({
  icon,
  title,
  children,
  className = "",
}: HelpSectionProps) {
  return (
    <div className={`space-y-3 ${className}`}>
      <div className="flex items-center gap-2">
        {icon}
        <h3 className="text-base font-semibold">{title}</h3>
      </div>
      <div className="space-y-2 pl-7">{children}</div>
    </div>
  )
}

interface StepItemProps {
  number: number
  title: string
  description: string
  isImportant?: boolean
}

export function StepItem({
  number,
  title,
  description,
  isImportant = false,
}: StepItemProps) {
  return (
    <div className="flex gap-3">
      <div
        className={`flex h-7 w-7 items-center justify-center rounded-full text-sm font-semibold ${
          isImportant
            ? "bg-orange-100 text-orange-700"
            : "bg-blue-100 text-blue-700"
        }`}
      >
        {number}
      </div>
      <div className="flex-1">
        <p className="text-sm font-medium">{title}</p>
        <p className="text-muted-foreground text-sm">{description}</p>
      </div>
    </div>
  )
}

interface TipItemProps {
  children: React.ReactNode
  type?: "info" | "warning" | "success"
}

export function TipItem({ children, type = "info" }: TipItemProps) {
  const styles = {
    info: "bg-blue-50 border-blue-200 text-blue-800",
    warning: "bg-orange-50 border-orange-200 text-orange-800",
    success: "bg-green-50 border-green-200 text-green-800",
  }

  return (
    <div className={`rounded-lg border p-3 text-sm ${styles[type]}`}>
      {children}
    </div>
  )
}

export { Badge }
