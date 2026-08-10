import "@testing-library/jest-dom/vitest"
import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { EditorPlayground } from "./editor-playground"

describe("EditorPlayground", () => {
  it("renders local editor controls and a JSON inspection panel", () => {
    render(<EditorPlayground />)

    expect(screen.getByRole("heading", { name: "编辑器测试台" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "粗体" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "撤销" })).toBeInTheDocument()
    expect(screen.getByLabelText("链接地址")).toBeInTheDocument()
    expect(screen.getByLabelText("Slash command 查询")).toBeInTheDocument()
    expect(screen.getByLabelText("编辑器 JSON 快照")).toHaveTextContent('"type": "doc"')
  })
})
