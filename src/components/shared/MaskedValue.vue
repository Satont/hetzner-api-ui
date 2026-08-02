<script setup lang="ts">
import { ref } from 'vue'
import { Eye, EyeOff } from 'lucide-vue-next'

defineProps<{
  value: string | number | null | undefined
}>()

const revealed = ref(false)
</script>

<template>
  <span v-if="value === null || value === undefined || value === ''" class="text-muted-foreground">—</span>
  <span v-else class="inline-flex items-center gap-1.5">
    <span class="font-mono">{{ revealed ? value : '••••••••••' }}</span>
    <button
      type="button"
      class="text-muted-foreground transition-colors hover:text-foreground"
      :title="revealed ? 'Hide' : 'Show'"
      @click.stop="revealed = !revealed"
    >
      <Eye v-if="!revealed" class="size-3.5" />
      <EyeOff v-else class="size-3.5" />
    </button>
  </span>
</template>
