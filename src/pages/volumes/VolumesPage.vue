<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { MoreHorizontal, Plus, RefreshCw } from 'lucide-vue-next'
import { useApi } from '@/composables/useApi'
import { usePagedResource, runAction } from '@/composables/usePagedResource'
import { usePricing } from '@/composables/usePricing'
import { parseLabels, labelsToText } from '@/lib/labels'
import { formatHourly, formatMonthly } from '@/lib/price'
import type { ListItem, RequestBody } from '@/api/client'
import type { operations } from '@/api/schema'
import PageHeader from '@/components/shared/PageHeader.vue'
import PaginationBar from '@/components/shared/PaginationBar.vue'
import ErrorState from '@/components/shared/ErrorState.vue'
import DetailSheet from '@/components/shared/DetailSheet.vue'
import ConfirmDialog from '@/components/shared/ConfirmDialog.vue'
import KeyValue from '@/components/shared/KeyValue.vue'
import LabelsBadges from '@/components/shared/LabelsBadges.vue'
import JsonBlock from '@/components/shared/JsonBlock.vue'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'

type Volume = ListItem<operations['list_volumes'], 'volumes'>
type LocationItem = ListItem<operations['list_locations'], 'locations'>

const { client, unwrap } = useApi()

const { items, loading, error, pageInfo, reload } = usePagedResource<Volume>(async ({ page, per_page }) => {
  const data = unwrap(await client().GET('/volumes', { params: { query: { page, per_page } } }))
  return { items: data.volumes ?? [], pagination: data.meta?.pagination ?? {} }
})

// --- locations for the create dialog ---
const locations = ref<LocationItem[]>([])

const { pricing, load: loadPricing } = usePricing()

onMounted(async () => {
  void loadPricing()
  await runAction(async () => {
    const data = unwrap(await client().GET('/locations'))
    locations.value = data.locations ?? []
  })
})

const volumeMonthlyEstimate = computed(() => {
  const perGb = pricing.value?.volume?.price_per_gb_month?.net
  const size = Number(createSize.value)
  if (!perGb || !Number.isFinite(size) || size <= 0) return null
  return size * Number(perGb)
})

const volumePerGbLabel = computed(() => {
  const perGb = pricing.value?.volume?.price_per_gb_month?.net
  return perGb ? formatHourly(Number(perGb)) : null
})

// --- create ---
const createOpen = ref(false)
const createName = ref('')
const createSize = ref('')
const createMode = ref('location')
const createLocation = ref('')
const createServer = ref('')
const createFormat = ref('none')
const createAutomount = ref(false)
const createLabels = ref('')
const creating = ref(false)

const createValid = computed(() => {
  if (!createName.value.trim() || !Number(createSize.value)) return false
  if (createMode.value === 'location') return !!createLocation.value
  return !!Number(createServer.value)
})

async function submitCreate() {
  creating.value = true
  const result = await runAction(async () => {
    const labels = parseLabels(createLabels.value)
    const body: RequestBody<operations['create_volume']> = {
      name: createName.value.trim(),
      size: Number(createSize.value),
      ...(Object.keys(labels).length ? { labels } : {}),
      ...(createFormat.value !== 'none' ? { format: createFormat.value } : {}),
      ...(createMode.value === 'location'
        ? { location: createLocation.value }
        : { server: Number(createServer.value), ...(createAutomount.value ? { automount: true } : {}) }),
    }
    return unwrap(await client().POST('/volumes', { body }))
  }, 'Volume created')
  creating.value = false
  if (result !== undefined) {
    createOpen.value = false
    createName.value = ''
    createSize.value = ''
    createMode.value = 'location'
    createLocation.value = ''
    createServer.value = ''
    createFormat.value = 'none'
    createAutomount.value = false
    createLabels.value = ''
    void reload()
  }
}

// --- detail / edit ---
const selected = ref<Volume | null>(null)
const detailOpen = ref(false)
const editName = ref('')
const editLabels = ref('')
const acting = ref(false)

function openDetail(volume: Volume) {
  selected.value = volume
  editName.value = volume.name ?? ''
  editLabels.value = labelsToText(volume.labels)
  detailOpen.value = true
}

