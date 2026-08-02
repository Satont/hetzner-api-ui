<script setup lang="ts">
import { Check, Copy } from 'lucide-vue-next'
import { ref } from 'vue'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

defineProps<{
  title: string
  description?: string
  fields: { label: string; value: string }[]
}>()

const open = defineModel<boolean>('open', { default: false })

const copiedLabel = ref<string | null>(null)

async function copy(field: { label: string; value: string }) {
  await navigator.clipboard.writeText(field.value)
  copiedLabel.value = field.label
  setTimeout(() => {
    copiedLabel.value = null
  }, 1500)
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent>
      <DialogHeader>
        <DialogTitle>{{ title }}</DialogTitle>
        <DialogDescription v-if="description">{{ description }}</DialogDescription>
      </DialogHeader>
      <div class="space-y-3">
        <div v-for="field in fields" :key="field.label" class="space-y-1">
          <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">{{ field.label }}</p>
          <div class="flex items-center gap-2">
            <code class="flex-1 truncate rounded-md border bg-muted/40 px-2 py-1.5 font-mono text-xs" :title="field.value">
              {{ field.value }}
            </code>
            <Button variant="outline" size="icon" class="size-8 shrink-0" @click="copy(field)">
              <Check v-if="copiedLabel === field.label" class="size-4" />
              <Copy v-else class="size-4" />
            </Button>
          </div>
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" @click="open = false">Close</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
