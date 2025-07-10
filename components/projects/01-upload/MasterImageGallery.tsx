"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area"
import { Prisma } from "@prisma/client"
import { ArrowLeft, ArrowRight, Loader2, Trash2 } from "lucide-react"
import Image from "next/image"
import React from "react"

type MasterImage = Prisma.MasterImageGetPayload<{}>

interface MasterImageGalleryProps {
  images: MasterImage[]
  imageUrls: Record<string, string>
  isDeleting: Record<string, boolean>
  isMoving: boolean
  onDeleteImage: (imageId: string) => void
  onMoveImage: (fromIndex: number, direction: "left" | "right") => void
}

const MasterImageGallery = React.memo(
  ({
    images,
    imageUrls,
    isDeleting,
    isMoving,
    onDeleteImage,
    onMoveImage,
  }: MasterImageGalleryProps) => {
    if (images.length === 0) {
      return null
    }

    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>模範解答 ({images.length}ページ)</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="w-full rounded-md border whitespace-nowrap">
            <div className="flex space-x-4 p-4">
              {images.map((image, index) => {
                const imageUrl = imageUrls[image.id]
                const currentImageIsDeleting = isDeleting[image.id]

                return imageUrl ? (
                  <MasterImageCard
                    key={image.id}
                    image={image}
                    imageUrl={imageUrl}
                    index={index}
                    totalImages={images.length}
                    isDeleting={currentImageIsDeleting}
                    isMoving={isMoving}
                    onDelete={() => onDeleteImage(image.id)}
                    onMoveLeft={() => onMoveImage(index, "left")}
                    onMoveRight={() => onMoveImage(index, "right")}
                  />
                ) : (
                  <div
                    key={image.id}
                    className="group relative flex h-48 w-40 shrink-0 items-center justify-center overflow-hidden rounded-md border"
                  >
                    <p className="text-muted-foreground text-xs">
                      画像準備中...
                    </p>
                  </div>
                )
              })}
            </div>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        </CardContent>
      </Card>
    )
  },
)

interface MasterImageCardProps {
  image: MasterImage
  imageUrl: string
  index: number
  totalImages: number
  isDeleting: boolean
  isMoving: boolean
  onDelete: () => void
  onMoveLeft: () => void
  onMoveRight: () => void
}

const MasterImageCard = React.memo(
  ({
    image,
    imageUrl,
    index,
    totalImages,
    isDeleting,
    isMoving,
    onDelete,
    onMoveLeft,
    onMoveRight,
  }: MasterImageCardProps) => {
    const canMoveLeft = index > 0
    const canMoveRight = index < totalImages - 1
    const isDisabled = isDeleting || isMoving

    return (
      <div className="group relative flex h-48 w-40 shrink-0 overflow-hidden rounded-md border">
        <Image
          src={imageUrl}
          alt={`ページ ${image.pageNumber}`}
          className="h-full w-full object-cover"
          width={160}
          height={192}
          unoptimized
          onError={(e) => {
            e.currentTarget.alt = `画像読込エラー: ${image.path}`
            console.error(
              "Failed to load image:",
              image.path,
              "using URL:",
              imageUrl,
            )
          }}
        />

        {/* Loading overlay */}
        {(isDeleting || (isMoving && !isDeleting)) && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/30">
            <Loader2 className="h-8 w-8 animate-spin text-white" />
          </div>
        )}

        {/* Controls overlay */}
        <div
          className={`absolute inset-0 flex flex-col items-center justify-center bg-black/50 ${
            isDisabled
              ? "opacity-0"
              : "opacity-0 transition-opacity group-hover:opacity-100"
          }`}
        >
          <p className="text-sm font-semibold text-white">
            ページ {image.pageNumber}
          </p>
          <div className="mt-2 flex space-x-1">
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7 text-white hover:bg-white/20"
              onClick={onMoveLeft}
              disabled={!canMoveLeft || isDisabled}
              title="左へ移動"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant="destructive"
              className="h-7 w-7"
              onClick={onDelete}
              disabled={isDisabled}
              title="削除"
            >
              {isDeleting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7 text-white hover:bg-white/20"
              onClick={onMoveRight}
              disabled={!canMoveRight || isDisabled}
              title="右へ移動"
            >
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    )
  },
)

MasterImageCard.displayName = "MasterImageCard"
MasterImageGallery.displayName = "MasterImageGallery"

export default MasterImageGallery
