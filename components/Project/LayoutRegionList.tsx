"use client"

import { ScrollArea } from "@/components/ui/scroll-area"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Prisma, AreaType } from "@prisma/client"

type LayoutRegionListProps = {
  areas: (Omit<
    Prisma.LayoutRegionCreateWithoutProjectLayoutInput,
    "masterImage"
  > & { id?: string; masterImageId: string })[]
  selectedAreaIndex: number | null
  onSelectArea: (index: number) => void
  disabled: boolean
}

const LayoutRegionList = ({
  areas,
  selectedAreaIndex,
  onSelectArea,
  disabled,
}: LayoutRegionListProps) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>エリア一覧</CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[300px]">
          {areas.length === 0 && (
            <p className="text-muted-foreground text-sm">
              エリアがありません。画像上をドラッグするか、下のボタンから追加してください。
            </p>
          )}
          <div className="space-y-2">
            {areas.map((area, index) => (
              <Button
                key={area.id || `new-${index}`}
                variant={selectedAreaIndex === index ? "default" : "outline"}
                onClick={() => onSelectArea(index)}
                className="w-full justify-start"
                disabled={disabled}
              >
                {area.label || `エリア ${index + 1}`} ({area.type})
              </Button>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  )
}

export default LayoutRegionList
