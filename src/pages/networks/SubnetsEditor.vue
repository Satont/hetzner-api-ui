<script lang="ts">
export interface SubnetRow {
  type: 'cloud' | 'server' | 'vswitch'
  network_zone: string
  ip_range: string
  vswitch_id: string
}

export const NETWORK_ZONES = ['eu-central', 'us-east', 'us-west', 'ap-southeast'] as const

export function emptySubnetRow(): SubnetRow {
  return { type: 'cloud', network_zone: 'eu-central', ip_range: '', vswitch_id: '' }
}
</script>

<script setup lang="ts">
import { Plus, Trash2 } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

const rows = defineModel<SubnetRow[]>({ required: true })

function addRow() {
  rows.value = [...rows.value, emptySubnetRow()]
}

function removeRow(index: number) {
  rows.value = rows.value.filter((_, i) => i !== index)
}
</script>

<template>
  <div class="space-y-2">
    <div v-for="(row, index) in rows" :key="index" class="space-y-2 rounded-md border p-3">
      <div class="flex items-center gap-2">
        <Select v-model="row.type">
          <SelectTrigger class="w-32">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="cloud">cloud</SelectItem>
            <SelectItem value="server">server</SelectItem>
            <SelectItem value="vswitch">vswitch</SelectItem>
          </SelectContent>
        </Select>
        <Select v-model="row.network_zone">
          <SelectTrigger class="flex-1">
            <SelectValue placeholder="Network zone" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem v-for="zone in NETWORK_ZONES" :key="zone" :value="zone">{{ zone }}</SelectItem>
          </SelectContent>
        </Select>
        <Button type="button" variant="ghost" size="icon" @click="removeRow(index)">
          <Trash2 class="size-4" />
        </Button>
      </div>
      <div class="flex items-center gap-2">
        <Input v-model="row.ip_range" class="flex-1 font-mono text-xs" placeholder="IP range (optional, e.g. 10.0.1.0/24)" />
        <Input
          v-if="row.type === 'vswitch'"
          v-model="row.vswitch_id"
          class="w-32 font-mono text-xs"
          placeholder="vSwitch ID"
        />
      </div>
    </div>
    <Button type="button" variant="outline" size="sm" @click="addRow">
      <Plus class="mr-2 size-4" />
      Add subnet
    </Button>
  </div>
</template>
