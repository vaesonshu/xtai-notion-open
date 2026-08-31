import "@testing-library/jest-dom/vitest"
import { vi } from "vitest"

const toastFns = {
  success: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
  warning: vi.fn(),
  message: vi.fn(),
}

// 业务代码统一从 @/lib/toast 触发提示，测试里集中 mock 便于断言。
vi.mock("@/lib/toast", () => ({
  toast: toastFns,
  toastError: vi.fn((error: unknown, fallback: string) => {
    const message =
      error instanceof Error && error.message ? error.message : fallback
    toastFns.error(message)
  }),
  getToastErrorMessage: vi.fn((error: unknown, fallback: string) =>
    error instanceof Error && error.message ? error.message : fallback
  ),
  Toaster: () => null,
}))

// editor-shadcn 等包仍直接依赖 sonner，保留 mock 避免 portal 渲染。
vi.mock("sonner", () => ({
  toast: toastFns,
  Toaster: () => null,
}))
