import type { LucideIcon } from "lucide-react"
export function PencilIcon({
  icon: Icon,
  color = "#78746C",
  size = 15,
}: {
  icon: LucideIcon
  color?: string
  size?: number
}) {
  return <Icon width={size} height={size} strokeWidth={1.8} color={color} />
}
