<script setup lang="ts">
import { ref } from 'vue'
import { Plus, RefreshCw } from 'lucide-vue-next'
import { useApi } from '@/composables/useApi'
import { usePagedResource, runAction } from '@/composables/usePagedResource'
import { parseLabels, labelsToText } from '@/lib/labels'
import type { ListItem } from '@/api/client'
import type { operations } from '@/api/schema'
import PageHeader from '@/components/shared/PageHeader.vue'
import PaginationBar from '@/components/shared/PaginationBar.vue'
import ErrorState from '@/components/shared/ErrorState.vue'
import DetailSheet from '@/components/shared/DetailSheet.vue'
import ConfirmDialog from '@/components/shared/ConfirmDialog.vue'
import KeyValue from '@/components/shared/KeyValue.vue'
import LabelsBadges from '@/components/shared/LabelsBadges.vue'
import JsonBlock from '@/components/shared/JsonBlock.vue'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'

type PlacementGroup = ListItem<operations['list_placement_groups'], 'placement_groups'>

const { client, unwrap } = useApi()

const { items, loading, error, pageInfo, reload } = usePagedResource<PlacementGroup>(async ({ page, per_page }) => {
  const data = unwrap(await client().GET('/placement_groups', { params: { query: { page, per_page } } }))
  return { items: data.placement_groups ?? [], pagination: data.meta?.pagination ?? {} }
})

// --- create ---
const createOpen = ref(false)
const createName = ref('')
const createType = ref<'spread'>('spread')
const createLabels = ref('')
const creating = ref(false)

async function submitCreate() {
  creating.value = true
  const result = await runAction(async () => {
    const labels = parseLabels(createLabels.value)
    return unwrap(
      await client().POST('/placement_groups', {
        body: {
          name: createName.value.trim(),
          type: createType.value,
          ...(Object.keys(labels).length ? { labels } : {}),
        },
      }),
    )
  }, 'Placement group created')
  creating.value = false
  if (result !== undefined) {
    createOpen.value = false
    createName.value = ''
    createType.value = 'spread'
    createLabels.value = ''
    void reload()
  }
}

// --- detail / edit / delete ---
const selected = ref<PlacementGroup | null>(null)
const detailOpen = ref(false)
const editName = ref('')
const editLabels = ref('')

function openDetail(group: PlacementGroup) {
  selected.value = group
  editName.value = group.name ?? ''
  editLabels.value = labelsToText(group.labels)
  detailOpen.value = true
}

async function saveEdit() {
  const group = selected.value
  if (!group?.id) return
  const result = await runAction(async () => {
    return unwrap(
      await client().PUT('/placement_groups/{id}', {
        params: { path: { id: group.id! } },
        body: { name: editName.value.trim(), labels: parseLabels(editLabels.value) },
      }),
    )
  }, 'Placement group updated')
  if (result !== undefined) {
    detailOpen.value = false
    void reload()
  }
}

const deleteOpen = ref(false)

async function confirmDelete() {
  const group = selected.value
  if (!group?.id) return
  const result = await runAction(async () => {
    await client().DELETE('/placement_groups/{id}', { params: { path: { id: group.id! } } })
    return true
  }, 'Placement group deleted')
  if (result !== undefined) {
    deleteOpen.value = false
    detailOpen.value = false
    void reload()
  }
}
</script>

<template>
  <div class="space-y-4">
    <PageHeader title="Placement Groups" description="Spread servers across physical hardware.">
      <Button variant="outline" size="sm" :disabled="loading" @click="reload()">
        <RefreshCw class="mr-2 size-4" />
        Refresh
      </Button>
      <Button size="sm" @click="createOpen = true">
        <Plus class="mr-2 size-4" />
        Add placement group
      </Button>
    </PageHeader>

    <ErrorState v-if="error" :error="error" @retry="reload()" />

    <div class="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Servers</TableHead>
            <TableHead>Labels</TableHead>
            <TableHead>Created</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <template v-if="loading">
            <TableRow v-for="i in 5" :key="i">
              <TableCell colspan="5"><Skeleton class="h-5 w-full" /></TableCell>
            </TableRow>
          </template>
          <TableRow v-else-if="!items.length">
            <TableCell colspan="5" class="py-8 text-center text-muted-foreground">No placement groups.</TableCell>
          </TableRow>
          <TableRow v-for="group in items" v-else :key="group.id" class="cursor-pointer" @click="openDetail(group)">
            <TableCell class="font-medium">{{ group.name }}</TableCell>
            <TableCell><Badge variant="outline">{{ group.type }}</Badge></TableCell>
            <TableCell>{{ group.servers?.length ?? 0 }}</TableCell>
            <TableCell><LabelsBadges :labels="group.labels" /></TableCell>
            <TableCell class="text-muted-foreground">{{ group.created ? new Date(group.created).toLocaleString() : '—' }}</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>

    <PaginationBar :page-info="pageInfo" :loading="loading" @change="reload" />

    <Dialog v-model:open="createOpen">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add placement group</DialogTitle>
          <DialogDescription>Servers in a spread group are placed on different physical hosts.</DialogDescription>
        </DialogHeader>
        <form class="space-y-4" @submit.prevent="submitCreate">
          <div class="space-y-2">
            <Label for="pg-name">Name</Label>
            <Input id="pg-name" v-model="createName" required />
          </div>
          <div class="space-y-2">
            <Label for="pg-type">Type</Label>
            <Select v-model="createType">
              <SelectTrigger id="pg-type">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="spread">spread</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div class="space-y-2">
            <Label for="pg-labels">Labels (one key=value per line)</Label>
            <Textarea id="pg-labels" v-model="createLabels" rows="2" class="font-mono text-xs" />
          </div>
          <DialogFooter>
            <Button type="submit" :disabled="creating">Create</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>

    <DetailSheet v-model:open="detailOpen" :title="selected?.name ?? 'Placement group'" description="Placement group details">
      <Tabs v-if="selected" default-value="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="edit">Edit</TabsTrigger>
          <TabsTrigger value="json">JSON</TabsTrigger>
        </TabsList>
        <TabsContent value="overview" class="mt-4">
          <KeyValue
            :items="[
              { label: 'ID', value: selected.id },
              { label: 'Name', value: selected.name },
              { label: 'Type', value: selected.type },
              { label: 'Servers', value: selected.servers?.length ?? 0 },
              { label: 'Created', value: selected.created ? new Date(selected.created).toLocaleString() : null },
            ]"
          />
        </TabsContent>
        <TabsContent value="edit" class="mt-4">
          <form class="space-y-4" @submit.prevent="saveEdit">
            <div class="space-y-2">
              <Label for="pg-edit-name">Name</Label>
              <Input id="pg-edit-name" v-model="editName" required />
            </div>
            <div class="space-y-2">
              <Label for="pg-edit-labels">Labels</Label>
              <Textarea id="pg-edit-labels" v-model="editLabels" rows="3" class="font-mono text-xs" />
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
      title="Delete placement group?"
      :description="`This will permanently delete '${selected?.name}'. Servers stay untouched.`"
      confirm-label="Delete"
      destructive
      @confirm="confirmDelete"
    />
  </div>
</template>
