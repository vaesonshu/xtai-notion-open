import type { Icon } from "@workspace/icons"
export function PencilIcon({
  icon: Icon,
  color = "#78746C",
  size = 15,
  className,
}: {
  icon: Icon
  color?: string
  size?: number
  className?: string
}) {
  return (
    <Icon
      width={size}
      height={size}
      strokeWidth={1.8}
      color={color}
      className={className}
    />
  )
}
