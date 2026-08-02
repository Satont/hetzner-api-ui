<script setup lang="ts">
import { Badge } from '@/components/ui/badge'

defineProps<{
  labels: Record<string, string> | null | undefined
}>()
</script>

<template>
  <div v-if="labels && Object.keys(labels).length" class="flex max-w-xs flex-wrap gap-1">
    <Badge v-for="(value, key) in labels" :key="key" variant="outline" class="font-mono text-[10px]">
      {{ key }}={{ value }}
    </Badge>
  </div>
  <span v-else class="text-muted-foreground">—</span>
</template>
