<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { RefreshCw } from 'lucide-vue-next'
import { useApi } from '@/composables/useApi'
import { usePagedResource, runAction } from '@/composables/usePagedResource'
import { parseLabels, labelsToText } from '@/lib/labels'
import { type ListItem, type RequestBody } from '@/api/client'
import type { operations } from '@/api/schema'
import PageHeader from '@/components/shared/PageHeader.vue'
import PaginationBar from '@/components/shared/PaginationBar.vue'
import ErrorState from '@/components/shared/ErrorState.vue'
import DetailSheet from '@/components/shared/DetailSheet.vue'
import ConfirmDialog from '@/components/shared/ConfirmDialog.vue'
import KeyValue from '@/components/shared/KeyValue.vue'
import LabelsBadges from '@/components/shared/LabelsBadges.vue'
import JsonBlock from '@/components/shared/JsonBlock.vue'
import StatusBadge from '@/components/shared/StatusBadge.vue'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'

type Image = ListItem<operations['list_images'], 'images'>
type ArchitectureFilter = 'all' | 'x86' | 'arm'
type TypeFilter = 'all' | Image['type']

const { client, unwrap } = useApi()

const archFilter = ref<ArchitectureFilter>('all')
const typeFilter = ref<TypeFilter>('all')

const { items, loading, error, pageInfo, reload } = usePagedResource<Image>(async ({ page, per_page }) => {
  const data = unwrap(
    await client().GET('/images', {
      params: {
        query: {
          page,
          per_page,
          architecture: archFilter.value === 'all' ? undefined : archFilter.value,
          type: typeFilter.value === 'all' ? undefined : [typeFilter.value],
          include_deprecated: true,
        },
      },
    }),
  )
  return { items: data.images ?? [], pagination: data.meta?.pagination ?? {} }
})

watch([archFilter, typeFilter], () => {
  void reload(1)
})

const typeVariants: Record<Image['type'], 'default' | 'secondary' | 'outline'> = {
  system: 'secondary',
  app: 'default',
  snapshot: 'default',
  backup: 'outline',
}

// --- detail / edit / delete ---
const selected = ref<Image | null>(null)
const detailOpen = ref(false)
const editDescription = ref('')
const editLabels = ref('')
const convertToSnapshot = ref(false)
const protectDelete = ref(false)

const isCustom = computed(() => selected.value?.type === 'snapshot' || selected.value?.type === 'backup')

function openDetail(image: Image) {
  selected.value = image
  editDescription.value = image.description ?? ''
  editLabels.value = labelsToText(image.labels)
  convertToSnapshot.value = false
  protectDelete.value = image.protection?.delete ?? false
  detailOpen.value = true
}

async function saveEdit() {
  const image = selected.value
  if (!image) return
  const body: RequestBody<operations['update_image']> = {
    description: editDescription.value.trim(),
    labels: parseLabels(editLabels.value),
  }
  if (image.type === 'backup' && convertToSnapshot.value) body.type = 'snapshot'
  const result = await runAction(async () => {
    return unwrap(await client().PUT('/images/{id}', { params: { path: { id: image.id } }, body }))
  }, 'Image updated')
  if (result !== undefined) {
    detailOpen.value = false
    void reload()
  }
}

async function onProtectionChange(value: boolean | 'indeterminate') {
  if (value === 'indeterminate') return
  const image = selected.value
  if (!image) return
  const result = await runAction(async () => {
    return unwrap(
      await client().POST('/images/{id}/actions/change_protection', {
        params: { path: { id: image.id } },
        body: { delete: value },
      }),
    )
  }, 'Protection updated')
  if (result !== undefined) {
    protectDelete.value = value
    if (selected.value) selected.value.protection.delete = value
    void reload()
  }
}

const deleteOpen = ref(false)

async function confirmDelete() {
  const image = selected.value
  if (!image) return
  const result = await runAction(async () => {
    await client().DELETE('/images/{id}', { params: { path: { id: image.id } } })
    return true
  }, 'Image deleted')
  if (result !== undefined) {
    deleteOpen.value = false
    detailOpen.value = false
    void reload()
  }
}

function formatDate(value: string | null | undefined): string | null {
  return value ? new Date(value).toLocaleString() : null
}
</script>

