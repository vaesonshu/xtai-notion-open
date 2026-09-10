import "@testing-library/jest-dom/vitest"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { AuthMenu } from "@/components/auth-menu"
import { PersonalCenterProvider } from "@/components/personal-center-context"
import { PersonalCenterDialog } from "@/components/personal-center-dialog"

vi.mock("@/components/auth-provider", () => ({
  useAuthOptional: () => ({
    user: {
      id: "user-1",
      name: "林",
      color: "#24866B",
      role: "user" as const,
    },
    loading: false,
    refresh: vi.fn(),
  }),
}))

vi.mock("@/components/inkspace/workspace-ai-settings-panel", () => ({
  WorkspaceAiSettingsPanel: () => <div data-testid="ai-settings-panel" />,
}))

function renderPersonalCenterShell() {
  return render(
    <PersonalCenterProvider
      userId="user-1"
      workspaces={[
        {
          id: "ws-1",
          name: "我的知识库",
          memberCount: 1,
          documentCount: 2,
          role: "owner",
          aiSettings: { aiProvider: "cloud" },
          createdAt: "",
          updatedAt: "",
        },
      ]}
      currentWorkspaceId="ws-1"
    >
      <PersonalCenterDialog />
      <AuthMenu />
    </PersonalCenterProvider>
  )
}

function openPersonalCenterFromMenu() {
  fireEvent.click(screen.getByRole("button", { name: "账户菜单" }))
  fireEvent.click(screen.getByRole("menuitem", { name: "个人中心" }))
}

describe("PersonalCenterDialog", () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("opens from the avatar dropdown and shows profile by default", async () => {
    renderPersonalCenterShell()
    openPersonalCenterFromMenu()

    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeInTheDocument()
    })
    expect(screen.getByRole("heading", { name: "个人信息" })).toBeInTheDocument()
  })

  it("switches to AI settings from the left navigation", async () => {
    renderPersonalCenterShell()
    openPersonalCenterFromMenu()

    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole("button", { name: "AI 设置" }))

    expect(screen.getByRole("heading", { name: "AI 设置" })).toBeInTheDocument()
    expect(screen.getByTestId("ai-settings-panel")).toBeInTheDocument()
  })
})
