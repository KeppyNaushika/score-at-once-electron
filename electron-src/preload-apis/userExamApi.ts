import { ipcRenderer } from "electron"

export function createUserExamApi() {
  return {
    // UserExam
    userExam: {
      getMembers: (examId: string) =>
        ipcRenderer.invoke("user-exam:get-members", examId),
      getRole: (userId: string, examId: string) =>
        ipcRenderer.invoke("user-exam:get-role", userId, examId),
      isOwner: (userId: string, examId: string) =>
        ipcRenderer.invoke("user-exam:is-owner", userId, examId),
      isMember: (userId: string, examId: string) =>
        ipcRenderer.invoke("user-exam:is-member", userId, examId),
      setOwner: (options: { examId: string; userId: string }) =>
        ipcRenderer.invoke("user-exam:set-owner", options),
      invite: (options: {
        examId: string
        userId: string
        invitedBy: string
      }) => ipcRenderer.invoke("user-exam:invite", options),
      remove: (examId: string, userId: string, removedBy: string) =>
        ipcRenderer.invoke("user-exam:remove", examId, userId, removedBy),
      transferOwnership: (
        examId: string,
        newOwnerId: string,
        currentOwnerId: string
      ) =>
        ipcRenderer.invoke(
          "user-exam:transfer-ownership",
          examId,
          newOwnerId,
          currentOwnerId
        ),
      getUserExams: (userId: string) =>
        ipcRenderer.invoke("user-exam:get-user-exams", userId),
      getOwner: (examId: string) =>
        ipcRenderer.invoke("user-exam:get-owner", examId),
      searchUsers: (examId: string, query: string) =>
        ipcRenderer.invoke("user-exam:search-users", examId, query),
    },
  }
}
