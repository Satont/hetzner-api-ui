<script setup lang="ts">
import { Button } from '@/components/ui/button'

defineProps<{
  error: string
}>()

const emit = defineEmits<{ retry: [] }>()
</script>

<template>
  <div class="flex items-center justify-between gap-4 rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3">
    <p class="text-sm text-destructive">{{ error }}</p>
    <Button variant="outline" size="sm" @click="emit('retry')">Retry</Button>
  </div>
</template>
