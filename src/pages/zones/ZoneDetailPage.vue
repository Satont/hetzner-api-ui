<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { ArrowLeft, MoreHorizontal, Plus, RefreshCw } from 'lucide-vue-next'
import { useApi, ApiError } from '@/composables/useApi'
import { usePagedResource, runAction } from '@/composables/usePagedResource'
import type { ListItem, RequestBody, ResponseItem } from '@/api/client'
import type { operations } from '@/api/schema'
import PageHeader from '@/components/shared/PageHeader.vue'
import PaginationBar from '@/components/shared/PaginationBar.vue'
import ErrorState from '@/components/shared/ErrorState.vue'
import ConfirmDialog from '@/components/shared/ConfirmDialog.vue'
import StatusBadge from '@/components/shared/StatusBadge.vue'
import RecordsEditor, { type RecordRow } from './RecordsEditor.vue'
import { Badge } from '@/components/ui/badge'
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

type Zone = ResponseItem<operations['get_zone'], 'zone'>
type Rrset = ListItem<operations['list_zone_rrsets'], 'rrsets'>
type RrsetType = NonNullable<RequestBody<operations['create_zone_rrset']>['type']>
type RecordPayload = NonNullable<RequestBody<operations['set_zone_rrset_records']>['records']>[number]

const RR_TYPES: RrsetType[] = [
  'A',
  'AAAA',
  'CAA',
  'CNAME',
  'DS',
  'HINFO',
  'HTTPS',
  'MX',
  'NS',
  'PTR',
  'RP',
  'SOA',
  'SRV',
  'SVCB',
  'TLSA',
  'TXT',
]

const props = defineProps<{
  id: string
}>()

const { client, unwrap } = useApi()

// --- zone header ---
const zone = ref<Zone | null>(null)
const zoneLoading = ref(false)
const zoneError = ref<string | null>(null)

async function loadZone() {
  zoneLoading.value = true
  zoneError.value = null
  try {
    const data = unwrap(await client().GET('/zones/{id_or_name}', { params: { path: { id_or_name: props.id } } }))
    zone.value = data.zone ?? null
  } catch (e) {
    zoneError.value = e instanceof ApiError ? e.message : String(e)
  } finally {
    zoneLoading.value = false
  }
}

onMounted(loadZone)

// --- rrsets ---
const {
  items: rrsets,
  loading,
  error,
  pageInfo,
  reload,
} = usePagedResource<Rrset>(async ({ page, per_page }) => {
  const data = unwrap(
    await client().GET('/zones/{id_or_name}/rrsets', {
      params: { path: { id_or_name: props.id }, query: { page, per_page } },
    }),
  )
  return { items: data.rrsets ?? [], pagination: data.meta?.pagination ?? {} }
})

function reloadAll() {
  void reload()
  void loadZone()
}

function rowsToRecords(rows: RecordRow[]): RecordPayload[] {
  return rows
    .filter((row) => row.value.trim())
    .map((row) => ({ value: row.value.trim(), ...(row.comment.trim() ? { comment: row.comment.trim() } : {}) }))
}

function rrsetToRows(rrset: Rrset): RecordRow[] {
  const rows = (rrset.records ?? []).map((record) => ({ value: record.value, comment: record.comment ?? '' }))
  return rows.length ? rows : [{ value: '', comment: '' }]
}

// --- create rrset ---
const createOpen = ref(false)
const createName = ref('')
const createType = ref<RrsetType>('A')
const createTtl = ref('')
const createRows = ref<RecordRow[]>([{ value: '', comment: '' }])
const creating = ref(false)

const createValid = computed(() => createName.value.trim() && createRows.value.some((row) => row.value.trim()))

async function submitCreate() {
  creating.value = true
  const result = await runAction(async () => {
    const body: RequestBody<operations['create_zone_rrset']> = {
      name: createName.value.trim(),
      type: createType.value,
      ...(createTtl.value.trim() && Number(createTtl.value) ? { ttl: Number(createTtl.value) } : {}),
      records: rowsToRecords(createRows.value),
    }
    return unwrap(
      await client().POST('/zones/{id_or_name}/rrsets', {
        params: { path: { id_or_name: props.id } },
        body,
      }),
    )
  }, 'Record set created')
  creating.value = false
  if (result !== undefined) {
    createOpen.value = false
    createName.value = ''
    createType.value = 'A'
    createTtl.value = ''
    createRows.value = [{ value: '', comment: '' }]
    reloadAll()
  }
}

