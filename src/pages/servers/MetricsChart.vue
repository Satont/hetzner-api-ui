<script setup lang="ts">
import { computed } from 'vue'
import type { MetricSeries } from './types'

const props = withDefaults(
  defineProps<{
    series: MetricSeries[]
    formatValue?: (value: number) => string
    formatTime?: (timestamp: number) => string
  }>(),
  {
    formatValue: (value: number) => (Math.abs(value) >= 100 ? value.toFixed(0) : value.toFixed(1)),
    formatTime: (timestamp: number) => new Date(timestamp * 1000).toLocaleString(),
  },
)

/** Theme chart colors, ordered for legibility in both light and dark mode. */
const CHART_COLORS = ['var(--chart-3)', 'var(--chart-2)', 'var(--chart-4)', 'var(--chart-5)', 'var(--chart-1)']

interface ColoredSeries extends MetricSeries {
  color: string
}

const WIDTH = 800
const HEIGHT = 260
const PAD = { top: 12, right: 12, bottom: 24, left: 56 }

const colored = computed<ColoredSeries[]>(() =>
  props.series.map((s, index) => ({ ...s, color: CHART_COLORS[index % CHART_COLORS.length] ?? CHART_COLORS[0]! })),
)

const bounds = computed(() => {
  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity
  for (const s of props.series) {
    for (const [x, y] of s.points) {
      if (x < minX) minX = x
      if (x > maxX) maxX = x
      if (y < minY) minY = y
      if (y > maxY) maxY = y
    }
  }
  if (!Number.isFinite(minX)) return null
  if (minY > 0) minY = 0
  if (maxY <= minY) maxY = minY + 1
  if (maxX <= minX) maxX = minX + 1
  return { minX, maxX, minY, maxY }
})

function scaleX(x: number): number {
  const b = bounds.value
  if (!b) return 0
  return PAD.left + ((x - b.minX) / (b.maxX - b.minX)) * (WIDTH - PAD.left - PAD.right)
}

function scaleY(y: number): number {
  const b = bounds.value
  if (!b) return 0
  return PAD.top + (1 - (y - b.minY) / (b.maxY - b.minY)) * (HEIGHT - PAD.top - PAD.bottom)
}

const paths = computed(() =>
  colored.value.map((s) => ({
    ...s,
    path: s.points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${scaleX(x).toFixed(2)},${scaleY(y).toFixed(2)}`).join(' '),
  })),
)

const yTicks = computed(() => {
  const b = bounds.value
  if (!b) return []
  const ticks: { y: number; label: string }[] = []
  for (let i = 0; i <= 4; i++) {
    const value = b.minY + ((b.maxY - b.minY) * i) / 4
    ticks.push({ y: scaleY(value), label: props.formatValue(value) })
  }
  return ticks
})

const xLabels = computed(() => {
  const b = bounds.value
  if (!b) return []
  return [
    { x: scaleX(b.minX), label: props.formatTime(b.minX), anchor: 'start' },
    { x: scaleX((b.minX + b.maxX) / 2), label: props.formatTime((b.minX + b.maxX) / 2), anchor: 'middle' },
    { x: scaleX(b.maxX), label: props.formatTime(b.maxX), anchor: 'end' },
  ] as const
})
</script>

<template>
  <svg v-if="bounds" :viewBox="`0 0 ${WIDTH} ${HEIGHT}`" class="h-64 w-full" role="img">
    <g v-for="tick in yTicks" :key="tick.y">
      <line
        :x1="PAD.left"
        :x2="WIDTH - PAD.right"
        :y1="tick.y"
        :y2="tick.y"
        stroke="var(--border)"
        stroke-width="1"
      />
      <text :x="PAD.left - 8" :y="tick.y + 3" text-anchor="end" class="fill-muted-foreground" font-size="10">
        {{ tick.label }}
      </text>
    </g>
    <text
      v-for="label in xLabels"
      :key="label.x"
      :x="label.x"
      :y="HEIGHT - 6"
      :text-anchor="label.anchor"
      class="fill-muted-foreground"
      font-size="10"
    >
      {{ label.label }}
    </text>
    <path
      v-for="s in paths"
      :key="s.name"
      :d="s.path"
      :stroke="s.color"
      stroke-width="1.5"
      fill="none"
      stroke-linejoin="round"
      stroke-linecap="round"
    />
  </svg>
  <p v-else class="py-8 text-center text-sm text-muted-foreground">No metric data for this period.</p>
</template>
