import { MyAPI } from "../renderer"

declare global {
  interface Window {
    electronAPI: MyAPI
  }
}
