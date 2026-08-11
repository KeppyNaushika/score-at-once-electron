import { bind } from "./invoke"

/** 小計グループ・採点領域-小計紐付けのIPC API（CRUD・試験への割り当て管理） */
export function createSubtotalApi() {
  return {
    // SubtotalGroup related (new management API with correct parameter format)
    createSubtotalGroup: bind("create-subtotal-group"),
    updateSubtotalGroup: bind("update-subtotal-group"),
    deleteSubtotalGroup: bind("delete-subtotal-group"),

    // New SubtotalGroup management API
    getSubtotalGroups: bind("get-subtotal-groups"),
    getAvailableSubtotalGroupsForExam: bind(
      "get-available-subtotal-groups-for-exam"
    ),
    getActiveSubtotalGroupsForExam: bind("get-active-subtotal-groups-for-exam"),
    addSubtotalGroupToExam: bind("add-subtotal-group-to-exam"),
    removeSubtotalGroupFromExam: bind("remove-subtotal-group-from-exam"),
    getSubtotalGroupSelection: bind("get-subtotal-group-selection"),
    setSubtotalGroupSelection: bind("set-subtotal-group-selection"),

    // CropSubtotal related (unified from QuestionSubtotalAssignment + SubtotalDefinition)
    createManyCropSubtotals: bind("create-many-crop-subtotals"),
    deleteCropSubtotalsByCropRegionId: bind(
      "delete-crop-subtotals-by-crop-region-id"
    ),
    getCropSubtotalsByCropRegionId: bind(
      "get-crop-subtotals-by-crop-region-id"
    ),
  }
}
