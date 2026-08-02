<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  data: unknown
}>()

const text = computed(() => JSON.stringify(props.data, null, 2))
</script>

<template>
  <pre class="max-h-96 overflow-auto rounded-md border bg-muted/40 p-3 text-xs leading-relaxed">{{ text }}</pre>
</template>
