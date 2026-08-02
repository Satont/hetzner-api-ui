import type { operations } from '@/api/schema'
import type { ListItem, ResponseBody } from '@/api/client'

export type Server = ListItem<operations['list_servers'], 'servers'>
export type ServerDetail = NonNullable<ResponseBody<operations['get_server']>['server']>
export type ServerType = ListItem<operations['list_server_types'], 'server_types'>
export type Image = ListItem<operations['list_images'], 'images'>
export type Location = ListItem<operations['list_locations'], 'locations'>
export type Network = ListItem<operations['list_networks'], 'networks'>
export type SshKey = ListItem<operations['list_ssh_keys'], 'ssh_keys'>

export type MetricSeries = { name: string; points: [number, number][] }

/** Formats a byte count into a human readable string. */
export function formatBytes(bytes: number | null | undefined): string | null {
  if (bytes === null || bytes === undefined) return null
  const units = ['B', 'KiB', 'MiB', 'GiB', 'TiB', 'PiB']
  let value = bytes
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit++
  }
  return `${value.toFixed(unit === 0 ? 0 : 1)} ${units[unit] ?? 'B'}`
}
