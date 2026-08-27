"use client"

import {
  createContext,
  use,
  type ComponentType,
  type HTMLAttributes,
  type ReactNode,
} from "react"

/** 编辑�?UI 原语契约，主题包注入具体实现�?*/
export type EditorComponents = {
  Button: ComponentType<
    HTMLAttributes<HTMLButtonElement> & {
      variant?: string
      size?: string
      disabled?: boolean
    }
  >
  Input: ComponentType<
    HTMLAttributes<HTMLInputElement> & { disabled?: boolean }
  >
  Toggle: ComponentType<
    HTMLAttributes<HTMLButtonElement> & {
      pressed?: boolean
      disabled?: boolean
      size?: string
    }
  >
  Popover: ComponentType<{ children?: ReactNode }>
  PopoverTrigger: ComponentType<{ children?: ReactNode; asChild?: boolean }>
  PopoverContent: ComponentType<
    HTMLAttributes<HTMLDivElement> & { align?: string; side?: string }
  >
  Alert: ComponentType<HTMLAttributes<HTMLDivElement> & { variant?: string }>
  AlertTitle: ComponentType<HTMLAttributes<HTMLHeadingElement>>
  AlertDescription: ComponentType<HTMLAttributes<HTMLDivElement>>
  Skeleton: ComponentType<HTMLAttributes<HTMLDivElement>>
  AlertDialog: ComponentType<{ children?: ReactNode }>
  AlertDialogTrigger: ComponentType<{ children?: ReactNode; asChild?: boolean }>
  AlertDialogContent: ComponentType<HTMLAttributes<HTMLDivElement>>
  AlertDialogHeader: ComponentType<HTMLAttributes<HTMLDivElement>>
  AlertDialogTitle: ComponentType<HTMLAttributes<HTMLHeadingElement>>
  AlertDialogDescription: ComponentType<HTMLAttributes<HTMLDivElement>>
  AlertDialogFooter: ComponentType<HTMLAttributes<HTMLDivElement>>
  AlertDialogCancel: ComponentType<HTMLAttributes<HTMLButtonElement>>
  AlertDialogAction: ComponentType<HTMLAttributes<HTMLButtonElement>>
}

const ComponentsContext = createContext<EditorComponents | null>(null)

export function ComponentsProvider({
  value,
  children,
}: {
  value: EditorComponents
  children: ReactNode
}) {
  return <ComponentsContext value={value}>{children}</ComponentsContext>
}

export function useEditorComponents(): EditorComponents {
  const value = use(ComponentsContext)
  if (!value) {
    throw new Error(
      "useEditorComponents must be used within ComponentsProvider or ShadcnEditorProvider"
    )
  }
  return value
}
