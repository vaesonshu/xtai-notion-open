import { act, render, screen, waitFor } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { AuthProvider, useAuth } from "@/components/auth-provider"

function AuthState() {
  const { user, loading } = useAuth()

  return <output>{loading ? "loading" : user?.name || "signed-out"}</output>
}

describe("AuthProvider", () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("does not let the initial auth probe overwrite a newer refresh", async () => {
    const initialProbe = deferred<Response>()
    const refreshedProbe = deferred<Response>()
    vi.spyOn(globalThis, "fetch")
      .mockReturnValueOnce(initialProbe.promise)
      .mockReturnValueOnce(refreshedProbe.promise)

    // Calling refresh through a small test-only consumer starts the second
    // request while the provider's initial request is still unresolved.
    function RefreshOnMount() {
      const { refresh } = useAuth()
      return <button onClick={() => void refresh()}>refresh</button>
    }

    render(
      <AuthProvider>
        <AuthState />
        <RefreshOnMount />
      </AuthProvider>
    )

    screen.getByRole("button", { name: "refresh" }).click()
    refreshedProbe.resolve(
      new Response(JSON.stringify({ id: "user-1", displayName: "成员" }), {
        status: 200,
      })
    )
    await waitFor(() => expect(screen.getByText("成员")).toBeVisible())

    await act(async () => {
      initialProbe.resolve(new Response("null", { status: 200 }))
      await initialProbe.promise
    })
    expect(screen.getByText("成员")).toBeVisible()
  })
})

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise
  })
  return { promise, resolve }
}
