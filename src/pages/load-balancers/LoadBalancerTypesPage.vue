<script setup lang="ts">
import { ref } from 'vue'
import { RefreshCw } from 'lucide-vue-next'
import { useApi } from '@/composables/useApi'
import { ApiError } from '@/api/client'
import type { ListItem } from '@/api/client'
import type { operations } from '@/api/schema'
import PageHeader from '@/components/shared/PageHeader.vue'
import ErrorState from '@/components/shared/ErrorState.vue'
import DetailSheet from '@/components/shared/DetailSheet.vue'
import KeyValue from '@/components/shared/KeyValue.vue'
import JsonBlock from '@/components/shared/JsonBlock.vue'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

type LBType = ListItem<operations['list_load_balancer_types'], 'load_balancer_types'>

const { client, unwrap } = useApi()

const items = ref<LBType[]>([])
const loading = ref(false)
const error = ref<string | null>(null)

async function reload() {
  loading.value = true
  error.value = null
  try {
    const data = unwrap(await client().GET('/load_balancer_types', {}))
    items.value = data.load_balancer_types ?? []
  } catch (e) {
    error.value = e instanceof ApiError ? e.message : String(e)
    items.value = []
  } finally {
    loading.value = false
  }
}

void reload()

const selected = ref<LBType | null>(null)
const detailOpen = ref(false)

function openDetail(t: LBType) {
  selected.value = t
  detailOpen.value = true
}

function priceSummary(t: LBType): string {
  if (!t.prices.length) return '—'
  return t.prices.map((p) => `${p.location}: ${p.price_monthly.gross}/mo`).join(', ')
}
</script>

<template>
  <div class="space-y-4">
    <PageHeader title="Load Balancer Types" description="Available Load Balancer sizes and limits.">
      <Button variant="outline" size="sm" :disabled="loading" @click="reload()">
        <RefreshCw class="mr-2 size-4" />
        Refresh
      </Button>
    </PageHeader>

    <ErrorState v-if="error" :error="error" @retry="reload()" />

    <div class="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Description</TableHead>
            <TableHead>Max services</TableHead>
            <TableHead>Max connections</TableHead>
            <TableHead>Max targets</TableHead>
            <TableHead>Max certificates</TableHead>
            <TableHead>Prices</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <template v-if="loading">
            <TableRow v-for="i in 3" :key="i">
              <TableCell colspan="7"><Skeleton class="h-5 w-full" /></TableCell>
            </TableRow>
          </template>
          <TableRow v-else-if="!items.length">
            <TableCell colspan="7" class="py-8 text-center text-muted-foreground">No Load Balancer types.</TableCell>
          </TableRow>
          <TableRow v-for="t in items" v-else :key="t.id" class="cursor-pointer" @click="openDetail(t)">
            <TableCell class="font-medium">{{ t.name }}</TableCell>
            <TableCell>{{ t.description }}</TableCell>
            <TableCell>{{ t.max_services }}</TableCell>
            <TableCell>{{ t.max_connections.toLocaleString() }}</TableCell>
            <TableCell>{{ t.max_targets }}</TableCell>
            <TableCell>{{ t.max_assigned_certificates }}</TableCell>
            <TableCell class="max-w-xs truncate text-xs text-muted-foreground" :title="priceSummary(t)">
              {{ priceSummary(t) }}
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>

    <DetailSheet v-model:open="detailOpen" :title="selected?.name ?? 'Load Balancer type'" description="Load Balancer type details">
      <Tabs v-if="selected" default-value="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="json">JSON</TabsTrigger>
        </TabsList>
        <TabsContent value="overview" class="mt-4">
          <KeyValue
            :items="[
              { label: 'ID', value: selected.id },
              { label: 'Name', value: selected.name },
              { label: 'Description', value: selected.description },
              { label: 'Max services', value: selected.max_services },
              { label: 'Max connections', value: selected.max_connections.toLocaleString() },
              { label: 'Max targets', value: selected.max_targets },
              { label: 'Max assigned certificates', value: selected.max_assigned_certificates },
              {
                label: 'Deprecated',
                value: selected.deprecation
                  ? `announced ${new Date(selected.deprecation.announced).toLocaleDateString()}, unavailable after ${new Date(selected.deprecation.unavailable_after).toLocaleDateString()}`
                  : null,
              },
              { label: 'Prices', value: priceSummary(selected) !== '—' ? priceSummary(selected) : null },
            ]"
          />
        </TabsContent>
        <TabsContent value="json" class="mt-4">
          <JsonBlock :data="selected" />
        </TabsContent>
      </Tabs>
    </DetailSheet>
  </div>
</template>
