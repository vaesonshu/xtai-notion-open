import "@testing-library/jest-dom/vitest"
import { fireEvent, render, screen } from "@testing-library/react"
import * as React from "react"
import { afterEach, describe, expect, it, vi } from "vitest"

// Base UI's dialog positioning relies on browser geometry that jsdom does not
// implement; this focused mock keeps the test about sharing behavior itself.
vi.mock("@workspace/ui/components/dialog", () => {
  const Context = React.createContext<{
    open: boolean
    onOpenChange: (open: boolean) => void
  }>({ open: false, onOpenChange: () => undefined })

  function Dialog({
    open = false,
    onOpenChange = () => undefined,
    children,
  }: {
    open?: boolean
    onOpenChange?: (open: boolean) => void
    children: React.ReactNode
  }) {
    return (
      <Context.Provider value={{ open, onOpenChange }}>
        {children}
      </Context.Provider>
    )
  }

  function DialogTrigger({
    children,
  }: {
    render?: React.ReactElement
    children?: React.ReactNode
  }) {
    const { onOpenChange } = React.useContext(Context)
    // Keep the mock DOM-only so Base UI ref cleanup is not exercised in jsdom.
    return <button onClick={() => onOpenChange(true)}>{children}</button>
  }

  function DialogContent({ children }: { children: React.ReactNode }) {
    return React.useContext(Context).open ? <div>{children}</div> : null
  }

  const passthrough = ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  )
  const text = ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  )

  return {
    Dialog,
    DialogTrigger,
    DialogContent,
    DialogDescription: text,
    DialogFooter: passthrough,
    DialogHeader: passthrough,
    DialogTitle: text,
  }
})

// Keep Base UI button refs out of this jsdom-focused behavior test as well.
vi.mock("@workspace/ui/components/button", () => ({
  Button: ({
    children,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button {...props}>{children}</button>
  ),
}))

import { ShareDialog } from "./share-dialog"

describe("ShareDialog", () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("creates a same-origin editable share link and copies it", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ token: "share-token" }), {
          status: 201,
        })
      )
    )
    const writeText = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal("navigator", { clipboard: { writeText } })
    vi.stubGlobal("window", { location: { origin: "http://localhost:3000" } })

    render(<ShareDialog apiUrl="http://127.0.0.1:3100" documentId="doc-1" />)
    fireEvent.click(screen.getByRole("button", { name: /分享|Share/ }))

    const input = await screen.findByRole("textbox")
    expect(input).toHaveValue("http://localhost:3000/share/share-token")

    fireEvent.click(screen.getByRole("button", { name: /复制|Copy/ }))
    await Promise.resolve()
    expect(writeText).toHaveBeenCalledWith(input.getAttribute("value"))
  })
})
