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

type Location = ListItem<operations['list_locations'], 'locations'>

const { client, unwrap } = useApi()

const { items, loading, error, pageInfo, reload } = usePagedResource<Location>(async ({ page, per_page }) => {
  const data = unwrap(await client().GET('/locations', { params: { query: { page, per_page } } }))
  return { items: data.locations ?? [], pagination: data.meta?.pagination ?? {} }
})

// --- detail ---
const selected = ref<Location | null>(null)
const detailOpen = ref(false)

function openDetail(location: Location) {
  selected.value = location
  detailOpen.value = true
}
</script>

<template>
  <div class="space-y-4">
    <PageHeader title="Locations" description="Physical locations where resources can be created.">
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
            <TableHead>City</TableHead>
            <TableHead>Country</TableHead>
            <TableHead>Network zone</TableHead>
            <TableHead class="text-right">Latitude</TableHead>
            <TableHead class="text-right">Longitude</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <template v-if="loading">
            <TableRow v-for="i in 5" :key="i">
              <TableCell colspan="7"><Skeleton class="h-5 w-full" /></TableCell>
            </TableRow>
          </template>
          <TableRow v-else-if="!items.length">
            <TableCell colspan="7" class="py-8 text-center text-muted-foreground">No locations.</TableCell>
          </TableRow>
          <TableRow v-for="location in items" v-else :key="location.id" class="cursor-pointer" @click="openDetail(location)">
            <TableCell class="font-medium">{{ location.name }}</TableCell>
            <TableCell>{{ location.description }}</TableCell>
            <TableCell>{{ location.city }}</TableCell>
            <TableCell><Badge variant="outline">{{ location.country }}</Badge></TableCell>
            <TableCell>{{ location.network_zone }}</TableCell>
            <TableCell class="text-right font-mono text-xs">{{ location.latitude }}</TableCell>
            <TableCell class="text-right font-mono text-xs">{{ location.longitude }}</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>

    <PaginationBar :page-info="pageInfo" :loading="loading" @change="reload" />

    <DetailSheet v-model:open="detailOpen" :title="selected?.name ?? 'Location'" description="Location details">
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
              { label: 'City', value: selected.city },
              { label: 'Country', value: selected.country },
              { label: 'Network zone', value: selected.network_zone },
              { label: 'Latitude', value: selected.latitude },
              { label: 'Longitude', value: selected.longitude },
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
