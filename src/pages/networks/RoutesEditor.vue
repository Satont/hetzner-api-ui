<script lang="ts">
export interface RouteRow {
  destination: string
  gateway: string
}

export function emptyRouteRow(): RouteRow {
  return { destination: '', gateway: '' }
}
</script>

<script setup lang="ts">
import { Plus, Trash2 } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

const rows = defineModel<RouteRow[]>({ required: true })

function addRow() {
  rows.value = [...rows.value, emptyRouteRow()]
}

function removeRow(index: number) {
  rows.value = rows.value.filter((_, i) => i !== index)
}
</script>

<template>
  <div class="space-y-2">
    <div v-for="(row, index) in rows" :key="index" class="flex items-center gap-2">
      <Input v-model="row.destination" class="flex-1 font-mono text-xs" placeholder="Destination (e.g. 10.100.1.0/24)" />
      <Input v-model="row.gateway" class="flex-1 font-mono text-xs" placeholder="Gateway (e.g. 10.0.1.1)" />
      <Button type="button" variant="ghost" size="icon" @click="removeRow(index)">
        <Trash2 class="size-4" />
      </Button>
    </div>
    <Button type="button" variant="outline" size="sm" @click="addRow">
      <Plus class="mr-2 size-4" />
      Add route
    </Button>
  </div>
</template>