async function saveEdit() {
  const volume = selected.value
  if (!volume) return
  const result = await runAction(async () => {
    const body: RequestBody<operations['update_volume']> = {
      name: editName.value.trim(),
      labels: parseLabels(editLabels.value),
    }
    return unwrap(await client().PUT('/volumes/{id}', { params: { path: { id: volume.id } }, body }))
  }, 'Volume updated')
  if (result !== undefined) {
    detailOpen.value = false
    void reload()
  }
}

// --- attach ---
const attachOpen = ref(false)
const attachServer = ref('')
const attachAutomount = ref(false)

async function submitAttach() {
  const volume = selected.value
  if (!volume) return
  acting.value = true
  const result = await runAction(async () => {
    const body: RequestBody<operations['attach_volume']> = {
      server: Number(attachServer.value),
      ...(attachAutomount.value ? { automount: true } : {}),
    }
    return unwrap(await client().POST('/volumes/{id}/actions/attach', { params: { path: { id: volume.id } }, body }))
  }, 'Volume attach started')
  acting.value = false
  if (result !== undefined) {
    attachOpen.value = false
    attachServer.value = ''
    attachAutomount.value = false
    void reload()
  }
}

// --- detach ---
const detachOpen = ref(false)

async function confirmDetach() {
  const volume = selected.value
  if (!volume) return
  const result = await runAction(async () => {
    return unwrap(await client().POST('/volumes/{id}/actions/detach', { params: { path: { id: volume.id } } }))
  }, 'Volume detach started')
  if (result !== undefined) {
    detachOpen.value = false
    void reload()
  }
}

// --- resize ---
const resizeOpen = ref(false)
const resizeSize = ref('')

function openResize() {
  resizeSize.value = String(selected.value?.size ?? '')
  resizeOpen.value = true
}

const resizeValid = computed(() => {
  const current = selected.value?.size ?? 0
  return Number(resizeSize.value) >= current && Number(resizeSize.value) > 0
})

async function submitResize() {
  const volume = selected.value
  if (!volume) return
  acting.value = true
  const result = await runAction(async () => {
    const body: RequestBody<operations['resize_volume']> = { size: Number(resizeSize.value) }
    return unwrap(await client().POST('/volumes/{id}/actions/resize', { params: { path: { id: volume.id } }, body }))
  }, 'Volume resize started')
  acting.value = false
  if (result !== undefined) {
    resizeOpen.value = false
    void reload()
  }
}

// --- protection ---
const protectionOpen = ref(false)
const protectDelete = ref(false)

function openProtection() {
  protectDelete.value = selected.value?.protection?.delete ?? false
  protectionOpen.value = true
}

async function submitProtection() {
  const volume = selected.value
  if (!volume) return
  acting.value = true
  const result = await runAction(async () => {
    const body: RequestBody<operations['change_volume_protection']> = { delete: protectDelete.value }
    return unwrap(
      await client().POST('/volumes/{id}/actions/change_protection', { params: { path: { id: volume.id } }, body }),
    )
  }, 'Protection updated')
  acting.value = false
  if (result !== undefined) {
    protectionOpen.value = false
    void reload()
  }
}

// --- delete ---
const deleteOpen = ref(false)

async function confirmDelete() {
  const volume = selected.value
  if (!volume) return
  const result = await runAction(async () => {
    await client().DELETE('/volumes/{id}', { params: { path: { id: volume.id } } })
    return true
  }, 'Volume deleted')
  if (result !== undefined) {
    deleteOpen.value = false
    detailOpen.value = false
    void reload()
  }
}
</script>

