"use client"

import { useEffect, useRef, useState } from "react"

type UseInViewOptions = {
  rootMargin?: string
  enabled?: boolean
}

/** 视口懒加载：元素进入视口后再挂载重型子组件�?*/
export function useInView<T extends Element>({
  rootMargin = "240px 0px",
  enabled = true,
}: UseInViewOptions = {}) {
  const ref = useRef<T | null>(null)
  const [isInView, setIsInView] = useState(!enabled)

  useEffect(() => {
    if (!enabled) {
      setIsInView(true)
      return
    }

    const node = ref.current
    if (!node) {
      return
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setIsInView(true)
          observer.disconnect()
        }
      },
      { rootMargin, threshold: 0 }
    )

    observer.observe(node)
    return () => observer.disconnect()
  }, [enabled, rootMargin])

  return { ref, isInView }
}
