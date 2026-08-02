<script setup lang="ts">
import { computed } from 'vue'
import { Badge } from '@/components/ui/badge'

const props = defineProps<{
  status: string | null | undefined
}>()

type BadgeVariant = 'default' | 'secondary' | 'destructive' | 'outline'

const variant = computed<BadgeVariant>(() => {
  switch ((props.status ?? '').toLowerCase()) {
    case 'running':
    case 'active':
    case 'available':
    case 'success':
    case 'ready':
      return 'default'
    case 'off':
    case 'inactive':
    case 'error':
    case 'failed':
      return 'destructive'
    case 'initializing':
    case 'creating':
    case 'starting':
    case 'stopping':
    case 'migrating':
    case 'rebuilding':
    case 'pending':
    case 'progress':
      return 'secondary'
    default:
      return 'outline'
  }
})
</script>

<template>
  <Badge :variant="variant">{{ status ?? '—' }}</Badge>
</template>