// --- row selection ---
const selected = ref<Rrset | null>(null)
const acting = ref(false)

function rrsetPath(rrset: Rrset) {
  return { id_or_name: props.id, rr_name: rrset.name, rr_type: rrset.type }
}

// --- records actions (set / add / remove / update) ---
type RecordsMode = 'set' | 'add' | 'remove' | 'update'

const recordsOpen = ref(false)
const recordsMode = ref<RecordsMode>('set')
const recordsRows = ref<RecordRow[]>([{ value: '', comment: '' }])

const recordsTitle = computed(() => {
  switch (recordsMode.value) {
    case 'set':
      return 'Set records'
    case 'add':
      return 'Add records'
    case 'remove':
      return 'Remove records'
    case 'update':
      return 'Update records'
  }
})

const recordsDescription = computed(() => {
  const target = `'${selected.value?.name}/${selected.value?.type}'`
  switch (recordsMode.value) {
    case 'set':
      return `Replaces all records of ${target}.`
    case 'add':
      return `Appends records to ${target}.`
    case 'remove':
      return `Removes the matching records from ${target}. The set is deleted when it becomes empty.`
    case 'update':
      return `Updates the comments of the matching records in ${target}.`
  }
})

function openRecords(mode: RecordsMode, rrset: Rrset) {
  selected.value = rrset
  recordsMode.value = mode
  recordsRows.value = mode === 'add' ? [{ value: '', comment: '' }] : rrsetToRows(rrset)
  recordsOpen.value = true
}

async function submitRecords() {
  const rrset = selected.value
  if (!rrset) return
  acting.value = true
  const path = {
    set: '/zones/{id_or_name}/rrsets/{rr_name}/{rr_type}/actions/set_records',
    add: '/zones/{id_or_name}/rrsets/{rr_name}/{rr_type}/actions/add_records',
    remove: '/zones/{id_or_name}/rrsets/{rr_name}/{rr_type}/actions/remove_records',
    update: '/zones/{id_or_name}/rrsets/{rr_name}/{rr_type}/actions/update_records',
  } as const
  const result = await runAction(async () => {
    const mode = recordsMode.value
    const params = { path: rrsetPath(rrset) }
    if (mode === 'set') {
      const body: RequestBody<operations['set_zone_rrset_records']> = { records: rowsToRecords(recordsRows.value) }
      return unwrap(await client().POST(path.set, { params, body }))
    }
    if (mode === 'add') {
      const body: RequestBody<operations['add_zone_rrset_records']> = { records: rowsToRecords(recordsRows.value) }
      return unwrap(await client().POST(path.add, { params, body }))
    }
    if (mode === 'remove') {
      const body: RequestBody<operations['remove_zone_rrset_records']> = { records: rowsToRecords(recordsRows.value) }
      return unwrap(await client().POST(path.remove, { params, body }))
    }
    // update_records targets comments, so the API requires a comment on every record
    const body: RequestBody<operations['update_zone_rrset_records']> = {
      records: recordsRows.value
        .filter((row) => row.value.trim())
        .map((row) => ({ value: row.value.trim(), comment: row.comment.trim() })),
    }
    return unwrap(await client().POST(path.update, { params, body }))
  }, 'Records change started')
  acting.value = false
  if (result !== undefined) {
    recordsOpen.value = false
    reloadAll()
  }
}

// --- change ttl ---
const ttlOpen = ref(false)
const ttlValue = ref('')

function openTtl(rrset: Rrset) {
  selected.value = rrset
  ttlValue.value = rrset.ttl === null || rrset.ttl === undefined ? '' : String(rrset.ttl)
  ttlOpen.value = true
}

async function submitTtl() {
  const rrset = selected.value
  if (!rrset) return
  acting.value = true
  const result = await runAction(async () => {
    const body: RequestBody<operations['change_zone_rrset_ttl']> = {
      ttl: ttlValue.value.trim() ? Number(ttlValue.value) : null,
    }
    return unwrap(
      await client().POST('/zones/{id_or_name}/rrsets/{rr_name}/{rr_type}/actions/change_ttl', {
        params: { path: rrsetPath(rrset) },
        body,
      }),
    )
  }, 'TTL change started')
  acting.value = false
  if (result !== undefined) {
    ttlOpen.value = false
    reloadAll()
  }
}

