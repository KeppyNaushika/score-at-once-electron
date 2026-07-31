"use client"

import { Plus, Search, UserPlus } from "lucide-react"

import { SortableClassroomList } from "@/components/common/student-add-panel/components/SortableClassroomList"
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
  showClassroomReorder = true,
  classroomActiveOnlyDefault = true,
  studentActiveOnlyDefault = true,
  fillHeight = false,
}: StudentAddPanelProps) {
  const {
    activeTab,
    setActiveTab,
    classrooms,
    selectedClassrooms,
    filteredStudents,
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

  // 生徒候補が空のときの理由別メッセージ（スイッチ状態で文言を変える）
  const studentEmptyMessage = (() => {
    if (searchTerm || filterClassroomId !== "all") {
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
          className={`grid grid-cols-1 gap-4 ${
            showClassroomReorder ? "lg:grid-cols-2" : ""
          } ${fillHeight ? "min-h-0 flex-1" : ""}`}
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
                classrooms.map((classroomItem) => (
                  <Card key={classroomItem.id} className="p-3">
                    <div className="flex items-center space-x-3">
                      <Checkbox
                        id={`add-class-${classroomItem.id}`}
                        checked={classroomItem.isSelected}
                        onCheckedChange={(checked) =>
                          handleClassroomSelection(
                            classroomItem.id,
                            checked === true
                          )
                        }
                      />
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <label
                            htmlFor={`add-class-${classroomItem.id}`}
                            className="cursor-pointer font-medium"
                          >
                            {classroomItem.name}
                          </label>
                          <TooltipProvider delayDuration={150}>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Badge variant="outline">
                                  {classroomItem.studentCount}名
                                </Badge>
                              </TooltipTrigger>
                              <TooltipContent
                                side="left"
                                className="max-h-64 max-w-xs overflow-auto whitespace-pre-line"
                              >
                                {classroomItem.studentNames.join("\n")}
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                      </div>
                    </div>
                  </Card>
                ))
              )}
            </CardContent>
          </Card>

          {/* 追加順序 */}
          {showClassroomReorder && (
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
          )}
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
            <CardTitle className="text-lg">
              利用可能な生徒 ({filteredStudents.length}名)
            </CardTitle>
            <CardDescription>
              追加したい生徒を検索・選択してください
            </CardDescription>
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
                  {classrooms.map((classroom) => (
                    <SelectItem key={classroom.id} value={classroom.id}>
                      {classroom.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent className={studentListContentClass}>
            {loadingStudents ? (
              <div className="py-4 text-center">読み込み中...</div>
            ) : filteredStudents.length === 0 ? (
              <div className="py-4 text-center text-muted-foreground">
                {studentEmptyMessage}
              </div>
            ) : (
              <div className="space-y-2">
                {filteredStudents.map((student) => (
                  <Card key={student.id} className="p-3">
                    <div className="flex items-center space-x-3">
                      <Checkbox
                        id={`add-student-${student.id}`}
                        checked={student.isSelected}
                        onCheckedChange={(checked) =>
                          handleStudentSelection(student.id, checked === true)
                        }
                      />
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <label
                            htmlFor={`add-student-${student.id}`}
                            className="cursor-pointer"
                          >
                            <div className="font-medium">
                              {student.lastName} {student.firstName}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {student.studentNumber}
                            </div>
                          </label>
                          <div className="text-right">
                            <div className="text-sm font-medium">
                              {student.memberships[0]?.classroom.name ||
                                "未所属"}
                            </div>
                            {student.memberships[0]?.attendanceNumber !=
                              null && (
                              <div className="text-xs text-muted-foreground">
                                出席番号:{" "}
                                {student.memberships[0].attendanceNumber}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </Card>
                ))}
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
