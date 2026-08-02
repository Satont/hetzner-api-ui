<script setup lang="ts">
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'

defineProps<{
  title: string
  description?: string
}>()

const open = defineModel<boolean>('open', { default: false })
</script>

<template>
  <Sheet v-model:open="open">
    <SheetContent class="w-full overflow-y-auto sm:max-w-xl">
      <SheetHeader>
        <SheetTitle>{{ title }}</SheetTitle>
        <SheetDescription v-if="description">{{ description }}</SheetDescription>
      </SheetHeader>
      <div class="space-y-6 px-4 pb-6">
        <slot />
      </div>
    </SheetContent>
  </Sheet>
</template>
