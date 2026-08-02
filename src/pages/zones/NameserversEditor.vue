<script setup lang="ts">
import { Plus, Trash2 } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export interface NameserverRow {
  address: string
  port: string
}

const rows = defineModel<NameserverRow[]>({ default: () => [] })

function addRow() {
  rows.value = [...rows.value, { address: '', port: '' }]
}

function removeRow(index: number) {
  rows.value = rows.value.filter((_, i) => i !== index)
}

function updateRow(index: number, patch: Partial<NameserverRow>) {
  rows.value = rows.value.map((row, i) => (i === index ? { ...row, ...patch } : row))
}
</script>

<template>
  <div class="space-y-2">
    <div v-for="(row, index) in rows" :key="index" class="flex items-start gap-2">
      <Input
        :model-value="row.address"
        class="font-mono text-xs"
        placeholder="198.51.100.1"
        @update:model-value="updateRow(index, { address: String($event) })"
      />
      <Input
        :model-value="row.port"
        class="w-28"
        type="number"
        min="1"
        max="65535"
        placeholder="53"
        @update:model-value="updateRow(index, { port: String($event) })"
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
      Add nameserver
    </Button>
  </div>
</template>
