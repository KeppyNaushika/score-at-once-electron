"use client"

import React from "react"

interface PageHeaderProps {
  title: string
  subtitle?: React.ReactNode
  children?: React.ReactNode
  helpButton?: React.ReactNode
}

export default function PageHeader({
  title,
  subtitle,
  children,
  helpButton,
}: PageHeaderProps) {
  return (
    <div className="bg-background border-b px-6 py-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <div>
            <h1 className="text-xl font-semibold">{title}</h1>
            {subtitle && (
              <div className="text-muted-foreground mt-1 flex flex-wrap items-center gap-2 text-sm">
                {subtitle}
              </div>
            )}
          </div>
          {helpButton && <div className="ml-3">{helpButton}</div>}
        </div>
        {children && (
          <div className="flex items-center space-x-2">{children}</div>
        )}
      </div>
    </div>
  )
}
