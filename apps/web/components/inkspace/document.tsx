"use client"

import type { ReactNode } from "react"

export function DocumentPane({ children }: { children?: ReactNode }) {
  return (
    <section className="flex min-h-0 min-w-0 flex-1 justify-center overflow-y-auto overscroll-y-contain px-[72px] pt-[58px] pb-[72px]">
      <article className="flex w-[720px] max-w-full flex-col gap-4">
        {children}
      </article>
    </section>
  )
}

/** Stable demo document id used by the local Inkspace page. */
export const DEMO_DOCUMENT_ID = "11111111-1111-4111-8111-111111111111"
