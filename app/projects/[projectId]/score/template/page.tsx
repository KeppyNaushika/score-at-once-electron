"use client"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select" // Selectコンポーネントをインポート
import { Textarea } from "@/components/ui/textarea"
import {
  SaveProjectLayoutInput,
  ProjectLayoutWithDetails as GlobalProjectLayoutWithDetails,
} from "@/electron-src/lib/prisma/project" // SaveProjectTemplateInput を SaveProjectLayoutInput に変更, 型名を変更
import {
  MasterImage,
  Prisma,
  AreaType, // Enum名はそのまま
  User,
  Project, // Project型をインポート
} from "@prisma/client"
import { useParams, useRouter } from "next/navigation"
import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"

type ProjectLayoutWithRelations = GlobalProjectLayoutWithDetails // ExamTemplateWithRelations を ProjectLayoutWithRelations に変更

// GUIエディタコンポーネントのプレースホルダー
const LayoutRegionEditor = ({
  // TemplateAreaEditor を LayoutRegionEditor に変更
  areas,
  setAreas,
  disabled,
  backgroundImageUrl,
  imageDimensions,
  masterImageId, // 選択中の masterImageId を受け取る
}: {
  areas: (Omit<
    Prisma.LayoutRegionCreateWithoutProjectLayoutInput, // TemplateAreaCreateInput を LayoutRegionCreateWithoutProjectLayoutInput に変更
    "masterImage" // masterImageId は別途渡す
  > & { id?: string; masterImageId: string })[] // masterImageId を必須にする
  setAreas: Function
  disabled: boolean
  backgroundImageUrl: string | null
  imageDimensions: { width: number; height: number } | null
  masterImageId: string | null // 選択中の masterImageId
}) => {
  const [selectedAreaIndex, setSelectedAreaIndex] = useState<number | null>(
    null,
  )

  const handleAreaChange = (index: number, field: string, value: any) => {
    const newAreas = [...areas]
    if (field === "points" && value !== "") {
      newAreas[index] = { ...newAreas[index], [field]: parseFloat(value) }
    } else if (field === "points" && value === "") {
      newAreas[index] = { ...newAreas[index], [field]: null }
    } else {
      newAreas[index] = { ...newAreas[index], [field]: value }
    }
    setAreas(newAreas)
  }

  const addArea = (type: AreaType) => {
    if (!masterImageId) {
      toast.error("基準画像が選択されていません。エリアを追加できません。")
      return
    }
    // 割合で初期値を設定（例: 左上、小さいサイズ）
    const newAreaBase = {
      x: 0.05, // 5%
      y: 0.05, // 5%
      width: 0.1, // 10%
      height: 0.05, // 5%
      sourceAreaIdsJson: null,
      sourceQuestionNumbersJson: null,
      points: null,
      questionNumber: null,
      label: "",
      masterImageId: masterImageId, // masterImageId を設定
    }

    let newAreaSpecifics = {}
    switch (type) {
      case AreaType.STUDENT_NAME:
        newAreaSpecifics = {
          label: "氏名",
          type: AreaType.STUDENT_NAME,
        }
        break
      case AreaType.STUDENT_ID:
        newAreaSpecifics = {
          label: "生徒番号",
          type: AreaType.STUDENT_ID,
        }
        break
      case AreaType.QUESTION_ANSWER:
        newAreaSpecifics = {
          label: `設問 ${areas.filter((a) => a.type === AreaType.QUESTION_ANSWER).length + 1}`,
          type: AreaType.QUESTION_ANSWER,
          questionNumber: (
            areas.filter((a) => a.type === AreaType.QUESTION_ANSWER).length + 1
          ).toString(),
          points: 10,
        }
        break
      case AreaType.TOTAL_SCORE:
        newAreaSpecifics = {
          label: "合計点",
          type: AreaType.TOTAL_SCORE,
        }
        break
      case AreaType.SUBTOTAL_SCORE:
        newAreaSpecifics = {
          label: "小計",
          type: AreaType.SUBTOTAL_SCORE,
        }
        break
      default:
        newAreaSpecifics = { label: "新規エリア", type: AreaType.OTHER }
    }

    setAreas([...areas, { ...newAreaBase, ...newAreaSpecifics }])
    setSelectedAreaIndex(areas.length) // 新しく追加したエリアを選択状態にする
  }

  const removeArea = (index: number) => {
    setAreas(areas.filter((_, i) => i !== index))
    setSelectedAreaIndex(null)
  }

  const selectedArea =
    selectedAreaIndex !== null ? areas[selectedAreaIndex] : null

  return (
    <div className="grid grid-cols-3 gap-4">
      <div className="relative col-span-2 min-h-[400px] rounded-md border bg-gray-100 p-2">
        {backgroundImageUrl && imageDimensions ? (
          <div
            style={{
              width: "100%",
              height: "100%",
              position: "relative",
              overflow: "auto",
            }}
          >
            <img
              src={backgroundImageUrl}
              alt="模範解答"
              style={{ display: "block", maxWidth: "100%", maxHeight: "100%" }}
            />
            {areas.map((area, index) => (
              <div
                key={area.id || `new-${index}`}
                onClick={() => setSelectedAreaIndex(index)}
                style={{
                  position: "absolute",
                  left: `${area.x * 100}%`, // 割合をパーセントに
                  top: `${area.y * 100}%`,
                  width: `${area.width * 100}%`,
                  height: `${area.height * 100}%`,
                  border: `2px solid ${selectedAreaIndex === index ? "blue" : area.masterImageId === masterImageId ? "red" : "gray"}`, // 選択中、現在の画像上のエリア、他の画像のエリア
                  backgroundColor:
                    area.masterImageId === masterImageId
                      ? "rgba(255, 0, 0, 0.1)"
                      : "rgba(128, 128, 128, 0.1)",
                  cursor: "pointer",
                  boxSizing: "border-box",
                }}
                title={`${area.label || `エリア ${index + 1}`} (画像: ${area.masterImageId === masterImageId ? "現在" : "別"})`}
              >
                <span
                  style={{
                    fontSize: "10px",
                    color: "black",
                    background: "rgba(255,255,255,0.7)",
                    padding: "0 2px",
                  }}
                >
                  {area.label || area.type}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-muted-foreground flex h-full items-center justify-center text-center">
            模範解答画像を読み込んでください。
          </p>
        )}
        {/* ここに実際の描画ツール (Konva, Fabric.jsなど) が入ります */}
      </div>
      <div className="col-span-1 space-y-3">
        <div>
          <Label>エリア追加</Label>
          <div className="mt-1 grid grid-cols-2 gap-2">
            {(Object.keys(AreaType) as Array<keyof typeof AreaType>).map(
              (key) => (
                <Button
                  key={key}
                  onClick={() => addArea(AreaType[key])}
                  variant="outline"
                  size="sm"
                  disabled={disabled || !backgroundImageUrl || !masterImageId} // masterImageId もチェック
                >
                  {AreaType[key]}
                </Button>
              ),
            )}
          </div>
        </div>
        {selectedArea && selectedAreaIndex !== null && (
          <Card>
            <CardHeader>
              <CardTitle>
                エリア編集:{" "}
                {selectedArea.label || `エリア ${selectedAreaIndex + 1}`}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label htmlFor={`area-type-${selectedAreaIndex}`}>種類</Label>
                <Select
                  value={selectedArea.type}
                  onValueChange={(value) =>
                    handleAreaChange(
                      selectedAreaIndex,
                      "type",
                      value as AreaType,
                    )
                  }
                  disabled={disabled}
                >
                  <SelectTrigger id={`area-type-${selectedAreaIndex}`}>
                    <SelectValue placeholder="種類を選択" />
                  </SelectTrigger>
                  <SelectContent>
                    {(
                      Object.keys(AreaType) as Array<keyof typeof AreaType>
                    ).map((key) => (
                      <SelectItem key={key} value={AreaType[key]}>
                        {AreaType[key]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor={`area-label-${selectedAreaIndex}`}>
                  ラベル
                </Label>
                <Input
                  id={`area-label-${selectedAreaIndex}`}
                  value={selectedArea.label || ""}
                  onChange={(e) =>
                    handleAreaChange(selectedAreaIndex, "label", e.target.value)
                  }
                  disabled={disabled}
                />
              </div>
              <div>
                <Label htmlFor={`area-masterImageId-${selectedAreaIndex}`}>
                  紐づく画像ID (読取専用)
                </Label>
                <Input
                  id={`area-masterImageId-${selectedAreaIndex}`}
                  value={selectedArea.masterImageId}
                  disabled // 通常は変更させない
                  readOnly
                />
              </div>
              {selectedArea.type === AreaType.QUESTION_ANSWER && (
                <>
                  <div>
                    <Label htmlFor={`area-qnum-${selectedAreaIndex}`}>
                      設問番号
                    </Label>
                    <Input
                      id={`area-qnum-${selectedAreaIndex}`}
                      value={selectedArea.questionNumber || ""}
                      onChange={(e) =>
                        handleAreaChange(
                          selectedAreaIndex,
                          "questionNumber",
                          e.target.value,
                        )
                      }
                      disabled={disabled}
                    />
                  </div>
                  <div>
                    <Label htmlFor={`area-points-${selectedAreaIndex}`}>
                      配点
                    </Label>
                    <Input
                      id={`area-points-${selectedAreaIndex}`}
                      type="number"
                      value={
                        selectedArea.points === null ||
                        selectedArea.points === undefined
                          ? ""
                          : selectedArea.points
                      }
                      onChange={(e) =>
                        handleAreaChange(
                          selectedAreaIndex,
                          "points",
                          e.target.value,
                        )
                      }
                      disabled={disabled}
                    />
                  </div>
                </>
              )}
              {(selectedArea.type === AreaType.SUBTOTAL_SCORE ||
                selectedArea.type === AreaType.TOTAL_SCORE) && (
                <div>
                  <Label htmlFor={`area-src-qnums-${selectedAreaIndex}`}>
                    集計対象の設問番号 (JSON)
                  </Label>
                  <Textarea
                    id={`area-src-qnums-${selectedAreaIndex}`}
                    value={selectedArea.sourceQuestionNumbersJson || ""}
                    onChange={(e) =>
                      handleAreaChange(
                        selectedAreaIndex,
                        "sourceQuestionNumbersJson",
                        e.target.value,
                      )
                    }
                    placeholder='例: ["1", "2a", "3"]'
                    disabled={disabled}
                    rows={2}
                    className="text-xs"
                  />
                </div>
              )}
              <p className="text-muted-foreground text-xs">
                X: {selectedArea.x.toFixed(3)}, Y: {selectedArea.y.toFixed(3)},
                W: {selectedArea.width.toFixed(3)}, H:{" "}
                {selectedArea.height.toFixed(3)}
              </p>
              <Button
                onClick={() => removeArea(selectedAreaIndex)}
                variant="destructive"
                size="sm"
                disabled={disabled}
              >
                このエリアを削除
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}

export default function TemplateStepPage() {
  const params = useParams()
  const router = useRouter()

  const paramsProjectId = params.projectId
  const projectId =
    typeof paramsProjectId === "string" ? paramsProjectId : paramsProjectId?.[0]

  const [project, setProject] = useState<Project | null>(null) // プロジェクト情報を保持
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [layoutId, setLayoutId] = useState<string | undefined>(undefined) // templateId を layoutId に変更
  // templateName, templateDescription は ProjectLayout から削除されたため不要
  const [layoutRegions, setLayoutRegions] = useState<
    // templateAreas を layoutRegions に変更
    (Omit<Prisma.LayoutRegionCreateWithoutProjectLayoutInput, "masterImage"> & {
      id?: string
      masterImageId: string
    })[] // 型名を変更し、masterImageId を必須に
  >([])

  const [masterImages, setMasterImages] = useState<MasterImage[]>([]) // 模範解答画像のリスト
  const [selectedMasterImage, setSelectedMasterImage] =
    useState<MasterImage | null>(null) // 選択中の模範解答画像
  const [backgroundImageUrl, setBackgroundImageUrl] = useState<string | null>(
    null,
  ) // 背景画像のURL
  const [imageDimensions, setImageDimensions] = useState<{
    width: number
    height: number
  } | null>(null)

  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  const loadInitialData = useCallback(async () => {
    if (!projectId) {
      toast.error("プロジェクトIDが見つかりません。")
      setIsLoading(false)
      return
    }
    setIsLoading(true)
    try {
      const user = await window.electronAPI.getCurrentUser()
      setCurrentUser(user)

      const fetchedProject =
        await window.electronAPI.fetchProjectById(projectId) // fetchProjectById の戻り値は ProjectWithDetails | null
      if (fetchedProject) {
        setProject(fetchedProject) // プロジェクト情報をセット
        if (
          fetchedProject.masterImages &&
          fetchedProject.masterImages.length > 0
        ) {
          const sortedMasterImages = [...fetchedProject.masterImages].sort(
            (a, b) => a.pageNumber - b.pageNumber,
          )
          setMasterImages(sortedMasterImages)
          setSelectedMasterImage(sortedMasterImages[0])
          const url = await window.electronAPI.resolveFileProtocolPath(
            sortedMasterImages[0].path,
          )
          setBackgroundImageUrl(url)
          const img = new Image()
          img.onload = () => {
            setImageDimensions({
              width: img.naturalWidth,
              height: img.naturalHeight,
            })
          }
          img.src = url
        } else {
          setMasterImages([])
          setSelectedMasterImage(null)
          setBackgroundImageUrl(null)
          setImageDimensions(null)
        }

        // ProjectLayout は projectId で取得
        const layout =
          await window.electronAPI.fetchProjectLayoutByProjectId(projectId)
        if (layout) {
          setLayoutId(layout.id)
          // name, description は layout にないのでセットしない
          setLayoutRegions(
            layout.areas.map((area) => {
              const { projectLayoutId, createdAt, updatedAt, ...rest } = area // examTemplateId を projectLayoutId に変更
              return rest
            }),
          )
        } else {
          // レイアウトが存在しない場合、新規作成の準備
          setLayoutId(undefined)
          setLayoutRegions([])
        }
      } else {
        toast.error("プロジェクトが見つかりません。")
        setProject(null)
        setMasterImages([])
        setSelectedMasterImage(null)
        setBackgroundImageUrl(null)
        setImageDimensions(null)
        setLayoutRegions([])
      }
    } catch (error) {
      console.error("Failed to load initial data:", error)
      toast.error("初期データの読み込みに失敗しました。")
    } finally {
      setIsLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    loadInitialData()
  }, [loadInitialData])

  const handleMasterImageChange = async (imageId: string) => {
    const image = masterImages.find((img) => img.id === imageId)
    if (image) {
      setSelectedMasterImage(image)
      try {
        const url = await window.electronAPI.resolveFileProtocolPath(image.path)
        setBackgroundImageUrl(url)
        const img = new Image()
        img.onload = () => {
          setImageDimensions({
            width: img.naturalWidth,
            height: img.naturalHeight,
          })
        }
        img.src = url
      } catch (error) {
        toast.error("背景画像の読み込みに失敗しました。")
        setBackgroundImageUrl(null)
        setImageDimensions(null)
      }
    }
  }

  const handleSaveTemplate = async () => {
    // 関数名はそのまま (UI上のラベルと合わせるため) だが、内部処理は ProjectLayout
    if (!projectId || !currentUser || !selectedMasterImage) {
      // selectedMasterImage もチェック
      toast.error("プロジェクトID、ユーザー情報、基準画像は必須です。")
      return
    }

    setIsSaving(true)

    const payload: SaveProjectLayoutInput = {
      // name, description は削除
      projectId: projectId,
      createdById: currentUser.id,
      areas: layoutRegions.map((area) => {
        // templateAreas を layoutRegions に変更
        const { id, ...restOfArea } = area
        if (!area.masterImageId) {
          // masterImageId の存在を再確認
          throw new Error(
            `Layout region ${area.label || "Unnamed"} is missing masterImageId.`,
          )
        }
        return {
          id: id,
          ...restOfArea,
        }
      }),
    }

    if (layoutId) {
      // templateId を layoutId に変更
      payload.id = layoutId // 更新の場合はIDを設定
    }

    try {
      const savedLayout = await window.electronAPI.saveProjectLayout(payload) // savedTemplate を savedLayout に変更 // saveProjectTemplate を saveProjectLayout に変更
      setLayoutId(savedLayout.id) // templateId を layoutId に変更
      // name, description は layout にないのでセットしない
      setLayoutRegions(
        // templateAreas を layoutRegions に変更
        savedLayout.areas.map((area) => {
          const { projectLayoutId, createdAt, updatedAt, ...rest } = area // examTemplateId を projectLayoutId に変更
          return rest
        }),
      )
      toast.success(`レイアウトを保存しました。`) // メッセージ変更
    } catch (error) {
      console.error("Failed to save layout:", error) // メッセージ変更
      toast.error("レイアウトの保存に失敗しました。") // メッセージ変更
    } finally {
      setIsSaving(false)
    }
  }

  const goToNextStep = () => {
    if (!layoutId) {
      // templateId を layoutId に変更
      toast.error(
        "レイアウトが保存されていません。まずレイアウトを保存してください。", // メッセージ変更
      )
      return
    }
    alert("次のステップ（解答用紙アップロード）へ進みます。 (未実装)")
  }
  const goToPreviousStep = () => {
    router.push(`/projects/${projectId}/score`)
  }

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <p>テンプレート情報を読み込み中...</p>
      </div>
    )
  }
  if (!projectId) {
    return (
      <div className="flex h-full items-center justify-center">
        <p>プロジェクト情報がありません。</p>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-4">
      <h2 className="mb-6 text-2xl font-semibold">
        ステップ2: レイアウト領域の作成・編集 {/* ラベル変更 */}
      </h2>
      <Card>
        <CardHeader>
          <CardTitle>
            {layoutId ? "レイアウト編集" : "新規レイアウト作成"}{" "}
            {/* ラベル変更 */}
          </CardTitle>
          <CardDescription>
            プロジェクト「{project?.examName || projectId}
            」のレイアウト領域を設定します。 {/* プロジェクト名表示 */}
            {masterImages.length > 0 && (
              <div className="mt-2">
                <Label htmlFor="master-image-select">基準画像選択:</Label>
                <Select
                  value={selectedMasterImage?.id || ""}
                  onValueChange={handleMasterImageChange}
                  disabled={isLoading || isSaving}
                >
                  <SelectTrigger
                    id="master-image-select"
                    className="mt-1 w-[280px]"
                  >
                    <SelectValue placeholder="模範解答画像を選択" />
                  </SelectTrigger>
                  <SelectContent>
                    {masterImages.map((img) => (
                      <SelectItem key={img.id} value={img.id}>
                        ページ {img.pageNumber} ({img.path.split(/[/\\]/).pop()}
                        )
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* templateName と templateDescription の入力フィールドは削除 */}

          <div className="space-y-2">
            <Label>レイアウト領域定義</Label> {/* ラベル変更 */}
            <LayoutRegionEditor // TemplateAreaEditor を LayoutRegionEditor に変更
              areas={layoutRegions} // templateAreas を layoutRegions に変更
              setAreas={setLayoutRegions} // setTemplateAreas を setLayoutRegions に変更
              disabled={isSaving}
              backgroundImageUrl={backgroundImageUrl}
              imageDimensions={imageDimensions}
              masterImageId={selectedMasterImage?.id || null} // masterImageId を渡す
            />
            <p className="text-muted-foreground text-xs">
              模範解答画像上で、採点対象となる各領域（設問、氏名など）を定義します。座標・サイズは画像に対する割合で保存されます。各領域は特定の模範解答画像ページに紐付きます。
            </p>
          </div>
        </CardContent>
        <CardFooter className="flex justify-between">
          <Button
            variant="outline"
            onClick={goToPreviousStep}
            disabled={isSaving}
          >
            前へ: 模範解答設定
          </Button>
          <div className="flex space-x-2">
            <Button
              onClick={handleSaveTemplate}
              disabled={isSaving || isLoading || !selectedMasterImage} // selectedMasterImage もチェック
            >
              {isSaving
                ? "保存中..."
                : layoutId // templateId を layoutId に変更
                  ? "レイアウトを更新" // ラベル変更
                  : "レイアウトを作成"}{" "}
              {/* ラベル変更 */}
            </Button>
            <Button
              onClick={goToNextStep}
              disabled={isSaving || !layoutId || !selectedMasterImage} // templateId を layoutId に変更
            >
              次へ: 解答用紙アップロード
            </Button>
          </div>
        </CardFooter>
      </Card>
    </div>
  )
}
