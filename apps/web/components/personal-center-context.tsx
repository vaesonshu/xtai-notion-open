"use client"

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react"
import type { WorkspaceSummary } from "@/lib/workspace-api"

export type PersonalCenterSection = "profile" | "ai"

type PersonalCenterContextValue = {
  open: boolean
  activeSection: PersonalCenterSection
  openPersonalCenter: (section?: PersonalCenterSection) => void
  setOpen: (open: boolean) => void
  setActiveSection: (section: PersonalCenterSection) => void
  userId: string
  workspaces: WorkspaceSummary[]
  currentWorkspaceId: string | null
  onRefreshWorkspaces?: () => void
}

const PersonalCenterContext = createContext<PersonalCenterContextValue | null>(
  null
)

export function PersonalCenterProvider({
  children,
  userId,
  workspaces,
  currentWorkspaceId,
  onRefreshWorkspaces,
}: {
  children: ReactNode
  userId: string
  workspaces: WorkspaceSummary[]
  currentWorkspaceId: string | null
  onRefreshWorkspaces?: () => void
}) {
  const [open, setOpen] = useState(false)
  const [activeSection, setActiveSection] =
    useState<PersonalCenterSection>("profile")

  const openPersonalCenter = useCallback(
    (section: PersonalCenterSection = "profile") => {
      setActiveSection(section)
      setOpen(true)
    },
    []
  )

  const value = useMemo(
    () => ({
      open,
      activeSection,
      setActiveSection,
      setOpen,
      openPersonalCenter,
      userId,
      workspaces,
      currentWorkspaceId,
      onRefreshWorkspaces,
    }),
    [
      open,
      activeSection,
      openPersonalCenter,
      userId,
      workspaces,
      currentWorkspaceId,
      onRefreshWorkspaces,
    ]
  )

  return <PersonalCenterContext value={value}>{children}</PersonalCenterContext>
}

export function usePersonalCenter() {
  const context = useContext(PersonalCenterContext)
  if (!context) {
    throw new Error(
      "usePersonalCenter must be used within PersonalCenterProvider"
    )
  }
  return context
}

export function usePersonalCenterOptional() {
  return useContext(PersonalCenterContext)
}
