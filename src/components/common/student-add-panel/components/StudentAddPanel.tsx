"use client"

import { Plus, Search, UserPlus } from "lucide-react"

import { SortableClassroomList } from "@/components/common/student-add-panel/components/SortableClassroomList"
import { StudentCandidateCard } from "@/components/common/student-add-panel/components/StudentCandidateCard"
import { useStudentAddPanel } from "@/components/common/student-add-panel/hooks/useStudentAddPanel"
import type { StudentAddPanelProps } from "@/components/common/student-add-panel/types"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

/**
 * 共通「生徒追加パネル」
 *
 * 学級まるごと追加（複数選択＋順序）と個別追加（検索・選択）を1画面のタブで両立。
 * 各タブに在籍スイッチ（既定ON）を持ち、host は adapter で exam/grade の処理を差し込む。
 */
export function StudentAddPanel({
  adapter,
  onAdded,
  classroomActiveOnlyDefault = true,
  studentActiveOnlyDefault = true,
  fillHeight = false,
}: StudentAddPanelProps) {
  const {
    activeTab,
    setActiveTab,
    classrooms,
    selectedClassrooms,
    listedStudents,
    selectedStudentsOutsideList,
    searchTerm,
    setSearchTerm,
    filterClassroomId,
    setFilterClassroomId,
    classroomActiveOnly,
    setClassroomActiveOnly,
    studentActiveOnly,
    setStudentActiveOnly,
    loadingClassrooms,
    loadingStudents,
    isAdding,
    classroomEmptyReason,
    studentEmptyReason,
    selectedClassroomCount,
    selectedStudentCount,
    handleClassroomSelection,
    handleClassroomReorder,
    handleStudentSelection,
    handleAddClassrooms,
    handleAddStudents,
  } = useStudentAddPanel({
    adapter,
    onAdded,
    classroomActiveOnlyDefault,
    studentActiveOnlyDefault,
  })

  // 学級候補が空のときの理由別メッセージ（スイッチ状態で文言を変える）
  const classroomEmptyMessage = (() => {
    switch (classroomEmptyReason) {
      case "noStudents":
        return "生徒が登録されていません。先に「生徒」ページで生徒を登録してください。"
      case "noClassroomMembership":
        return "学級に所属している生徒がいません。「個別で追加」タブから追加できます。"
      case "noCurrentInClassroom":
        return "在籍中の生徒がいる学級がありません。スイッチをオフにすると、現在在籍していない生徒も表示できます。"
      case "allAdded":
        return classroomActiveOnly
          ? "在籍中の生徒は全て追加しました。"
          : "学級に所属する生徒は全て追加しました。"
      default:
        return "追加可能な学級がありません"
    }
  })()

  /** 個別タブの絞り込みが入っているか（検索語・学級プルダウンは同じ扱い） */
  const hasStudentFilter = searchTerm !== "" || filterClassroomId !== "all"

  // 生徒候補が空のときの理由別メッセージ（スイッチ状態で文言を変える）
  const studentEmptyMessage = (() => {
    if (hasStudentFilter) {
      return "該当する生徒が見つかりません"
    }
    switch (studentEmptyReason) {
      case "noStudents":
        return "生徒が登録されていません。先に「生徒」ページで生徒を登録してください。"
      case "noCurrentEnrollment":
        return "未在籍・在籍中の生徒がいません。スイッチをオフにすると、現在在籍していない生徒も表示できます。"
      case "allAdded":
        return studentActiveOnly
          ? "未在籍・在籍中の生徒は全て追加しました。"
          : "すべての生徒を追加しました。"
      default:
        return "該当する生徒が見つかりません"
    }
  })()

  // fillHeight 時はタブ・カードを親の高さいっぱいに広げ、リストを内部スクロールにする
  const tabsClass = fillHeight ? "flex h-full w-full flex-col" : "w-full"
  const tabsContentClass = fillHeight
    ? "mt-4 flex min-h-0 flex-1 flex-col space-y-4"
    : "mt-4 space-y-4"
  const listCardClass = fillHeight ? "flex min-h-0 flex-col" : ""
  const classListContentClass = fillHeight
    ? "min-h-0 flex-1 space-y-3 overflow-auto"
    : "max-h-80 space-y-3 overflow-auto"
  const reorderContentClass = fillHeight
    ? "min-h-0 flex-1 overflow-auto"
    : "max-h-80 overflow-auto"
  const studentListContentClass = fillHeight
    ? "min-h-0 flex-1 overflow-auto"
    : "max-h-96 overflow-auto"

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className={tabsClass}>
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="classrooms">学級で追加</TabsTrigger>
        <TabsTrigger value="individuals">個別で追加</TabsTrigger>
      </TabsList>

      {/* 学級で追加 */}
      <TabsContent value="classrooms" className={tabsContentClass}>
        <label className="flex w-fit cursor-pointer items-center gap-2 text-sm">
          <Switch
            checked={classroomActiveOnly}
            onCheckedChange={setClassroomActiveOnly}
          />
          <span>在籍中の生徒のみ表示</span>
          <span className="text-xs text-muted-foreground">
            （オフにすると現在在籍していない生徒も表示します）
          </span>
        </label>

        <div
          className={`grid grid-cols-1 gap-4 lg:grid-cols-2 ${
            fillHeight ? "min-h-0 flex-1" : ""
          }`}
        >
          {/* 利用可能な学級一覧 */}
          <Card className={listCardClass}>
            <CardHeader>
              <CardTitle className="text-lg">利用可能な学級</CardTitle>
              <CardDescription>
                追加したい学級を選択してください
              </CardDescription>
            </CardHeader>
            <CardContent className={classListContentClass}>
              {loadingClassrooms ? (
                <div className="py-4 text-center">読み込み中...</div>
              ) : classrooms.length === 0 ? (
                <div className="py-4 text-center text-muted-foreground">
                  {classroomEmptyMessage}
                </div>
              ) : (
                classrooms.map((candidate) => {
                  const addableCountBadge = (
                    <Badge variant="outline">
                      {candidate.addableStudents.length}名
                    </Badge>
                  )
                  return (
                    <Card key={candidate.classroom.id} className="p-3">
                      <div className="flex items-center space-x-3">
                        <Checkbox
                          id={`add-class-${candidate.classroom.id}`}
                          checked={candidate.isSelected}
                          onCheckedChange={(checked) =>
                            handleClassroomSelection(
                              candidate.classroom.id,
                              checked === true
                            )
                          }
                        />
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <label
                              htmlFor={`add-class-${candidate.classroom.id}`}
                              className="cursor-pointer font-medium"
                            >
                              {candidate.classroom.name}
                            </label>
                            {/* 0名（在籍スイッチで候補から消えたが選択は残っている学級）は
                                並べる氏名が無いので、空のツールチップを出さない */}
                            {candidate.addableStudents.length === 0 ? (
                              addableCountBadge
                            ) : (
                              <TooltipProvider delayDuration={150}>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    {addableCountBadge}
                                  </TooltipTrigger>
                                  <TooltipContent
                                    side="left"
                                    className="max-h-64 max-w-xs overflow-auto whitespace-pre-line"
                                  >
                                    {candidate.addableStudents
                                      .map(
                                        (student) =>
                                          `${student.lastName} ${student.firstName}`
                                      )
                                      .join("\n")}
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            )}
                          </div>
                        </div>
                      </div>
                    </Card>
                  )
                })
              )}
            </CardContent>
          </Card>

          {/* 追加順序 */}
          <Card className={listCardClass}>
            <CardHeader>
              <CardTitle className="text-lg">追加順序</CardTitle>
              <CardDescription>
                選択した学級の追加順序を設定できます
              </CardDescription>
            </CardHeader>
            <CardContent className={reorderContentClass}>
              <SortableClassroomList
                selectedClassrooms={selectedClassrooms}
                onReorder={handleClassroomReorder}
              />
            </CardContent>
          </Card>
        </div>

        <div className="flex justify-end">
          <Button
            onClick={handleAddClassrooms}
            disabled={selectedClassroomCount === 0 || isAdding}
          >
            <Plus className="mr-2 h-4 w-4" />
            {isAdding
              ? "追加中..."
              : `選択した学級を追加 (${selectedClassroomCount}学級)`}
          </Button>
        </div>
      </TabsContent>

      {/* 個別で追加 */}
      <TabsContent value="individuals" className="mt-4 space-y-4">
        <label className="flex w-fit cursor-pointer items-center gap-2 text-sm">
          <Switch
            checked={studentActiveOnly}
            onCheckedChange={setStudentActiveOnly}
          />
          <span>未在籍・在籍中の生徒のみ表示</span>
          <span className="text-xs text-muted-foreground">
            （オフにすると過去に在籍した生徒も表示します）
          </span>
        </label>

        <Card className={fillHeight ? "flex min-h-0 flex-1 flex-col" : ""}>
          <CardHeader>
            {/* 数は見出しに置かない（何を数えた N なのかが曖昧になる）。
                段ごとの見出しへ「該当 N名」「選択中 N名」として付ける */}
            <CardTitle className="text-lg">生徒を選ぶ</CardTitle>
            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="relative">
                <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 transform text-muted-foreground" />
                <Input
                  placeholder="名前、ふりがな、学籍番号で検索"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select
                value={filterClassroomId}
                onValueChange={setFilterClassroomId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="学級フィルタ" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">すべての学級</SelectItem>
                  {classrooms.map((candidate) => (
                    <SelectItem
                      key={candidate.classroom.id}
                      value={candidate.classroom.id}
                    >
                      {candidate.classroom.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent className={studentListContentClass}>
            {loadingStudents ? (
              <div className="py-4 text-center">読み込み中...</div>
            ) : (
              <div className="space-y-4">
                {listedStudents.length === 0 ? (
                  <div className="py-4 text-center text-muted-foreground">
                    {studentEmptyMessage}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {/* 絞り込みが入っていないときは段が1つなので「N名」とだけ出す */}
                    <div className="text-sm font-medium text-muted-foreground">
                      {hasStudentFilter ? "該当 " : ""}
                      {listedStudents.length}名
                    </div>
                    {listedStudents.map((student) => (
                      <StudentCandidateCard
                        key={student.id}
                        student={student}
                        onSelectionChange={handleStudentSelection}
                      />
                    ))}
                  </div>
                )}

                {/* 上段から外れた選択済みの生徒（絞り込みに一致しない・在籍スイッチで
                    候補から消えた）。追加も件数も選択そのものから作るので、ここに
                    出しておかないと「見ていないものが入る」「外せない選択が残る」。
                    上段に全員が出ているときは、この段は現れない */}
                {selectedStudentsOutsideList.length > 0 && (
                  <div className="space-y-2 border-t pt-4">
                    <div className="text-sm font-medium text-muted-foreground">
                      選択中 {selectedStudentsOutsideList.length}名
                    </div>
                    {selectedStudentsOutsideList.map((student) => (
                      <StudentCandidateCard
                        key={student.id}
                        student={student}
                        onSelectionChange={handleStudentSelection}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button
            onClick={handleAddStudents}
            disabled={selectedStudentCount === 0 || isAdding}
          >
            <UserPlus className="mr-2 h-4 w-4" />
            {isAdding
              ? "追加中..."
              : `選択した生徒を追加 (${selectedStudentCount}名)`}
          </Button>
        </div>
      </TabsContent>
    </Tabs>
  )
}
