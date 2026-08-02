<script setup lang="ts">
import MaskedValue from '@/components/shared/MaskedValue.vue'

export interface KeyValueItem {
  label: string
  value: string | number | null | undefined
  /** Render the value hidden behind a reveal toggle (for IPs and other sensitive data). */
  mask?: boolean
}

defineProps<{
  items: KeyValueItem[]
}>()
</script>

<template>
  <dl class="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
    <div v-for="item in items" :key="item.label" class="min-w-0">
      <dt class="text-xs font-medium uppercase tracking-wide text-muted-foreground">{{ item.label }}</dt>
      <dd class="mt-0.5 truncate text-sm" :title="item.mask ? undefined : String(item.value ?? '—')">
        <MaskedValue v-if="item.mask" :value="item.value" />
        <template v-else>{{ item.value ?? '—' }}</template>
      </dd>
    </div>
  </dl>
</template>
