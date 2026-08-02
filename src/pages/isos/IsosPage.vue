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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

type Iso = ListItem<operations['list_isos'], 'isos'>
type ArchitectureFilter = 'all' | 'x86' | 'arm'

const { client, unwrap } = useApi()

const nameFilter = ref('')
const archFilter = ref<ArchitectureFilter>('all')

const { items, loading, error, pageInfo, reload } = usePagedResource<Iso>(async ({ page, per_page }) => {
  const data = unwrap(
    await client().GET('/isos', {
      params: {
        query: {
          page,
          per_page,
          name: nameFilter.value.trim() || undefined,
          architecture: archFilter.value === 'all' ? undefined : archFilter.value,
        },
      },
    }),
  )
  return { items: data.isos ?? [], pagination: data.meta?.pagination ?? {} }
})

let nameTimer: ReturnType<typeof setTimeout> | undefined
watch(nameFilter, () => {
  clearTimeout(nameTimer)
  nameTimer = setTimeout(() => {
    void reload(1)
  }, 300)
})
watch(archFilter, () => {
  void reload(1)
})

// --- detail ---
const selected = ref<Iso | null>(null)
const detailOpen = ref(false)

function openDetail(iso: Iso) {
  selected.value = iso
  detailOpen.value = true
}

function formatDate(value: string | null | undefined): string | null {
  return value ? new Date(value).toLocaleString() : null
}
</script>

<template>
  <div class="space-y-4">
    <PageHeader title="ISOs" description="Bootable ISO images available for servers.">
      <Button variant="outline" size="sm" :disabled="loading" @click="reload()">
        <RefreshCw class="mr-2 size-4" />
        Refresh
      </Button>
    </PageHeader>

    <div class="flex flex-wrap items-center gap-3">
      <Input v-model="nameFilter" class="w-[240px]" placeholder="Filter by exact name…" />
      <Select v-model="archFilter">
        <SelectTrigger class="w-[160px]">
          <SelectValue placeholder="Architecture" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All architectures</SelectItem>
          <SelectItem value="x86">x86</SelectItem>
          <SelectItem value="arm">arm</SelectItem>
        </SelectContent>
      </Select>
    </div>

    <ErrorState v-if="error" :error="error" @retry="reload()" />

    <div class="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Description</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Arch</TableHead>
            <TableHead>Deprecated</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <template v-if="loading">
            <TableRow v-for="i in 5" :key="i">
              <TableCell colspan="5"><Skeleton class="h-5 w-full" /></TableCell>
            </TableRow>
          </template>
          <TableRow v-else-if="!items.length">
            <TableCell colspan="5" class="py-8 text-center text-muted-foreground">No ISOs.</TableCell>
          </TableRow>
          <TableRow v-for="iso in items" v-else :key="iso.id" class="cursor-pointer" @click="openDetail(iso)">
            <TableCell class="font-medium">{{ iso.name ?? '—' }}</TableCell>
            <TableCell class="max-w-md truncate" :title="iso.description">{{ iso.description }}</TableCell>
            <TableCell>
              <Badge :variant="iso.type === 'private' ? 'secondary' : 'default'">{{ iso.type ?? '—' }}</Badge>
            </TableCell>
            <TableCell><Badge variant="outline">{{ iso.architecture ?? 'any' }}</Badge></TableCell>
            <TableCell>
              <Badge v-if="iso.deprecation" variant="destructive">Deprecated</Badge>
              <span v-else class="text-muted-foreground">—</span>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>

    <PaginationBar :page-info="pageInfo" :loading="loading" @change="reload" />

    <DetailSheet v-model:open="detailOpen" :title="selected?.name ?? 'ISO'" description="ISO details">
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
              { label: 'Type', value: selected.type },
              { label: 'Architecture', value: selected.architecture ?? 'any (wildcard)' },
              {
                label: 'Deprecated since',
                value: selected.deprecation ? formatDate(selected.deprecation.announced) : null,
              },
              {
                label: 'Unavailable after',
                value: selected.deprecation ? formatDate(selected.deprecation.unavailable_after) : null,
              },
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