<template>
  <div class="space-y-4">
    <PageHeader title="Volumes" description="Block storage volumes that can be attached to servers.">
      <Button variant="outline" size="sm" :disabled="loading" @click="reload()">
        <RefreshCw class="mr-2 size-4" />
        Refresh
      </Button>
      <Button size="sm" @click="createOpen = true">
        <Plus class="mr-2 size-4" />
        Create volume
      </Button>
    </PageHeader>

    <ErrorState v-if="error" :error="error" @retry="reload()" />

    <div class="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Size</TableHead>
            <TableHead>Server</TableHead>
            <TableHead>Location</TableHead>
            <TableHead>Linux device</TableHead>
            <TableHead>Format</TableHead>
            <TableHead>Labels</TableHead>
            <TableHead>Created</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <template v-if="loading">
            <TableRow v-for="i in 5" :key="i">
              <TableCell colspan="8"><Skeleton class="h-5 w-full" /></TableCell>
            </TableRow>
          </template>
          <TableRow v-else-if="!items.length">
            <TableCell colspan="8" class="py-8 text-center text-muted-foreground">No volumes.</TableCell>
          </TableRow>
          <TableRow v-for="volume in items" v-else :key="volume.id" class="cursor-pointer" @click="openDetail(volume)">
            <TableCell class="font-medium">{{ volume.name }}</TableCell>
            <TableCell>{{ volume.size }} GB</TableCell>
            <TableCell class="font-mono text-xs">{{ volume.server ?? '—' }}</TableCell>
            <TableCell>{{ volume.location?.name ?? '—' }}</TableCell>
            <TableCell class="font-mono text-xs">{{ volume.linux_device ?? '—' }}</TableCell>
            <TableCell>{{ volume.format ?? '—' }}</TableCell>
            <TableCell><LabelsBadges :labels="volume.labels" /></TableCell>
            <TableCell class="text-muted-foreground">{{ volume.created ? new Date(volume.created).toLocaleString() : '—' }}</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>

    <PaginationBar :page-info="pageInfo" :loading="loading" @change="reload" />

    <Dialog v-model:open="createOpen">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create volume</DialogTitle>
          <DialogDescription>Provide either a location or a server to attach to — not both.</DialogDescription>
        </DialogHeader>
        <form class="space-y-4" @submit.prevent="submitCreate">
          <div class="space-y-2">
            <Label for="vol-name">Name</Label>
            <Input id="vol-name" v-model="createName" required />
          </div>
          <div class="space-y-2">
            <Label for="vol-size">Size (GB)</Label>
            <Input id="vol-size" v-model="createSize" type="number" min="10" max="10240" required />
            <p v-if="volumeMonthlyEstimate !== null" class="text-xs text-muted-foreground">
              ≈ {{ formatMonthly(volumeMonthlyEstimate) }}/mo
              <template v-if="volumePerGbLabel">({{ volumePerGbLabel }}/GB/mo)</template>
            </p>
          </div>
          <div class="space-y-2">
            <Label for="vol-mode">Create in</Label>
            <Select v-model="createMode">
              <SelectTrigger id="vol-mode"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="location">Location</SelectItem>
                <SelectItem value="server">Server (attach on create)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div v-if="createMode === 'location'" class="space-y-2">
            <Label for="vol-location">Location</Label>
            <Select v-model="createLocation">
              <SelectTrigger id="vol-location"><SelectValue placeholder="Select a location" /></SelectTrigger>
              <SelectContent>
                <SelectItem v-for="loc in locations" :key="loc.id" :value="loc.name">
                  {{ loc.name }} — {{ loc.description }}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <template v-else>
            <div class="space-y-2">
              <Label for="vol-server">Server ID</Label>
              <Input id="vol-server" v-model="createServer" type="number" min="1" required />
            </div>
            <div class="flex items-center gap-2">
              <Checkbox id="vol-automount" v-model:checked="createAutomount" />
              <Label for="vol-automount">Auto-mount after attach</Label>
            </div>
          </template>
          <div class="space-y-2">
            <Label for="vol-format">Format</Label>
            <Select v-model="createFormat">
              <SelectTrigger id="vol-format"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Do not format</SelectItem>
                <SelectItem value="ext4">ext4</SelectItem>
                <SelectItem value="xfs">xfs</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div class="space-y-2">
            <Label for="vol-labels">Labels (one key=value per line)</Label>
            <Textarea id="vol-labels" v-model="createLabels" rows="2" class="font-mono text-xs" />
          </div>
          <DialogFooter>
            <Button type="submit" :disabled="creating || !createValid">Create</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>

    <DetailSheet v-model:open="detailOpen" :title="selected?.name ?? 'Volume'" description="Volume details">
      <Tabs v-if="selected" default-value="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="edit">Edit</TabsTrigger>
          <TabsTrigger value="json">JSON</TabsTrigger>
        </TabsList>
        <TabsContent value="overview" class="mt-4 space-y-4">
          <div class="flex justify-end">
            <DropdownMenu>
              <DropdownMenuTrigger as-child>
                <Button variant="outline" size="sm">
                  <MoreHorizontal class="mr-2 size-4" />
                  Actions
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem :disabled="selected.server !== null" @click="attachOpen = true">Attach to server…</DropdownMenuItem>
                <DropdownMenuItem :disabled="selected.server === null" @click="detachOpen = true">Detach…</DropdownMenuItem>
                <DropdownMenuItem @click="openResize">Resize…</DropdownMenuItem>
                <DropdownMenuItem @click="openProtection">Change protection…</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem class="text-destructive" :disabled="selected.protection?.delete" @click="deleteOpen = true">
                  Delete…
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <KeyValue
            :items="[
              { label: 'ID', value: selected.id },
              { label: 'Name', value: selected.name },
              { label: 'Status', value: selected.status },
              { label: 'Size', value: `${selected.size} GB` },
              { label: 'Server', value: selected.server },
              { label: 'Location', value: selected.location?.name },
              { label: 'Linux device', value: selected.linux_device },
              { label: 'Format', value: selected.format },
              { label: 'Protection', value: `delete: ${selected.protection?.delete ?? false}` },
              { label: 'Created', value: selected.created ? new Date(selected.created).toLocaleString() : null },
            ]"
          />
        </TabsContent>
        <TabsContent value="edit" class="mt-4">
          <form class="space-y-4" @submit.prevent="saveEdit">
            <div class="space-y-2">
              <Label for="vol-edit-name">Name</Label>
              <Input id="vol-edit-name" v-model="editName" required />
            </div>
            <div class="space-y-2">
              <Label for="vol-edit-labels">Labels</Label>
              <Textarea id="vol-edit-labels" v-model="editLabels" rows="3" class="font-mono text-xs" />
            </div>
            <div class="flex justify-end">
              <Button type="submit">Save</Button>
            </div>
          </form>
        </TabsContent>
        <TabsContent value="json" class="mt-4">
          <JsonBlock :data="selected" />
        </TabsContent>
      </Tabs>
    </DetailSheet>

    <Dialog v-model:open="attachOpen">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Attach volume</DialogTitle>
          <DialogDescription>Attach '{{ selected?.name }}' to a server in the same location.</DialogDescription>
        </DialogHeader>
        <form class="space-y-4" @submit.prevent="submitAttach">
          <div class="space-y-2">
            <Label for="vol-attach-server">Server ID</Label>
            <Input id="vol-attach-server" v-model="attachServer" type="number" min="1" required />
          </div>
          <div class="flex items-center gap-2">
            <Checkbox id="vol-attach-automount" v-model:checked="attachAutomount" />
            <Label for="vol-attach-automount">Auto-mount after attach</Label>
          </div>
          <DialogFooter>
            <Button type="submit" :disabled="acting || !Number(attachServer)">Attach</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>

    <Dialog v-model:open="resizeOpen">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Resize volume</DialogTitle>
          <DialogDescription>
            New size in GB. Downsizing is not possible — current size is {{ selected?.size }} GB.
          </DialogDescription>
        </DialogHeader>
        <form class="space-y-4" @submit.prevent="submitResize">
          <div class="space-y-2">
            <Label for="vol-resize-size">Size (GB)</Label>
            <Input id="vol-resize-size" v-model="resizeSize" type="number" :min="selected?.size ?? 10" max="10240" required />
          </div>
          <DialogFooter>
            <Button type="submit" :disabled="acting || !resizeValid">Resize</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>

    <Dialog v-model:open="protectionOpen">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Change protection</DialogTitle>
          <DialogDescription>Protection settings for '{{ selected?.name }}'.</DialogDescription>
        </DialogHeader>
        <form class="space-y-4" @submit.prevent="submitProtection">
          <div class="flex items-center gap-2">
            <Checkbox id="vol-protect-delete" v-model:checked="protectDelete" />
            <Label for="vol-protect-delete">Protect from deletion</Label>
          </div>
          <DialogFooter>
            <Button type="submit" :disabled="acting">Save</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>

    <ConfirmDialog
      v-model:open="detachOpen"
      title="Detach volume?"
      :description="`This will detach '${selected?.name}' from server ${selected?.server}.`"
      confirm-label="Detach"
      @confirm="confirmDetach"
    />
    <ConfirmDialog
      v-model:open="deleteOpen"
      title="Delete volume?"
      :description="`This will permanently delete '${selected?.name}' and destroy all data on it.`"
      confirm-label="Delete"
      destructive
      @confirm="confirmDelete"
    />
  </div>
</template>