<template>
  <div class="space-y-4">
    <PageHeader title="Images" description="System, app, snapshot and backup images.">
      <Button variant="outline" size="sm" :disabled="loading" @click="reload()">
        <RefreshCw class="mr-2 size-4" />
        Refresh
      </Button>
    </PageHeader>

    <div class="flex flex-wrap items-center gap-3">
      <Select v-model="typeFilter">
        <SelectTrigger class="w-[160px]">
          <SelectValue placeholder="Type" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All types</SelectItem>
          <SelectItem value="system">System</SelectItem>
          <SelectItem value="app">App</SelectItem>
          <SelectItem value="snapshot">Snapshot</SelectItem>
          <SelectItem value="backup">Backup</SelectItem>
        </SelectContent>
      </Select>
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
            <TableHead>Name / Description</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Arch</TableHead>
            <TableHead>OS flavor</TableHead>
            <TableHead>OS version</TableHead>
            <TableHead class="text-right">Disk size</TableHead>
            <TableHead class="text-right">Image size</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Labels</TableHead>
            <TableHead>Created</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <template v-if="loading">
            <TableRow v-for="i in 5" :key="i">
              <TableCell colspan="10"><Skeleton class="h-5 w-full" /></TableCell>
            </TableRow>
          </template>
          <TableRow v-else-if="!items.length">
            <TableCell colspan="10" class="py-8 text-center text-muted-foreground">No images.</TableCell>
          </TableRow>
          <TableRow v-for="image in items" v-else :key="image.id" class="cursor-pointer" @click="openDetail(image)">
            <TableCell>
              <div class="font-medium">{{ image.name ?? '—' }}</div>
              <div class="max-w-xs truncate text-xs text-muted-foreground" :title="image.description">{{ image.description }}</div>
            </TableCell>
            <TableCell><Badge :variant="typeVariants[image.type]">{{ image.type }}</Badge></TableCell>
            <TableCell><Badge variant="outline">{{ image.architecture }}</Badge></TableCell>
            <TableCell>{{ image.os_flavor }}</TableCell>
            <TableCell>{{ image.os_version ?? '—' }}</TableCell>
            <TableCell class="text-right">{{ image.disk_size }} GB</TableCell>
            <TableCell class="text-right">{{ image.image_size !== null ? `${image.image_size} GB` : '—' }}</TableCell>
            <TableCell><StatusBadge :status="image.status" /></TableCell>
            <TableCell><LabelsBadges :labels="image.labels" /></TableCell>
            <TableCell class="text-muted-foreground">{{ formatDate(image.created) ?? '—' }}</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>

    <PaginationBar :page-info="pageInfo" :loading="loading" @change="reload" />

    <DetailSheet v-model:open="detailOpen" :title="selected?.name ?? selected?.description ?? 'Image'" description="Image details">
      <Tabs v-if="selected" default-value="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger v-if="isCustom" value="edit">Edit</TabsTrigger>
          <TabsTrigger value="json">JSON</TabsTrigger>
        </TabsList>
        <TabsContent value="overview" class="mt-4">
          <KeyValue
            :items="[
              { label: 'ID', value: selected.id },
              { label: 'Name', value: selected.name },
              { label: 'Description', value: selected.description },
              { label: 'Type', value: selected.type },
              { label: 'Status', value: selected.status },
              { label: 'Architecture', value: selected.architecture },
              { label: 'OS flavor', value: selected.os_flavor },
              { label: 'OS version', value: selected.os_version },
              { label: 'Disk size', value: `${selected.disk_size} GB` },
              { label: 'Image size', value: selected.image_size !== null ? `${selected.image_size} GB` : null },
              {
                label: 'Created from',
                value: selected.created_from ? `${selected.created_from.name} (#${selected.created_from.id})` : null,
              },
              { label: 'Bound to server', value: selected.bound_to !== null ? `#${selected.bound_to}` : null },
              { label: 'Rapid deploy', value: selected.rapid_deploy ? 'Yes' : 'No' },
              { label: 'Delete protection', value: selected.protection?.delete ? 'Enabled' : 'Disabled' },
              { label: 'Deprecated', value: formatDate(selected.deprecated) },
              { label: 'Created', value: formatDate(selected.created) },
            ]"
          />
        </TabsContent>
        <TabsContent v-if="isCustom" value="edit" class="mt-4">
          <form class="space-y-4" @submit.prevent="saveEdit">
            <div class="space-y-2">
              <Label for="img-edit-description">Description</Label>
              <Input id="img-edit-description" v-model="editDescription" />
            </div>
            <div class="space-y-2">
              <Label for="img-edit-labels">Labels (one key=value per line)</Label>
              <Textarea id="img-edit-labels" v-model="editLabels" rows="3" class="font-mono text-xs" />
            </div>
            <div v-if="selected.type === 'backup'" class="flex items-center gap-2">
              <Checkbox id="img-convert" v-model="convertToSnapshot" />
              <Label for="img-convert">Convert backup to snapshot (irreversible)</Label>
            </div>
            <div v-if="selected.type === 'snapshot'" class="flex items-center gap-2 rounded-md border p-3">
              <Checkbox
                id="img-protect"
                :model-value="protectDelete"
                @update:model-value="onProtectionChange"
              />
              <Label for="img-protect">Protect snapshot from deletion</Label>
            </div>
            <div class="flex items-center justify-between">
              <Button type="button" variant="destructive" @click="deleteOpen = true">Delete</Button>
              <Button type="submit">Save</Button>
            </div>
          </form>
        </TabsContent>
        <TabsContent value="json" class="mt-4">
          <JsonBlock :data="selected" />
        </TabsContent>
      </Tabs>
    </DetailSheet>

    <ConfirmDialog
      v-model:open="deleteOpen"
      title="Delete image?"
      :description="`This will permanently delete '${selected?.name ?? selected?.description}'.`"
      confirm-label="Delete"
      destructive
      @confirm="confirmDelete"
    />
  </div>
</template>
