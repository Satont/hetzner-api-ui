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
import StatusBadge from '@/components/shared/StatusBadge.vue'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

type ActionItem = ListItem<operations['get_actions'], 'actions'>
type StatusFilter = 'all' | ActionItem['status']
type SortValue = 'started:desc' | 'started:asc' | 'id:desc' | 'id:asc'

const { client, unwrap } = useApi()

// The global /actions endpoint requires one or more action IDs (arbitrary
// listing was removed from the API), so status/sort/pagination are applied
// client-side over the fetched set.
const idsInput = ref('')
const statusFilter = ref<StatusFilter>('all')
const sort = ref<SortValue>('started:desc')

function parseIds(): number[] {
  return idsInput.value
    .split(',')
    .map((part) => Number(part.trim()))
    .filter((n) => Number.isInteger(n) && n > 0)
}

const { items, loading, error, pageInfo, reload } = usePagedResource<ActionItem>(async ({ page, per_page }) => {
  const ids = parseIds()
  if (!ids.length) return { items: [], pagination: {} }
  const data = unwrap(await client().GET('/actions', { params: { query: { id: ids } } }))
  let actions = data.actions ?? []
  if (statusFilter.value !== 'all') actions = actions.filter((a) => a.status === statusFilter.value)
  const sorted = [...actions].sort((a, b) => {
    switch (sort.value) {
      case 'started:asc':
        return a.started.localeCompare(b.started)
      case 'started:desc':
        return b.started.localeCompare(a.started)
      case 'id:asc':
        return a.id - b.id
      case 'id:desc':
        return b.id - a.id
    }
  })
  const start = (page - 1) * per_page
  return {
    items: sorted.slice(start, start + per_page),
    pagination: {
      page,
      per_page,
      last_page: Math.max(1, Math.ceil(sorted.length / per_page)),
      total_entries: sorted.length,
    },
  }
})

watch([statusFilter, sort], () => {
  void reload(1)
})

// --- detail ---
const selected = ref<ActionItem | null>(null)
const detailOpen = ref(false)

function openDetail(action: ActionItem) {
  selected.value = action
  detailOpen.value = true
}

function formatDate(value: string | null | undefined): string | null {
  return value ? new Date(value).toLocaleString() : null
}
</script>

<template>
  <div class="space-y-4">
    <PageHeader
      title="Actions"
      description="Asynchronous operations on your resources. Enter action IDs to inspect them."
    >
      <Button variant="outline" size="sm" :disabled="loading" @click="reload()">
        <RefreshCw class="mr-2 size-4" />
        Refresh
      </Button>
    </PageHeader>

    <div class="flex flex-wrap items-center gap-3">
      <Input v-model="idsInput" class="w-[320px]" placeholder="Action IDs, comma separated (e.g. 123, 456)" @keydown.enter="reload(1)" />
      <Button variant="secondary" size="sm" :disabled="loading" @click="reload(1)">Load</Button>
      <Select v-model="statusFilter">
        <SelectTrigger class="w-[150px]">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All statuses</SelectItem>
          <SelectItem value="running">Running</SelectItem>
          <SelectItem value="success">Success</SelectItem>
          <SelectItem value="error">Error</SelectItem>
        </SelectContent>
      </Select>
      <Select v-model="sort">
        <SelectTrigger class="w-[160px]">
          <SelectValue placeholder="Sort" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="started:desc">Newest first</SelectItem>
          <SelectItem value="started:asc">Oldest first</SelectItem>
          <SelectItem value="id:desc">ID descending</SelectItem>
          <SelectItem value="id:asc">ID ascending</SelectItem>
        </SelectContent>
      </Select>
    </div>

    <ErrorState v-if="error" :error="error" @retry="reload()" />

    <div class="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Command</TableHead>
            <TableHead>Status</TableHead>
            <TableHead class="text-right">Progress</TableHead>
            <TableHead>Resources</TableHead>
            <TableHead>Started</TableHead>
            <TableHead>Finished</TableHead>
            <TableHead>Error</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <template v-if="loading">
            <TableRow v-for="i in 5" :key="i">
              <TableCell colspan="7"><Skeleton class="h-5 w-full" /></TableCell>
            </TableRow>
          </template>
          <TableRow v-else-if="!items.length">
            <TableCell colspan="7" class="py-8 text-center text-muted-foreground">
              Enter one or more action IDs above to load actions.
            </TableCell>
          </TableRow>
          <TableRow v-for="action in items" v-else :key="action.id" class="cursor-pointer" @click="openDetail(action)">
            <TableCell class="font-medium">{{ action.command }}</TableCell>
            <TableCell><StatusBadge :status="action.status" /></TableCell>
            <TableCell class="text-right">{{ action.progress }}%</TableCell>
            <TableCell>
              <div class="flex max-w-xs flex-wrap gap-1">
                <Badge v-for="resource in action.resources" :key="`${resource.type}-${resource.id}`" variant="outline" class="font-mono text-[10px]">
                  {{ resource.type }} #{{ resource.id }}
                </Badge>
                <span v-if="!action.resources.length" class="text-muted-foreground">—</span>
              </div>
            </TableCell>
            <TableCell class="text-muted-foreground">{{ formatDate(action.started) ?? '—' }}</TableCell>
            <TableCell class="text-muted-foreground">{{ formatDate(action.finished) ?? '—' }}</TableCell>
            <TableCell class="max-w-[200px] truncate text-destructive" :title="action.error?.message">
              {{ action.error?.message ?? '—' }}
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>

    <PaginationBar :page-info="pageInfo" :loading="loading" @change="reload" />

    <DetailSheet v-model:open="detailOpen" :title="selected?.command ?? 'Action'" :description="`Action #${selected?.id ?? ''}`">
      <Tabs v-if="selected" default-value="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="json">JSON</TabsTrigger>
        </TabsList>
        <TabsContent value="overview" class="mt-4 space-y-6">
          <KeyValue
            :items="[
              { label: 'ID', value: selected.id },
              { label: 'Command', value: selected.command },
              { label: 'Status', value: selected.status },
              { label: 'Progress', value: `${selected.progress}%` },
              { label: 'Started', value: formatDate(selected.started) },
              { label: 'Finished', value: formatDate(selected.finished) },
            ]"
          />
          <div v-if="selected.error" class="space-y-2">
            <h3 class="text-sm font-medium">Error</h3>
            <div class="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm">
              <p class="font-mono text-xs text-muted-foreground">{{ selected.error.code }}</p>
              <p class="mt-1 text-destructive">{{ selected.error.message }}</p>
            </div>
          </div>
          <div class="space-y-2">
            <h3 class="text-sm font-medium">Resources</h3>
            <div class="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead class="text-right">ID</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow v-for="resource in selected.resources" :key="`${resource.type}-${resource.id}`">
                    <TableCell>{{ resource.type }}</TableCell>
                    <TableCell class="text-right font-mono">{{ resource.id }}</TableCell>
                  </TableRow>
                  <TableRow v-if="!selected.resources.length">
                    <TableCell colspan="2" class="py-4 text-center text-muted-foreground">No resources.</TableCell>
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
