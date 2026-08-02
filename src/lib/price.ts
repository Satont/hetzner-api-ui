/**
 * Price helpers for Hetzner resources. The API returns net/gross amounts
 * as strings without a currency; Hetzner Cloud bills in EUR.
 */
export interface LocationPrice {
  location: string
  price_hourly: { net: string; gross: string }
  price_monthly: { net: string; gross: string }
}

const hourlyFormatter = new Intl.NumberFormat(undefined, {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 4,
  maximumFractionDigits: 4,
})

const monthlyFormatter = new Intl.NumberFormat(undefined, {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

export function formatHourly(value: string | number): string {
  const num = typeof value === 'string' ? Number(value) : value
  return Number.isFinite(num) ? hourlyFormatter.format(num) : '—'
}

export function formatMonthly(value: string | number): string {
  const num = typeof value === 'string' ? Number(value) : value
  return Number.isFinite(num) ? monthlyFormatter.format(num) : '—'
}

/**
 * Picks the price entry for a location. Falls back to the cheapest
 * location when the location is unknown or not priced.
 */
export function priceForLocation(
  prices: LocationPrice[] | null | undefined,
  location: string | null | undefined,
): LocationPrice | null {
  if (!prices?.length) return null
  if (location) {
    const exact = prices.find((p) => p.location === location)
    if (exact) return exact
  }
  return prices.reduce((min, p) => (Number(p.price_hourly.net) < Number(min.price_hourly.net) ? p : min))
}