// --- change protection ---
const protectionOpen = ref(false)
const protectChange = ref(false)

function openProtection(rrset: Rrset) {
  selected.value = rrset
  protectChange.value = rrset.protection?.change ?? false
  protectionOpen.value = true
}

async function submitProtection() {
  const rrset = selected.value
  if (!rrset) return
  acting.value = true
  const result = await runAction(async () => {
    const body: RequestBody<operations['change_zone_rrset_protection']> = { change: protectChange.value }
    return unwrap(
      await client().POST('/zones/{id_or_name}/rrsets/{rr_name}/{rr_type}/actions/change_protection', {
        params: { path: rrsetPath(rrset) },
        body,
      }),
    )
  }, 'Protection updated')
  acting.value = false
  if (result !== undefined) {
    protectionOpen.value = false
    reloadAll()
  }
}

// --- delete rrset ---
const deleteOpen = ref(false)

function openDelete(rrset: Rrset) {
  selected.value = rrset
  deleteOpen.value = true
}

async function confirmDelete() {
  const rrset = selected.value
  if (!rrset) return
  const result = await runAction(async () => {
    await client().DELETE('/zones/{id_or_name}/rrsets/{rr_name}/{rr_type}', { params: { path: rrsetPath(rrset) } })
    return true
  }, 'Record set deleted')
  if (result !== undefined) {
    deleteOpen.value = false
    reloadAll()
  }
}
</script>

