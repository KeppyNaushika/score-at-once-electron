'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { toast } from 'sonner'
import { Upload, FileImage, Trash2, MoveUp, MoveDown, Eye } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import ProtectedRoute from '@/components/Auth/ProtectedRoute'
import { useDropzone } from 'react-dropzone'

interface MasterImage {
  id: string
  path: string
  pageNumber: number
  createdAt: string
}

interface ProjectData {
  id: string
  examName: string
  description?: string
  masterImages?: MasterImage[]
}

export default function MasterImagesPage() {
  const params = useParams()
  const router = useRouter()
  const { user } = useAuth()
  const projectId = params.projectId as string

  const [project, setProject] = useState<ProjectData | null>(null)
  const [masterImages, setMasterImages] = useState<MasterImage[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isUploading, setIsUploading] = useState(false)
  const [selectedImage, setSelectedImage] = useState<MasterImage | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  const loadProject = async () => {
    if (!projectId) return

    try {
      setIsLoading(true)
      const result = await window.electronAPI.fetchProjectById(projectId)
      
      if (result) {
        setProject(result)
        const sortedImages = (result.masterImages || []).sort((a, b) => a.pageNumber - b.pageNumber)
        setMasterImages(sortedImages)
        if (sortedImages.length > 0 && !selectedImage) {
          setSelectedImage(sortedImages[0])
          loadImagePreview(sortedImages[0])
        }
      } else {
        toast.error('プロジェクトが見つかりません')
        router.push('/dashboard')
      }
    } catch (error) {
      console.error('Error loading project:', error)
      toast.error('プロジェクトの読み込みに失敗しました')
    } finally {
      setIsLoading(false)
    }
  }

  const loadImagePreview = async (image: MasterImage) => {
    try {
      const url = await window.electronAPI.resolveFileProtocolPath(image.path)
      setPreviewUrl(url)
    } catch (error) {
      console.error('Error loading image preview:', error)
      setPreviewUrl(null)
    }
  }

  useEffect(() => {
    loadProject()
  }, [projectId])

  useEffect(() => {
    if (selectedImage) {
      loadImagePreview(selectedImage)
    }
  }, [selectedImage])

  const onDrop = async (acceptedFiles: File[]) => {
    if (!projectId) return

    setIsUploading(true)
    try {
      const filesData = await Promise.all(
        acceptedFiles.map(async (file, index) => {
          const buffer = await file.arrayBuffer()
          return {
            name: file.name,
            type: file.type,
            buffer: buffer,
          }
        })
      )

      const result = await window.electronAPI.uploadMasterImages(projectId, filesData)
      
      if (result) {
        toast.success(`${acceptedFiles.length}枚の模範解答をアップロードしました`)
        await loadProject()
      }
    } catch (error) {
      console.error('Upload failed:', error)
      toast.error('ファイルのアップロードに失敗しました')
    } finally {
      setIsUploading(false)
    }
  }

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.tiff']
    },
    multiple: true,
    disabled: isUploading
  })

  const handleDeleteImage = async (imageId: string) => {
    if (!confirm('この模範解答を削除しますか？')) return

    try {
      await window.electronAPI.deleteMasterImage(imageId)
      toast.success('模範解答を削除しました')
      await loadProject()
      
      if (selectedImage?.id === imageId) {
        const remaining = masterImages.filter(img => img.id !== imageId)
        setSelectedImage(remaining.length > 0 ? remaining[0] : null)
        setPreviewUrl(null)
      }
    } catch (error) {
      console.error('Delete failed:', error)
      toast.error('削除に失敗しました')
    }
  }

  const handleReorderImages = async (imageId: string, direction: 'up' | 'down') => {
    const currentIndex = masterImages.findIndex(img => img.id === imageId)
    if (currentIndex === -1) return

    const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1
    if (newIndex < 0 || newIndex >= masterImages.length) return

    const reorderedImages = [...masterImages]
    const [movedImage] = reorderedImages.splice(currentIndex, 1)
    reorderedImages.splice(newIndex, 0, movedImage)

    // Update page numbers
    const imageOrders = reorderedImages.map((img, index) => ({
      id: img.id,
      pageNumber: index + 1
    }))

    try {
      await window.electronAPI.updateMasterImagesOrder(imageOrders)
      toast.success('ページ順序を更新しました')
      await loadProject()
    } catch (error) {
      console.error('Reorder failed:', error)
      toast.error('順序の更新に失敗しました')
    }
  }

  if (isLoading) {
    return (
      <ProtectedRoute>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
            <p className="mt-4 text-muted-foreground">読み込み中...</p>
          </div>
        </div>
      </ProtectedRoute>
    )
  }

  return (
    <ProtectedRoute>
      <div className="container mx-auto p-6">
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">模範解答アップロード</h1>
              <p className="text-muted-foreground mt-2">
                プロジェクト: {project?.examName}
              </p>
            </div>
            <Button
              variant="outline"
              onClick={() => router.push(`/projects/${projectId}`)}
            >
              プロジェクト詳細に戻る
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Upload Area */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center">
                <Upload className="h-5 w-5 mr-2" />
                ファイルアップロード
              </CardTitle>
              <CardDescription>
                模範解答の画像ファイルをドラッグ&ドロップまたはクリックして選択してください
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div
                {...getRootProps()}
                className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                  isDragActive 
                    ? 'border-primary bg-primary/10' 
                    : 'border-muted-foreground/25 hover:border-primary/50'
                } ${isUploading ? 'pointer-events-none opacity-50' : ''}`}
              >
                <input {...getInputProps()} />
                <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
                  <Upload className="w-8 h-8 text-primary" />
                </div>
                {isUploading ? (
                  <div>
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
                    <p className="text-lg font-medium">アップロード中...</p>
                  </div>
                ) : isDragActive ? (
                  <p className="text-lg font-medium">ファイルをここにドロップしてください</p>
                ) : (
                  <div>
                    <p className="text-lg font-medium mb-2">画像ファイルをアップロード</p>
                    <p className="text-muted-foreground text-sm">
                      PNG, JPG, JPEG, GIF, BMP, TIFF形式に対応
                    </p>
                    <p className="text-muted-foreground text-sm">
                      複数ファイルの同時アップロード可能
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Image List */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <FileImage className="h-5 w-5 mr-2" />
                アップロード済み画像
                <Badge variant="secondary" className="ml-2">
                  {masterImages.length}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {masterImages.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">
                  まだ画像がアップロードされていません
                </p>
              ) : (
                <div className="space-y-2">
                  {masterImages.map((image, index) => (
                    <div
                      key={image.id}
                      className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                        selectedImage?.id === image.id
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:border-primary/50'
                      }`}
                      onClick={() => setSelectedImage(image)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">
                            ページ {image.pageNumber}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            {image.path.split('/').pop()}
                          </p>
                        </div>
                        <div className="flex items-center space-x-1 ml-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleReorderImages(image.id, 'up')
                            }}
                            disabled={index === 0}
                          >
                            <MoveUp className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleReorderImages(image.id, 'down')
                            }}
                            disabled={index === masterImages.length - 1}
                          >
                            <MoveDown className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleDeleteImage(image.id)
                            }}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Preview */}
        {selectedImage && previewUrl && (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="flex items-center">
                <Eye className="h-5 w-5 mr-2" />
                プレビュー: ページ {selectedImage.pageNumber}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex justify-center">
                <img
                  src={previewUrl}
                  alt={`ページ ${selectedImage.pageNumber}`}
                  className="max-w-full max-h-96 object-contain border rounded-lg"
                />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Next Steps */}
        {masterImages.length > 0 && (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>次のステップ</CardTitle>
              <CardDescription>
                模範解答のアップロードが完了しました
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex space-x-4">
                <Button
                  onClick={() => router.push(`/projects/${projectId}/score/template`)}
                  className="flex items-center"
                >
                  <FileImage className="h-4 w-4 mr-2" />
                  採点領域を設定する
                </Button>
                <Button
                  variant="outline"
                  onClick={() => router.push(`/projects/${projectId}/answer-sheets`)}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  答案をアップロードする
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </ProtectedRoute>
  )
}