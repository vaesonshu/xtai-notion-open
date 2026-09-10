/** Close hides the window unless the user chose 退出. */
export function shouldHideOnClose(isQuitting: boolean): boolean {
  return !isQuitting
}
