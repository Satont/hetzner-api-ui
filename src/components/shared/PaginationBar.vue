<script setup lang="ts">
import { Button } from '@/components/ui/button'
import type { PageInfo } from '@/composables/usePagedResource'

defineProps<{
  pageInfo: PageInfo
  loading?: boolean
}>()

const emit = defineEmits<{ change: [page: number] }>()
</script>

<template>
  <div class="flex items-center justify-between gap-4">
    <p class="text-sm text-muted-foreground">
      Page {{ pageInfo.page }} of {{ pageInfo.last_page }}
      <span v-if="pageInfo.total_entries !== null"> · {{ pageInfo.total_entries }} entries</span>
    </p>
    <div class="flex items-center gap-2">
      <Button variant="outline" size="sm" :disabled="loading || pageInfo.page <= 1" @click="emit('change', pageInfo.page - 1)">
        Previous
      </Button>
      <Button
        variant="outline"
        size="sm"
        :disabled="loading || pageInfo.page >= pageInfo.last_page"
        @click="emit('change', pageInfo.page + 1)"
      >
        Next
      </Button>
    </div>
  </div>
</template>
