"use client"

import type { ReactNode } from "react"
import {
  ComponentsProvider,
  type EditorComponents,
} from "@xtai-notion/editor-react"
import { Alert, AlertDescription, AlertTitle } from "./ui/alert"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "./ui/alert-dialog"
import { Button } from "./ui/button"
import { Input } from "./ui/input"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "./ui/popover"
import { Skeleton } from "./ui/skeleton"
import { Toggle } from "./ui/toggle"

/** shadcn 主题对 EditorComponents 的默认实现。 */
export const defaultEditorComponents = {
  Button,
  Input,
  Toggle,
  Popover,
  PopoverTrigger,
  PopoverContent,
  Alert,
  AlertTitle,
  AlertDescription,
  Skeleton,
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} as EditorComponents

export function ShadcnEditorProvider({ children }: { children: ReactNode }) {
  return (
    <ComponentsProvider value={defaultEditorComponents}>
      {children}
    </ComponentsProvider>
  )
}
