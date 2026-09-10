/** Parse a dotenv snippet without pulling in a dotenv runtime dependency. */
export function readEnvValue(
  fileContents: string,
  key: string
): string | undefined {
  for (const rawLine of fileContents.split("\n")) {
    const line = rawLine.trim()
    if (!line || line.startsWith("#")) continue
    const eq = line.indexOf("=")
    if (eq <= 0) continue
    if (line.slice(0, eq) !== key) continue
    return line.slice(eq + 1).replace(/^["']|["']$/g, "")
  }
  return undefined
}
