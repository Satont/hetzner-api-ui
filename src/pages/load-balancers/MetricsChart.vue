<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  series: { name: string; values: [number, string][] }[]
}>()

const WIDTH = 640
const HEIGHT = 200
const PAD = { top: 12, right: 12, bottom: 24, left: 56 }

const COLORS = [
  'var(--color-chart-1)',
  'var(--color-chart-2)',
  'var(--color-chart-3)',
  'var(--color-chart-4)',
  'var(--color-chart-5)',
]

interface Plotted {
  name: string
  color: string
  points: string
  max: number
}

const plot = computed<{ lines: Plotted[]; minTime: number; maxTime: number; maxValue: number } | null>(() => {
  const all = props.series.filter((s) => s.values.length > 1)
  if (!all.length) return null
  const numeric = all.map((s) => ({
    name: s.name,
    values: s.values.map(([t, v]) => [t, Number(v)] as [number, number]).filter(([, v]) => Number.isFinite(v)),
  }))
  const times = numeric.flatMap((s) => s.values.map(([t]) => t))
  const values = numeric.flatMap((s) => s.values.map(([, v]) => v))
  const minTime = Math.min(...times)
  const maxTime = Math.max(...times)
  const maxValue = Math.max(...values, 0)
  if (maxTime <= minTime) return null
  const innerW = WIDTH - PAD.left - PAD.right
  const innerH = HEIGHT - PAD.top - PAD.bottom
  const yMax = maxValue === 0 ? 1 : maxValue
  const lines: Plotted[] = numeric.map((s, i) => ({
    name: s.name,
    color: COLORS[i % COLORS.length]!,
    max: Math.max(...s.values.map(([, v]) => v)),
    points: s.values
      .map(([t, v]) => {
        const x = PAD.left + ((t - minTime) / (maxTime - minTime)) * innerW
        const y = PAD.top + innerH - (v / yMax) * innerH
        return `${x.toFixed(1)},${y.toFixed(1)}`
      })
      .join(' '),
  }))
  return { lines, minTime, maxTime, maxValue }
})

function fmtTime(unix: number): string {
  return new Date(unix * 1000).toLocaleString()
}

function fmtValue(v: number): string {
  if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`
  if (Math.abs(v) >= 1_000) return `${(v / 1_000).toFixed(1)}k`
  return v.toFixed(v % 1 === 0 ? 0 : 2)
}
</script>

<template>
  <div v-if="plot" class="space-y-2">
    <svg :viewBox="`0 0 ${WIDTH} ${HEIGHT}`" class="w-full rounded-md border bg-muted/20">
      <line
        :x1="PAD.left"
        :y1="HEIGHT - PAD.bottom"
        :x2="WIDTH - PAD.right"
        :y2="HEIGHT - PAD.bottom"
        class="stroke-border"
        stroke-width="1"
      />
      <line :x1="PAD.left" :y1="PAD.top" :x2="PAD.left" :y2="HEIGHT - PAD.bottom" class="stroke-border" stroke-width="1" />
      <text :x="PAD.left - 6" :y="PAD.top + 8" text-anchor="end" class="fill-muted-foreground text-[10px]">
        {{ fmtValue(plot.maxValue) }}
      </text>
      <text :x="PAD.left - 6" :y="HEIGHT - PAD.bottom" text-anchor="end" class="fill-muted-foreground text-[10px]">0</text>
      <text :x="PAD.left" :y="HEIGHT - 8" class="fill-muted-foreground text-[10px]">{{ fmtTime(plot.minTime) }}</text>
      <text :x="WIDTH - PAD.right" :y="HEIGHT - 8" text-anchor="end" class="fill-muted-foreground text-[10px]">
        {{ fmtTime(plot.maxTime) }}
      </text>
      <polyline
        v-for="line in plot.lines"
        :key="line.name"
        :points="line.points"
        fill="none"
        :stroke="line.color"
        stroke-width="1.5"
        stroke-linejoin="round"
        stroke-linecap="round"
      />
    </svg>
    <div class="flex flex-wrap gap-3 text-xs text-muted-foreground">
      <span v-for="line in plot.lines" :key="line.name" class="inline-flex items-center gap-1.5">
        <span class="inline-block size-2.5 rounded-full" :style="{ backgroundColor: line.color }" />
        {{ line.name }} (max {{ fmtValue(line.max) }})
      </span>
    </div>
  </div>
  <p v-else class="text-sm text-muted-foreground">No data points for this period.</p>
</template>
