<script setup lang="ts">
import { ref } from 'vue'
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
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

type Datacenter = ListItem<operations['list_datacenters'], 'datacenters'>

const { client, unwrap } = useApi()

const { items, loading, error, pageInfo, reload } = usePagedResource<Datacenter>(async ({ page, per_page }) => {
  const data = unwrap(await client().GET('/datacenters', { params: { query: { page, per_page } } }))
  return { items: data.datacenters ?? [], pagination: data.meta?.pagination ?? {} }
})

// --- detail ---
const selected = ref<Datacenter | null>(null)
const detailOpen = ref(false)

function openDetail(datacenter: Datacenter) {
  selected.value = datacenter
  detailOpen.value = true
}
</script>

<template>
  <div class="space-y-4">
    <PageHeader title="Datacenters" description="Datacenters and the server types they support.">
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
            <TableHead>Location</TableHead>
            <TableHead>City</TableHead>
            <TableHead>Server types</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <template v-if="loading">
            <TableRow v-for="i in 5" :key="i">
              <TableCell colspan="5"><Skeleton class="h-5 w-full" /></TableCell>
            </TableRow>
          </template>
          <TableRow v-else-if="!items.length">
            <TableCell colspan="5" class="py-8 text-center text-muted-foreground">No datacenters.</TableCell>
          </TableRow>
          <TableRow v-for="dc in items" v-else :key="dc.id" class="cursor-pointer" @click="openDetail(dc)">
            <TableCell class="font-medium">{{ dc.name }}</TableCell>
            <TableCell>{{ dc.description }}</TableCell>
            <TableCell><Badge variant="outline">{{ dc.location.name }}</Badge></TableCell>
            <TableCell>{{ dc.location.city }}</TableCell>
            <TableCell class="text-muted-foreground">
              {{ dc.server_types.supported.length }} supported · {{ dc.server_types.available.length }} available
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>

    <PaginationBar :page-info="pageInfo" :loading="loading" @change="reload" />

    <DetailSheet v-model:open="detailOpen" :title="selected?.name ?? 'Datacenter'" description="Datacenter details">
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
              { label: 'Location', value: `${selected.location.name} — ${selected.location.city}, ${selected.location.country}` },
              { label: 'Network zone', value: selected.location.network_zone },
            ]"
          />
          <div class="space-y-2">
            <h3 class="text-sm font-medium">Supported server type IDs</h3>
            <div class="flex flex-wrap gap-1">
              <Badge v-for="id in selected.server_types.supported" :key="id" variant="secondary">{{ id }}</Badge>
              <span v-if="!selected.server_types.supported.length" class="text-sm text-muted-foreground">None</span>
            </div>
          </div>
          <div class="space-y-2">
            <h3 class="text-sm font-medium">Available server type IDs</h3>
            <div class="flex flex-wrap gap-1">
              <Badge v-for="id in selected.server_types.available" :key="id" variant="secondary">{{ id }}</Badge>
              <span v-if="!selected.server_types.available.length" class="text-sm text-muted-foreground">None</span>
            </div>
          </div>
          <div class="space-y-2">
            <h3 class="text-sm font-medium">Available for migration (server type IDs)</h3>
            <div class="flex flex-wrap gap-1">
              <Badge v-for="id in selected.server_types.available_for_migration" :key="id" variant="secondary">{{ id }}</Badge>
              <span v-if="!selected.server_types.available_for_migration.length" class="text-sm text-muted-foreground">None</span>
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
