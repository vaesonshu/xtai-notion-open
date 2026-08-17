import "@testing-library/jest-dom/vitest"
import { vi } from "vitest"

// Sonner 在测试中走 portal，统一 mock 便于断言 toast 调用。
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
    message: vi.fn(),
  },
  Toaster: () => null,
}))
