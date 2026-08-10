import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import type { CollaborationStatus as Status } from "../collaboration/types"
import { EditorContext } from "../react/editor-context"
import { CollaborationStatus } from "./collaboration-status"

function renderStatus(status: Status) {
  return render(
    <EditorContext
      value={{
        editor: null,
        collaborationStatus: status,
        collaborators: [],
      }}
    >
      <CollaborationStatus />
    </EditorContext>,
  )
}

describe("CollaborationStatus", () => {
  it("announces connecting with accessible loading feedback", () => {
    renderStatus("connecting")

    expect(screen.getByRole("status", { name: /连接中/ })).toBeInTheDocument()
    expect(document.querySelector('[data-slot="skeleton"]')).not.toBeNull()
  })

  it("shows synced feedback including saved affordance", () => {
    renderStatus("synced")

    expect(screen.getByRole("status", { name: /已同步/ })).toBeInTheDocument()
    expect(screen.getByText("已保存")).toBeInTheDocument()
  })

  it("shows offline feedback", () => {
    renderStatus("offline")

    expect(screen.getByRole("status", { name: /离线/ })).toBeInTheDocument()
  })

  it("shows unauthorized feedback", () => {
    renderStatus("unauthorized")

    expect(screen.getByRole("status", { name: /无权限/ })).toBeInTheDocument()
  })

  it("shows error feedback without claiming the document is saved", () => {
    renderStatus("error")

    expect(screen.getByRole("status", { name: /错误/ })).toBeInTheDocument()
    expect(screen.getByRole("alert")).toBeInTheDocument()
    expect(screen.queryByText("已保存")).not.toBeInTheDocument()
  })
})
