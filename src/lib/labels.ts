/** Parses "key=value" lines into a labels record. Lines without "=" are skipped. */
export function parseLabels(text: string): Record<string, string> {
  const labels: Record<string, string> = {}
  for (const line of text.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed) continue
    const idx = trimmed.indexOf('=')
    if (idx <= 0) continue
    labels[trimmed.slice(0, idx).trim()] = trimmed.slice(idx + 1).trim()
  }
  return labels
}

export function labelsToText(labels: Record<string, string> | null | undefined): string {
  if (!labels) return ''
  return Object.entries(labels)
    .map(([key, value]) => `${key}=${value}`)
    .join('\n')
}
