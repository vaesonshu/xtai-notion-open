/** 站内走路由/location，站外用新标签打开 */
export function openEditorHref(
  href: string,
  navigate?: (href: string) => void
): void {
  if (href.startsWith("/") || href.startsWith("#")) {
    if (navigate) {
      navigate(href)
      return
    }

    window.location.assign(href)
    return
  }

  window.open(href, "_blank", "noopener,noreferrer")
}

/** 区分行内超链接与文档提及，避免编辑态对提及弹出链接菜单 */
export function resolveProseMirrorLink(
  target: EventTarget | null
): HTMLAnchorElement | null {
  if (!(target instanceof Element)) {
    return null
  }

  const link = target.closest<HTMLAnchorElement>("a[href]")
  if (!link?.closest(".ProseMirror")) {
    return null
  }

  return link
}

export function isInlineEditorLink(link: HTMLAnchorElement): boolean {
  return (
    link.classList.contains("editor-inline-link") &&
    !link.matches('[data-mention="true"]')
  )
}
