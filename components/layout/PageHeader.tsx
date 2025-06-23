"use client"

import React from "react"

interface PageHeaderProps {
  title: string
  description: string
  children?: React.ReactNode
}

export default function PageHeader({
  title,
  description,
  children,
}: PageHeaderProps) {
  return (
    <div className="bg-background border-b px-6 py-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">{title}</h1>
          <p className="text-muted-foreground text-sm">{description}</p>
        </div>
        {children && (
          <div className="flex items-center space-x-2">{children}</div>
        )}
      </div>
    </div>
  )
}
