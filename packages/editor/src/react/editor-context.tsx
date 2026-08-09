"use client"

import { createContext } from "react"
import type { Editor } from "@tiptap/core"

export const EditorContext = createContext<Editor | null>(null)
