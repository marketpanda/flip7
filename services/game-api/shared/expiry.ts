export function epochSeconds(now = Date.now()): number {
  return Math.floor(now / 1000)
}

export function isExpired(
  item: { expiresAt: number },
  now = epochSeconds(),
): boolean {
  return item.expiresAt <= now
}
