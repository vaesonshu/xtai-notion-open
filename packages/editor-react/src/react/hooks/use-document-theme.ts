"use client"

import { useEffect, useState } from "react"

/** 跟随 next-themes 的 class 策略，不引入 next-themes 依赖。 */
export function useDocumentTheme(): "light" | "dark" {
  const [theme, setTheme] = useState<"light" | "dark">(() =>
    typeof document !== "undefined" &&
    document.documentElement.classList.contains("dark")
      ? "dark"
      : "light"
  )

  useEffect(() => {
    const root = document.documentElement
    const sync = () => {
      setTheme(root.classList.contains("dark") ? "dark" : "light")
    }
    sync()

    const observer = new MutationObserver(sync)
    observer.observe(root, {
      attributes: true,
      attributeFilter: ["class"],
    })
    return () => observer.disconnect()
  }, [])

  return theme
}