<template>
  <div class="space-y-4">
    <PageHeader :title="zone?.name ?? id" description="DNS zone record sets.">
      <Button variant="outline" size="sm" as-child>
        <RouterLink to="/zones">
          <ArrowLeft class="mr-2 size-4" />
          Back to zones
        </RouterLink>
      </Button>
      <Button variant="outline" size="sm" :disabled="loading" @click="reloadAll">
        <RefreshCw class="mr-2 size-4" />
        Refresh
      </Button>
      <Button size="sm" :disabled="zone?.mode === 'secondary'" @click="createOpen = true">
        <Plus class="mr-2 size-4" />
        Create record set
      </Button>
    </PageHeader>

    <div v-if="zoneLoading" class="flex items-center gap-2">
      <Skeleton class="h-6 w-24" />
      <Skeleton class="h-6 w-40" />
    </div>
    <ErrorState v-else-if="zoneError" :error="zoneError" @retry="loadZone" />
    <div v-else-if="zone" class="flex flex-wrap items-center gap-2">
      <StatusBadge :status="zone.status" />
      <Badge variant="secondary">{{ zone.mode }}</Badge>
      <span class="text-sm text-muted-foreground">Default TTL {{ zone.ttl ?? '—' }} · {{ zone.record_count ?? 0 }} records</span>
    </div>

    <ErrorState v-if="error" :error="error" @retry="reload()" />

    <div class="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>TTL</TableHead>
            <TableHead>Records</TableHead>
            <TableHead>Protection</TableHead>
            <TableHead class="w-10" />
          </TableRow>
        </TableHeader>
        <TableBody>
          <template v-if="loading">
            <TableRow v-for="i in 5" :key="i">
              <TableCell colspan="6"><Skeleton class="h-5 w-full" /></TableCell>
            </TableRow>
          </template>
          <TableRow v-else-if="!rrsets.length">
            <TableCell colspan="6" class="py-8 text-center text-muted-foreground">No record sets.</TableCell>
          </TableRow>
          <TableRow v-for="rrset in rrsets" v-else :key="rrset.id">
            <TableCell class="font-medium font-mono text-xs">{{ rrset.name }}</TableCell>
            <TableCell><Badge variant="secondary">{{ rrset.type }}</Badge></TableCell>
            <TableCell class="font-mono text-xs">{{ rrset.ttl ?? 'default' }}</TableCell>
            <TableCell>
              <div class="space-y-1">
                <div v-for="record in rrset.records ?? []" :key="record.value" class="font-mono text-xs">
                  <span>{{ record.value }}</span>
                  <span v-if="record.comment" class="ml-2 text-muted-foreground">; {{ record.comment }}</span>
                </div>
              </div>
            </TableCell>
            <TableCell>
              <Badge v-if="rrset.protection?.change" variant="destructive">change</Badge>
              <span v-else class="text-muted-foreground">—</span>
            </TableCell>
            <TableCell>
              <DropdownMenu>
                <DropdownMenuTrigger as-child>
                  <Button variant="ghost" size="icon" class="size-8">
                    <MoreHorizontal class="size-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem :disabled="rrset.protection?.change" @click="openRecords('set', rrset)">
                    Set records…
                  </DropdownMenuItem>
                  <DropdownMenuItem :disabled="rrset.protection?.change" @click="openRecords('add', rrset)">
                    Add records…
                  </DropdownMenuItem>
                  <DropdownMenuItem :disabled="rrset.protection?.change" @click="openRecords('remove', rrset)">
                    Remove records…
                  </DropdownMenuItem>
                  <DropdownMenuItem :disabled="rrset.protection?.change" @click="openRecords('update', rrset)">
                    Update records…
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem :disabled="rrset.protection?.change" @click="openTtl(rrset)">Change TTL…</DropdownMenuItem>
                  <DropdownMenuItem @click="openProtection(rrset)">Change protection…</DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem class="text-destructive" :disabled="rrset.protection?.change" @click="openDelete(rrset)">
                    Delete…
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>

    <PaginationBar :page-info="pageInfo" :loading="loading" @change="reload" />

    <Dialog v-model:open="createOpen">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create record set</DialogTitle>
          <DialogDescription>Add a new record set to '{{ zone?.name ?? id }}'.</DialogDescription>
        </DialogHeader>
        <form class="space-y-4" @submit.prevent="submitCreate">
          <div class="grid grid-cols-2 gap-4">
            <div class="space-y-2">
              <Label for="rr-name">Name</Label>
              <Input id="rr-name" v-model="createName" placeholder="www or @" class="font-mono text-xs" required />
            </div>
            <div class="space-y-2">
              <Label for="rr-type">Type</Label>
              <Select v-model="createType">
                <SelectTrigger id="rr-type"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem v-for="type in RR_TYPES" :key="type" :value="type">{{ type }}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div class="space-y-2">
            <Label for="rr-ttl">TTL (seconds, optional)</Label>
            <Input id="rr-ttl" v-model="createTtl" type="number" min="60" max="2147483647" placeholder="Zone default" />
          </div>
          <div class="space-y-2">
            <Label>Records</Label>
            <RecordsEditor v-model="createRows" />
          </div>
          <DialogFooter>
            <Button type="submit" :disabled="creating || !createValid">Create</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>

    <Dialog v-model:open="recordsOpen">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{{ recordsTitle }}</DialogTitle>
          <DialogDescription>{{ recordsDescription }}</DialogDescription>
        </DialogHeader>
        <form class="space-y-4" @submit.prevent="submitRecords">
          <RecordsEditor v-model="recordsRows" />
          <DialogFooter>
            <Button type="submit" :disabled="acting || !recordsRows.some((row) => row.value.trim())">Save</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>

    <Dialog v-model:open="ttlOpen">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Change TTL</DialogTitle>
          <DialogDescription>
            New TTL for '{{ selected?.name }}/{{ selected?.type }}' in seconds. Leave empty to use the zone default.
          </DialogDescription>
        </DialogHeader>
        <form class="space-y-4" @submit.prevent="submitTtl">
          <div class="space-y-2">
            <Label for="rr-ttl-value">TTL</Label>
            <Input id="rr-ttl-value" v-model="ttlValue" type="number" min="60" max="2147483647" placeholder="Zone default" />
          </div>
          <DialogFooter>
            <Button type="submit" :disabled="acting">Save</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>

    <Dialog v-model:open="protectionOpen">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Change protection</DialogTitle>
          <DialogDescription>Protection settings for '{{ selected?.name }}/{{ selected?.type }}'.</DialogDescription>
        </DialogHeader>
        <form class="space-y-4" @submit.prevent="submitProtection">
          <div class="flex items-center gap-2">
            <Checkbox id="rr-protect-change" v-model:checked="protectChange" />
            <Label for="rr-protect-change">Protect from changes</Label>
          </div>
          <DialogFooter>
            <Button type="submit" :disabled="acting">Save</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>

    <ConfirmDialog
      v-model:open="deleteOpen"
      title="Delete record set?"
      :description="`This will permanently delete '${selected?.name}/${selected?.type}' and all its records.`"
      confirm-label="Delete"
      destructive
      @confirm="confirmDelete"
    />
  </div>
</template>
