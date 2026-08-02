<script lang="ts">
import type { ListItem, RequestBody } from '@/api/client'
import type { operations } from '@/api/schema'

export type FirewallRuleInput = RequestBody<operations['set_firewall_rules']>['rules'][number]
export type FirewallRule = ListItem<operations['list_firewalls'], 'firewalls'>['rules'][number]

export interface FirewallRuleRow {
  direction: 'in' | 'out'
  protocol: 'tcp' | 'udp' | 'icmp' | 'esp' | 'gre'
  port: string
  ips: string
  description: string
}

export function emptyRuleRow(): FirewallRuleRow {
  return { direction: 'in', protocol: 'tcp', port: '', ips: '0.0.0.0/0, ::/0', description: '' }
}

function parseIps(text: string): string[] {
  return text
    .split(',')
    .map((ip) => ip.trim())
    .filter(Boolean)
}

export function rowsToRules(rows: FirewallRuleRow[]): FirewallRuleInput[] {
  return rows.map((row) => {
    const ips = parseIps(row.ips)
    const rule: FirewallRuleInput = {
      direction: row.direction,
      protocol: row.protocol,
      ...(row.direction === 'in' ? { source_ips: ips } : { destination_ips: ips }),
    }
    if ((row.protocol === 'tcp' || row.protocol === 'udp') && row.port.trim()) rule.port = row.port.trim()
    if (row.description.trim()) rule.description = row.description.trim()
    return rule
  })
}

export function rulesToRows(rules: FirewallRule[]): FirewallRuleRow[] {
  return rules.map((rule) => ({
    direction: rule.direction,
    protocol: rule.protocol,
    port: rule.port ?? '',
    ips: (rule.direction === 'in' ? rule.source_ips : rule.destination_ips).join(', '),
    description: rule.description ?? '',
  }))
}
</script>

<script setup lang="ts">
import { Plus, Trash2 } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

const rows = defineModel<FirewallRuleRow[]>({ required: true })

const PROTOCOLS: FirewallRuleRow['protocol'][] = ['tcp', 'udp', 'icmp', 'esp', 'gre']

function addRow() {
  rows.value = [...rows.value, emptyRuleRow()]
}

function removeRow(index: number) {
  rows.value = rows.value.filter((_, i) => i !== index)
}
</script>

<template>
  <div class="space-y-2">
    <div v-for="(row, index) in rows" :key="index" class="space-y-2 rounded-md border p-3">
      <div class="flex items-center gap-2">
        <Select v-model="row.direction">
          <SelectTrigger class="w-24">
            <SelectValue placeholder="Direction" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="in">in</SelectItem>
            <SelectItem value="out">out</SelectItem>
          </SelectContent>
        </Select>
        <Select v-model="row.protocol">
          <SelectTrigger class="w-28">
            <SelectValue placeholder="Protocol" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem v-for="protocol in PROTOCOLS" :key="protocol" :value="protocol">{{ protocol }}</SelectItem>
          </SelectContent>
        </Select>
        <Input
          v-model="row.port"
          class="w-28 font-mono text-xs"
          placeholder="Port"
          :disabled="row.protocol !== 'tcp' && row.protocol !== 'udp'"
        />
        <Button type="button" variant="ghost" size="icon" @click="removeRow(index)">
          <Trash2 class="size-4" />
        </Button>
      </div>
      <Input
        v-model="row.ips"
        class="font-mono text-xs"
        :placeholder="row.direction === 'in' ? 'Source IPs, comma-separated' : 'Destination IPs, comma-separated'"
      />
      <Input v-model="row.description" placeholder="Description (optional)" />
    </div>
    <p v-if="!rows.length" class="text-sm text-muted-foreground">No rules.</p>
    <Button type="button" variant="outline" size="sm" @click="addRow">
      <Plus class="mr-2 size-4" />
      Add rule
    </Button>
  </div>
</template>
