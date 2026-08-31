import { toast } from "sonner"

export { toast }
export { Toaster } from "@workspace/ui/components/sonner"

/** 将 unknown 错误归一为可展示文案，避免各页面重复写 instanceof 判断 */
export function getToastErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback
}

/** 统一弹出错误 toast，供 API / 表单等失败场景复用 */
export function toastError(error: unknown, fallback: string) {
  toast.error(getToastErrorMessage(error, fallback))
}
