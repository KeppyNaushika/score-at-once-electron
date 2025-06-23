"use client"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { AlertCircle, CheckCircle, Info } from "lucide-react"
import React from "react"

interface ValidationResult {
  valid: number
  errors: string[]
  warnings: string[]
}

interface ValidationResultsProps {
  title: string
  icon?: React.ReactNode
  validation: ValidationResult
  validUnit?: string
  maxErrorsShown?: number
  maxWarningsShown?: number
}

export default function ValidationResults({
  title,
  icon = <CheckCircle className="h-4 w-4" />,
  validation,
  validUnit = "件",
  maxErrorsShown = 5,
  maxWarningsShown = 3,
}: ValidationResultsProps) {
  if (
    validation.valid === 0 &&
    validation.errors.length === 0 &&
    validation.warnings.length === 0
  ) {
    return null
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          {icon}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div className="flex items-center gap-4">
            <Badge variant="default" className="flex items-center gap-1">
              <CheckCircle className="h-3 w-3" />
              有効: {validation.valid}
              {validUnit}
            </Badge>
            {validation.errors.length > 0 && (
              <Badge variant="destructive" className="flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                エラー: {validation.errors.length}件
              </Badge>
            )}
            {validation.warnings.length > 0 && (
              <Badge variant="outline" className="flex items-center gap-1">
                <Info className="h-3 w-3" />
                警告: {validation.warnings.length}件
              </Badge>
            )}
          </div>

          {validation.errors.length > 0 && (
            <div>
              <Label className="text-destructive font-medium">エラー</Label>
              <ul className="text-destructive mt-1 space-y-1 text-sm">
                {validation.errors
                  .slice(0, maxErrorsShown)
                  .map((error, index) => (
                    <li key={index}>• {error}</li>
                  ))}
                {validation.errors.length > maxErrorsShown && (
                  <li className="text-muted-foreground">
                    ... 他{validation.errors.length - maxErrorsShown}件
                  </li>
                )}
              </ul>
            </div>
          )}

          {validation.warnings.length > 0 && (
            <div>
              <Label className="font-medium text-amber-600">警告</Label>
              <ul className="mt-1 space-y-1 text-sm text-amber-600">
                {validation.warnings
                  .slice(0, maxWarningsShown)
                  .map((warning, index) => (
                    <li key={index}>• {warning}</li>
                  ))}
                {validation.warnings.length > maxWarningsShown && (
                  <li className="text-muted-foreground">
                    ... 他{validation.warnings.length - maxWarningsShown}件
                  </li>
                )}
              </ul>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
