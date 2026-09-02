import { normalizeTextColorInput } from "@xtai-notion/editor-core/commands"

export type HslColor = {
  h: number
  s: number
  l: number
}

/** HSL(0-360, 0-100, 0-100) → #RRGGBB */
export function hslToHex(h: number, s: number, l: number): string {
  const saturation = s / 100
  const lightness = l / 100
  const chroma = saturation * Math.min(lightness, 1 - lightness)

  const channel = (offset: number) => {
    const k = (offset + h / 30) % 12
    const value = lightness - chroma * Math.max(Math.min(k - 3, 9 - k, 1), -1)
    return Math.round(255 * value)
      .toString(16)
      .padStart(2, "0")
  }

  return `#${channel(0)}${channel(8)}${channel(4)}`.toUpperCase()
}

/** #RRGGBB → HSL，无法解析时回退到中性灰 */
export function hexToHsl(hex: string): HslColor {
  const normalized = normalizeTextColorInput(hex)
  if (!normalized) {
    return { h: 0, s: 0, l: 50 }
  }

  const raw = normalized.slice(1)
  const r = Number.parseInt(raw.slice(0, 2), 16) / 255
  const g = Number.parseInt(raw.slice(2, 4), 16) / 255
  const b = Number.parseInt(raw.slice(4, 6), 16) / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const delta = max - min
  const lightness = (max + min) / 2

  if (delta === 0) {
    return { h: 0, s: 0, l: Math.round(lightness * 100) }
  }

  const saturation =
    lightness > 0.5 ? delta / (2 - max - min) : delta / (max + min)

  let hue = 0
  if (max === r) {
    hue = ((g - b) / delta + (g < b ? 6 : 0)) * 60
  } else if (max === g) {
    hue = ((b - r) / delta + 2) * 60
  } else {
    hue = ((r - g) / delta + 4) * 60
  }

  return {
    h: Math.round(hue),
    s: saturation * 100,
    l: lightness * 100,
  }
}

export function colorsMatch(
  left: string | null | undefined,
  right: string | null | undefined
): boolean {
  const normalizedLeft = left ? normalizeTextColorInput(left) : null
  const normalizedRight = right ? normalizeTextColorInput(right) : null
  return normalizedLeft === normalizedRight
}
