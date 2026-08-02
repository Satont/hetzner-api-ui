<script setup lang="ts">
import { Plus, Trash2 } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export interface RecordRow {
  value: string
  comment: string
}

const rows = defineModel<RecordRow[]>({ default: () => [] })

function addRow() {
  rows.value = [...rows.value, { value: '', comment: '' }]
}

function removeRow(index: number) {
  rows.value = rows.value.filter((_, i) => i !== index)
}

function updateRow(index: number, patch: Partial<RecordRow>) {
  rows.value = rows.value.map((row, i) => (i === index ? { ...row, ...patch } : row))
}
</script>

<template>
  <div class="space-y-2">
    <div v-for="(row, index) in rows" :key="index" class="flex items-start gap-2">
      <Input
        :model-value="row.value"
        class="font-mono text-xs"
        placeholder="198.51.100.1"
        @update:model-value="updateRow(index, { value: String($event) })"
      />
      <Input
        :model-value="row.comment"
        class="w-40"
        placeholder="Comment (optional)"
        @update:model-value="updateRow(index, { comment: String($event) })"
      />
      <Button
        type="button"
        variant="ghost"
        size="icon"
        class="size-9 shrink-0"
        :disabled="rows.length <= 1"
        @click="removeRow(index)"
      >
        <Trash2 class="size-4" />
      </Button>
    </div>
    <Button type="button" variant="outline" size="sm" @click="addRow">
      <Plus class="mr-2 size-4" />
      Add record
    </Button>
  </div>
</template>
