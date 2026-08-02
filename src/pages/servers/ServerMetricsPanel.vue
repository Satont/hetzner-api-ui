<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { RefreshCw } from 'lucide-vue-next'
import { useApi, ApiError } from '@/composables/useApi'
import type { MetricSeries } from './types'
import { formatBytes } from './types'
import MetricsChart from './MetricsChart.vue'
import ErrorState from '@/components/shared/ErrorState.vue'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

const props = defineProps<{
  serverId: number
}>()

const { client, unwrap } = useApi()

type MetricType = 'cpu' | 'disk' | 'network'
type RangeKey = '1h' | '24h' | '7d'

const RANGES: Record<RangeKey, number> = {
  '1h': 3600,
  '24h': 86400,
  '7d': 604800,
}

const metricType = ref<MetricType>('cpu')
const range = ref<RangeKey>('1h')
const series = ref<MetricSeries[]>([])
const loading = ref(false)
const error = ref<string | null>(null)

async function fetchMetrics() {
  loading.value = true
  error.value = null
  try {
    const seconds = RANGES[range.value]
    const end = new Date()
    const start = new Date(end.getTime() - seconds * 1000)
    const step = String(Math.max(60, Math.ceil(seconds / 200)))
    const data = unwrap(
      await client().GET('/servers/{id}/metrics', {
        params: {
          path: { id: props.serverId },
          query: {
            type: [metricType.value],
            start: start.toISOString(),
            end: end.toISOString(),
            step,
          },
        },
      }),
    )
    series.value = Object.entries(data.metrics?.time_series ?? {}).map(([name, ts]) => ({
      name,
      points: ts.values.map(([timestamp, value]) => [timestamp, Number.parseFloat(String(value))] as [number, number]),
    }))
  } catch (e) {
    error.value = e instanceof ApiError ? e.message : String(e)
    series.value = []
  } finally {
    loading.value = false
  }
}

watch([metricType, range], fetchMetrics, { immediate: true })

const isBandwidth = computed(() => series.value.some((s) => s.name.includes('bandwidth')))

function formatValue(value: number): string {
  if (isBandwidth.value) return `${formatBytes(value) ?? String(value)}/s`
  if (metricType.value === 'cpu') return `${value.toFixed(1)}%`
  return Math.abs(value) >= 100 ? value.toFixed(0) : value.toFixed(1)
}

function formatTime(timestamp: number): string {
  const date = new Date(timestamp * 1000)
  return range.value === '7d'
    ? date.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
    : date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
}

const CHART_COLORS = ['var(--chart-3)', 'var(--chart-2)', 'var(--chart-4)', 'var(--chart-5)', 'var(--chart-1)']

const legend = computed(() =>
  series.value.map((s, index) => {
    const values = s.points.map(([, y]) => y)
    return {
      name: s.name,
      color: CHART_COLORS[index % CHART_COLORS.length] ?? CHART_COLORS[0]!,
      last: values.length ? values[values.length - 1]! : 0,
      max: values.length ? Math.max(...values) : 0,
    }
  }),
)
</script>

<template>
  <div class="space-y-4">
    <div class="flex flex-wrap items-end justify-between gap-4">
      <div class="flex flex-wrap items-end gap-4">
        <div class="space-y-1.5">
          <Label>Metric</Label>
          <Select v-model="metricType">
            <SelectTrigger class="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="cpu">CPU</SelectItem>
              <SelectItem value="disk">Disk</SelectItem>
              <SelectItem value="network">Network</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div class="space-y-1.5">
          <Label>Time range</Label>
          <Select v-model="range">
            <SelectTrigger class="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1h">Last 1h</SelectItem>
              <SelectItem value="24h">Last 24h</SelectItem>
              <SelectItem value="7d">Last 7d</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <Button variant="outline" size="sm" :disabled="loading" @click="fetchMetrics()">
        <RefreshCw class="mr-2 size-4" />
        Refresh
      </Button>
    </div>

    <ErrorState v-if="error" :error="error" @retry="fetchMetrics()" />
    <Skeleton v-else-if="loading" class="h-64 w-full" />

    <template v-else>
      <MetricsChart :series="series" :format-value="formatValue" :format-time="formatTime" />
      <div v-if="legend.length" class="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead class="w-8"></TableHead>
              <TableHead>Series</TableHead>
              <TableHead class="text-right">Last</TableHead>
              <TableHead class="text-right">Max</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow v-for="row in legend" :key="row.name">
              <TableCell>
                <span class="inline-block size-3 rounded-sm" :style="{ backgroundColor: row.color }" />
              </TableCell>
              <TableCell class="font-mono text-xs">{{ row.name }}</TableCell>
              <TableCell class="text-right font-mono text-xs">{{ formatValue(row.last) }}</TableCell>
              <TableCell class="text-right font-mono text-xs">{{ formatValue(row.max) }}</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
    </template>
  </div>
</template>
