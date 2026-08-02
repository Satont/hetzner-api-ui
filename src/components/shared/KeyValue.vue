<script setup lang="ts">
export interface KeyValueItem {
  label: string
  value: string | number | null | undefined
}

defineProps<{
  items: KeyValueItem[]
}>()
</script>

<template>
  <dl class="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
    <div v-for="item in items" :key="item.label" class="min-w-0">
      <dt class="text-xs font-medium uppercase tracking-wide text-muted-foreground">{{ item.label }}</dt>
      <dd class="mt-0.5 truncate text-sm" :title="String(item.value ?? '—')">{{ item.value ?? '—' }}</dd>
    </div>
  </dl>
</template>
