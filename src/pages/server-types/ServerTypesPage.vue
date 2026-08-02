<script setup lang="ts">
import { ref, watch } from 'vue'
import { RefreshCw } from 'lucide-vue-next'
import { useApi } from '@/composables/useApi'
import { usePagedResource } from '@/composables/usePagedResource'
import type { ListItem } from '@/api/client'
import type { operations } from '@/api/schema'
import PageHeader from '@/components/shared/PageHeader.vue'
import PaginationBar from '@/components/shared/PaginationBar.vue'
import ErrorState from '@/components/shared/ErrorState.vue'
import DetailSheet from '@/components/shared/DetailSheet.vue'
import KeyValue from '@/components/shared/KeyValue.vue'
import JsonBlock from '@/components/shared/JsonBlock.vue'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

type ServerType = ListItem<operations['list_server_types'], 'server_types'>

const { client, unwrap } = useApi()

const nameFilter = ref('')

const { items, loading, error, pageInfo, reload } = usePagedResource<ServerType>(async ({ page, per_page }) => {
  const data = unwrap(
    await client().GET('/server_types', {
      params: { query: { page, per_page, name: nameFilter.value.trim() || undefined } },
    }),
  )
  return { items: data.server_types ?? [], pagination: data.meta?.pagination ?? {} }
})

let nameTimer: ReturnType<typeof setTimeout> | undefined
watch(nameFilter, () => {
  clearTimeout(nameTimer)
  nameTimer = setTimeout(() => {
    void reload(1)
  }, 300)
})

// Server type prices carry no currency field; the Hetzner Cloud API prices in EUR.
const priceFormatter = new Intl.NumberFormat(undefined, { style: 'currency', currency: 'EUR' })
function fmtPrice(value: string): string {
  return priceFormatter.format(Number(value))
}

function fmtTraffic(bytes: number): string {
  const tb = bytes / 1099511627776
  return `${Number.isInteger(tb) ? tb : tb.toFixed(1)} TB`
}

// --- detail ---
const selected = ref<ServerType | null>(null)
const detailOpen = ref(false)

function openDetail(serverType: ServerType) {
  selected.value = serverType
  detailOpen.value = true
}
</script>

<template>
  <div class="space-y-4">
    <PageHeader title="Server Types" description="Available server configurations and their per-location prices.">
      <Button variant="outline" size="sm" :disabled="loading" @click="reload()">
        <RefreshCw class="mr-2 size-4" />
        Refresh
      </Button>
    </PageHeader>

    <div class="flex flex-wrap items-center gap-3">
      <Input v-model="nameFilter" class="w-[240px]" placeholder="Filter by exact name…" />
    </div>

    <ErrorState v-if="error" :error="error" @retry="reload()" />

    <div class="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Description</TableHead>
            <TableHead class="text-right">Cores</TableHead>
            <TableHead class="text-right">Memory</TableHead>
            <TableHead class="text-right">Disk</TableHead>
            <TableHead>Arch</TableHead>
            <TableHead>CPU</TableHead>
            <TableHead>Storage</TableHead>
            <TableHead>Deprecated</TableHead>
            <TableHead>Prices (net)</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <template v-if="loading">
            <TableRow v-for="i in 5" :key="i">
              <TableCell colspan="10"><Skeleton class="h-5 w-full" /></TableCell>
            </TableRow>
          </template>
          <TableRow v-else-if="!items.length">
            <TableCell colspan="10" class="py-8 text-center text-muted-foreground">No server types.</TableCell>
          </TableRow>
          <TableRow v-for="st in items" v-else :key="st.id" class="cursor-pointer" @click="openDetail(st)">
            <TableCell class="font-medium">{{ st.name }}</TableCell>
            <TableCell class="max-w-[200px] truncate" :title="st.description">{{ st.description }}</TableCell>
            <TableCell class="text-right">{{ st.cores }}</TableCell>
            <TableCell class="text-right">{{ st.memory }} GB</TableCell>
            <TableCell class="text-right">{{ st.disk }} GB</TableCell>
            <TableCell><Badge variant="outline">{{ st.architecture }}</Badge></TableCell>
            <TableCell>{{ st.cpu_type }}</TableCell>
            <TableCell>{{ st.storage_type }}</TableCell>
            <TableCell>
              <Badge v-if="st.deprecated" variant="destructive">Deprecated</Badge>
              <span v-else class="text-muted-foreground">—</span>
            </TableCell>
            <TableCell>
              <div class="space-y-0.5 text-xs">
                <div v-for="price in st.prices" :key="price.location" class="whitespace-nowrap">
                  <span class="font-mono text-muted-foreground">{{ price.location }}</span>
                  {{ fmtPrice(price.price_hourly.net) }}/h · {{ fmtPrice(price.price_monthly.net) }}/mo
                </div>
              </div>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>

    <PaginationBar :page-info="pageInfo" :loading="loading" @change="reload" />

    <DetailSheet v-model:open="detailOpen" :title="selected?.name ?? 'Server type'" description="Server type details">
      <Tabs v-if="selected" default-value="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="json">JSON</TabsTrigger>
        </TabsList>
        <TabsContent value="overview" class="mt-4 space-y-6">
          <KeyValue
            :items="[
              { label: 'ID', value: selected.id },
              { label: 'Name', value: selected.name },
              { label: 'Description', value: selected.description },
              { label: 'Cores', value: selected.cores },
              { label: 'Memory', value: `${selected.memory} GB` },
              { label: 'Disk', value: `${selected.disk} GB` },
              { label: 'Architecture', value: selected.architecture },
              { label: 'CPU type', value: selected.cpu_type },
              { label: 'Storage type', value: selected.storage_type },
              { label: 'Category', value: selected.category },
              { label: 'Deprecated', value: selected.deprecated ? 'Yes' : 'No' },
            ]"
          />
          <div class="space-y-2">
            <h3 class="text-sm font-medium">Prices per location</h3>
            <div class="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Location</TableHead>
                    <TableHead class="text-right">Hourly net</TableHead>
                    <TableHead class="text-right">Hourly gross</TableHead>
                    <TableHead class="text-right">Monthly net</TableHead>
                    <TableHead class="text-right">Monthly gross</TableHead>
                    <TableHead class="text-right">Included traffic</TableHead>
                    <TableHead class="text-right">Per extra TB</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow v-for="price in selected.prices" :key="price.location">
                    <TableCell class="font-mono">{{ price.location }}</TableCell>
                    <TableCell class="text-right">{{ fmtPrice(price.price_hourly.net) }}</TableCell>
                    <TableCell class="text-right">{{ fmtPrice(price.price_hourly.gross) }}</TableCell>
                    <TableCell class="text-right">{{ fmtPrice(price.price_monthly.net) }}</TableCell>
                    <TableCell class="text-right">{{ fmtPrice(price.price_monthly.gross) }}</TableCell>
                    <TableCell class="text-right">{{ fmtTraffic(price.included_traffic) }}</TableCell>
                    <TableCell class="text-right">{{ fmtPrice(price.price_per_tb_traffic.net) }}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </div>
        </TabsContent>
        <TabsContent value="json" class="mt-4">
          <JsonBlock :data="selected" />
        </TabsContent>
      </Tabs>
    </DetailSheet>
  </div>
</template>
