<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { Check, Copy, MoreHorizontal, Plus, RefreshCw } from 'lucide-vue-next'
import { useApi } from '@/composables/useApi'
import { usePagedResource, runAction } from '@/composables/usePagedResource'
import { parseLabels, labelsToText } from '@/lib/labels'
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
import StatusBadge from '@/components/shared/StatusBadge.vue'
import NameserversEditor, { type NameserverRow } from './NameserversEditor.vue'
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'

type Zone = ListItem<operations['list_zones'], 'zones'>
type ZoneMode = NonNullable<RequestBody<operations['create_zone']>['mode']>

const { client, unwrap } = useApi()
const router = useRouter()

const { items, loading, error, pageInfo, reload } = usePagedResource<Zone>(async ({ page, per_page }) => {
  const data = unwrap(await client().GET('/zones', { params: { query: { page, per_page } } }))
  return { items: data.zones ?? [], pagination: data.meta?.pagination ?? {} }
})

function nsSummary(zone: Zone): string {
  const servers = zone.primary_nameservers ?? []
  if (!servers.length) return '—'
  const first = servers[0]
  const rest = servers.length > 1 ? ` (+${servers.length - 1})` : ''
  return `${first.address}${rest}`
}

// --- create ---
const createOpen = ref(false)
const createName = ref('')
const createMode = ref<ZoneMode>('primary')
const createTtl = ref('')
const createNsRows = ref<NameserverRow[]>([{ address: '', port: '' }])
const createLabels = ref('')
const creating = ref(false)

const createValid = computed(() => {
  if (!createName.value.trim()) return false
  if (createMode.value === 'secondary') return createNsRows.value.some((row) => row.address.trim())
  return true
})

async function submitCreate() {
  creating.value = true
  const result = await runAction(async () => {
    const labels = parseLabels(createLabels.value)
    const ttl = Number(createTtl.value)
    const nameservers = createNsRows.value
      .filter((row) => row.address.trim())
      .map((row) => ({
        address: row.address.trim(),
        ...(row.port.trim() ? { port: Number(row.port) } : {}),
      }))
    const body: RequestBody<operations['create_zone']> = {
      name: createName.value.trim(),
      mode: createMode.value,
      ...(createTtl.value.trim() && ttl ? { ttl } : {}),
      ...(Object.keys(labels).length ? { labels } : {}),
      ...(createMode.value === 'secondary' && nameservers.length ? { primary_nameservers: nameservers } : {}),
    }
    return unwrap(await client().POST('/zones', { body }))
  }, 'Zone created')
  creating.value = false
  if (result !== undefined) {
    createOpen.value = false
    createName.value = ''
    createMode.value = 'primary'
    createTtl.value = ''
    createNsRows.value = [{ address: '', port: '' }]
    createLabels.value = ''
    void reload()
  }
}

// --- detail / edit ---
const selected = ref<Zone | null>(null)
const detailOpen = ref(false)
const detailTab = ref('overview')
const editLabels = ref('')
const acting = ref(false)

const isSecondary = computed(() => selected.value?.mode === 'secondary')

function openDetail(zone: Zone) {
  selectZone(zone)
  detailTab.value = 'overview'
  detailOpen.value = true
}

function selectZone(zone: Zone) {
  selected.value = zone
  editLabels.value = labelsToText(zone.labels)
}

async function saveEdit() {
  const zone = selected.value
  if (!zone) return
  const result = await runAction(async () => {
    const body: RequestBody<operations['update_zone']> = { labels: parseLabels(editLabels.value) }
    return unwrap(await client().PUT('/zones/{id_or_name}', { params: { path: { id_or_name: String(zone.id) } }, body }))
  }, 'Zone updated')
  if (result !== undefined) {
    void reload()
  }
}

// --- zonefile ---
const zonefile = ref('')
const zonefileLoading = ref(false)
const zonefileError = ref<string | null>(null)
const zonefileZoneId = ref<number | null>(null)
const zonefileCopied = ref(false)

async function loadZonefile() {
  const zone = selected.value
  if (!zone || zonefileZoneId.value === zone.id) return
  zonefileLoading.value = true
  zonefileError.value = null
  try {
    const data = unwrap(
      await client().GET('/zones/{id_or_name}/zonefile', { params: { path: { id_or_name: String(zone.id) } } }),
    )
    zonefile.value = data.zonefile ?? ''
    zonefileZoneId.value = zone.id
  } catch (e) {
    zonefileError.value = e instanceof Error ? e.message : String(e)
  } finally {
    zonefileLoading.value = false
  }
}

watch([detailTab, detailOpen], ([tab, open]) => {
  if (open && tab === 'zonefile') void loadZonefile()
})

async function copyZonefile() {
  await navigator.clipboard.writeText(zonefile.value)
  zonefileCopied.value = true
  setTimeout(() => {
    zonefileCopied.value = false
  }, 1500)
}

// --- change ttl ---
const ttlOpen = ref(false)
const ttlValue = ref('')

function openTtl(zone: Zone) {
  selectZone(zone)
  ttlValue.value = String(zone.ttl ?? '')
  ttlOpen.value = true
}

async function submitTtl() {
  const zone = selected.value
  if (!zone) return
  acting.value = true
  const result = await runAction(async () => {
    const body: RequestBody<operations['change_zone_ttl']> = { ttl: Number(ttlValue.value) }
    return unwrap(
      await client().POST('/zones/{id_or_name}/actions/change_ttl', {
        params: { path: { id_or_name: String(zone.id) } },
        body,
      }),
    )
  }, 'TTL change started')
  acting.value = false
  if (result !== undefined) {
    ttlOpen.value = false
    void reload()
  }
}

// --- change primary nameservers ---
const nsOpen = ref(false)
const nsRows = ref<NameserverRow[]>([{ address: '', port: '' }])

function openNameservers(zone: Zone) {
  selectZone(zone)
  const servers = zone.primary_nameservers ?? []
  nsRows.value = servers.length
    ? servers.map((ns) => ({ address: ns.address, port: String(ns.port ?? '') }))
    : [{ address: '', port: '' }]
  nsOpen.value = true
}

async function submitNameservers() {
  const zone = selected.value
  if (!zone) return
  acting.value = true
  const result = await runAction(async () => {
    const body: RequestBody<operations['change_zone_primary_nameservers']> = {
      primary_nameservers: nsRows.value
        .filter((row) => row.address.trim())
        .map((row) => ({
          address: row.address.trim(),
          ...(row.port.trim() ? { port: Number(row.port) } : {}),
        })),
    }
    return unwrap(
      await client().POST('/zones/{id_or_name}/actions/change_primary_nameservers', {
        params: { path: { id_or_name: String(zone.id) } },
        body,
      }),
    )
  }, 'Primary nameservers change started')
  acting.value = false
  if (result !== undefined) {
    nsOpen.value = false
    void reload()
  }
}

// --- import zonefile ---
const importOpen = ref(false)
const importText = ref('')

function openImport(zone: Zone) {
  selectZone(zone)
  importText.value = ''
  importOpen.value = true
}

async function submitImport() {
  const zone = selected.value
  if (!zone) return
  acting.value = true
  const result = await runAction(async () => {
    const body: RequestBody<operations['import_zone_zonefile']> = { zonefile: importText.value }
    return unwrap(
      await client().POST('/zones/{id_or_name}/actions/import_zonefile', {
        params: { path: { id_or_name: String(zone.id) } },
        body,
      }),
    )
  }, 'Zone file import started')
  acting.value = false
  if (result !== undefined) {
    importOpen.value = false
    void reload()
  }
}

// --- protection ---
const protectionOpen = ref(false)
const protectDelete = ref(false)

function openProtection(zone: Zone) {
  selectZone(zone)
  protectDelete.value = zone.protection?.delete ?? false
  protectionOpen.value = true
}

async function submitProtection() {
  const zone = selected.value
  if (!zone) return
  acting.value = true
  const result = await runAction(async () => {
    const body: RequestBody<operations['change_zone_protection']> = { delete: protectDelete.value }
    return unwrap(
      await client().POST('/zones/{id_or_name}/actions/change_protection', {
        params: { path: { id_or_name: String(zone.id) } },
        body,
      }),
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

function openDelete(zone: Zone) {
  selectZone(zone)
  deleteOpen.value = true
}

async function confirmDelete() {
  const zone = selected.value
  if (!zone) return
  const result = await runAction(async () => {
    await client().DELETE('/zones/{id_or_name}', { params: { path: { id_or_name: String(zone.id) } } })
    return true
  }, 'Zone deleted')
  if (result !== undefined) {
    deleteOpen.value = false
    detailOpen.value = false
    void reload()
  }
}
</script>

<template>
  <div class="space-y-4">
    <PageHeader title="DNS Zones" description="Authoritative DNS zones hosted on Hetzner nameservers.">
      <Button variant="outline" size="sm" :disabled="loading" @click="reload()">
        <RefreshCw class="mr-2 size-4" />
        Refresh
      </Button>
      <Button size="sm" @click="createOpen = true">
        <Plus class="mr-2 size-4" />
        Create zone
      </Button>
    </PageHeader>

    <ErrorState v-if="error" :error="error" @retry="reload()" />

    <div class="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>TTL</TableHead>
            <TableHead>Records</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Primary nameservers</TableHead>
            <TableHead>Protection</TableHead>
            <TableHead>Labels</TableHead>
            <TableHead>Created</TableHead>
            <TableHead class="w-10" />
          </TableRow>
        </TableHeader>
        <TableBody>
          <template v-if="loading">
            <TableRow v-for="i in 5" :key="i">
              <TableCell colspan="9"><Skeleton class="h-5 w-full" /></TableCell>
            </TableRow>
          </template>
          <TableRow v-else-if="!items.length">
            <TableCell colspan="9" class="py-8 text-center text-muted-foreground">No zones.</TableCell>
          </TableRow>
          <TableRow
            v-for="zone in items"
            v-else
            :key="zone.id"
            class="cursor-pointer"
            @click="router.push(`/zones/${zone.id}`)"
          >
            <TableCell class="font-medium">
              {{ zone.name }}
              <Badge v-if="zone.mode === 'secondary'" variant="secondary" class="ml-2">secondary</Badge>
            </TableCell>
            <TableCell class="font-mono text-xs">{{ zone.ttl ?? '—' }}</TableCell>
            <TableCell>{{ zone.record_count ?? '—' }}</TableCell>
            <TableCell><StatusBadge :status="zone.status" /></TableCell>
            <TableCell class="max-w-48 truncate font-mono text-xs" :title="nsSummary(zone)">{{ nsSummary(zone) }}</TableCell>
            <TableCell>
              <Badge v-if="zone.protection?.delete" variant="destructive">delete</Badge>
              <span v-else class="text-muted-foreground">—</span>
            </TableCell>
            <TableCell><LabelsBadges :labels="zone.labels" /></TableCell>
            <TableCell class="text-muted-foreground">{{ zone.created ? new Date(zone.created).toLocaleString() : '—' }}</TableCell>
            <TableCell @click.stop>
              <DropdownMenu>
                <DropdownMenuTrigger as-child>
                  <Button variant="ghost" size="icon" class="size-8">
                    <MoreHorizontal class="size-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem @click="openDetail(zone)">Details…</DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem :disabled="zone.mode === 'secondary'" @click="openTtl(zone)">Change TTL…</DropdownMenuItem>
                  <DropdownMenuItem :disabled="zone.mode !== 'secondary'" @click="openNameservers(zone)">
                    Change primary nameservers…
                  </DropdownMenuItem>
                  <DropdownMenuItem :disabled="zone.mode === 'secondary'" @click="openImport(zone)">
                    Import zone file…
                  </DropdownMenuItem>
                  <DropdownMenuItem @click="openProtection(zone)">Change protection…</DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem class="text-destructive" :disabled="zone.protection?.delete" @click="openDelete(zone)">
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
          <DialogTitle>Create zone</DialogTitle>
          <DialogDescription>Creates a DNS zone. A default SOA and NS records are added automatically.</DialogDescription>
        </DialogHeader>
        <form class="space-y-4" @submit.prevent="submitCreate">
          <div class="space-y-2">
            <Label for="zone-name">Name</Label>
            <Input id="zone-name" v-model="createName" placeholder="example.com" required />
          </div>
          <div class="space-y-2">
            <Label for="zone-mode">Mode</Label>
            <Select v-model="createMode">
              <SelectTrigger id="zone-mode"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="primary">Primary</SelectItem>
                <SelectItem value="secondary">Secondary</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div v-if="createMode === 'secondary'" class="space-y-2">
            <Label>Primary nameservers</Label>
            <NameserversEditor v-model="createNsRows" />
          </div>
          <div class="space-y-2">
            <Label for="zone-ttl">Default TTL (seconds, optional)</Label>
            <Input id="zone-ttl" v-model="createTtl" type="number" min="60" max="2147483647" placeholder="3600" />
          </div>
          <div class="space-y-2">
            <Label for="zone-labels">Labels (one key=value per line)</Label>
            <Textarea id="zone-labels" v-model="createLabels" rows="2" class="font-mono text-xs" />
          </div>
          <DialogFooter>
            <Button type="submit" :disabled="creating || !createValid">Create</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>

    <DetailSheet v-model:open="detailOpen" :title="selected?.name ?? 'Zone'" description="Zone details">
      <Tabs v-if="selected" v-model="detailTab">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="edit">Edit</TabsTrigger>
          <TabsTrigger value="zonefile">Zone file</TabsTrigger>
          <TabsTrigger value="json">JSON</TabsTrigger>
        </TabsList>
        <TabsContent value="overview" class="mt-4 space-y-4">
          <div class="flex items-center justify-between">
            <StatusBadge :status="selected.status" />
            <DropdownMenu>
              <DropdownMenuTrigger as-child>
                <Button variant="outline" size="sm">
                  <MoreHorizontal class="mr-2 size-4" />
                  Actions
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem :disabled="isSecondary" @click="openTtl(selected)">Change TTL…</DropdownMenuItem>
                <DropdownMenuItem :disabled="!isSecondary" @click="openNameservers(selected)">
                  Change primary nameservers…
                </DropdownMenuItem>
                <DropdownMenuItem :disabled="isSecondary" @click="openImport(selected)">Import zone file…</DropdownMenuItem>
                <DropdownMenuItem @click="openProtection(selected)">Change protection…</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  class="text-destructive"
                  :disabled="selected.protection?.delete"
                  @click="openDelete(selected)"
                >
                  Delete…
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <KeyValue
            :items="[
              { label: 'ID', value: selected.id },
              { label: 'Name', value: selected.name },
              { label: 'Mode', value: selected.mode },
              { label: 'TTL', value: selected.ttl },
              { label: 'Status', value: selected.status },
              { label: 'Registrar', value: selected.registrar },
              { label: 'Record count', value: selected.record_count },
              { label: 'Secondary DNS', value: isSecondary ? 'yes' : 'no' },
              { label: 'Protection', value: `delete: ${selected.protection?.delete ?? false}` },
              { label: 'Created', value: selected.created ? new Date(selected.created).toLocaleString() : null },
            ]"
          />
          <div class="space-y-2">
            <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">Primary nameservers</p>
            <div v-if="selected.primary_nameservers?.length" class="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Address</TableHead>
                    <TableHead>Port</TableHead>
                    <TableHead>TSIG</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow v-for="ns in selected.primary_nameservers" :key="ns.address">
                    <TableCell class="font-mono text-xs">{{ ns.address }}</TableCell>
                    <TableCell class="font-mono text-xs">{{ ns.port ?? 53 }}</TableCell>
                    <TableCell class="font-mono text-xs">
                      {{ ns.tsig_key ? (ns.tsig_algorithm ?? 'yes') : '—' }}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
            <p v-else class="text-sm text-muted-foreground">None (primary mode).</p>
          </div>
        </TabsContent>
        <TabsContent value="edit" class="mt-4">
          <form class="space-y-4" @submit.prevent="saveEdit">
            <div class="space-y-2">
              <Label for="zone-edit-labels">Labels</Label>
              <Textarea id="zone-edit-labels" v-model="editLabels" rows="3" class="font-mono text-xs" />
              <p class="text-xs text-muted-foreground">Only labels can be updated on a zone.</p>
            </div>
            <div class="flex justify-end">
              <Button type="submit">Save</Button>
            </div>
          </form>
        </TabsContent>
        <TabsContent value="zonefile" class="mt-4 space-y-2">
          <div class="flex justify-end">
            <Button variant="outline" size="sm" :disabled="zonefileLoading || !zonefile" @click="copyZonefile">
              <Check v-if="zonefileCopied" class="mr-2 size-4" />
              <Copy v-else class="mr-2 size-4" />
              {{ zonefileCopied ? 'Copied' : 'Copy' }}
            </Button>
          </div>
          <Skeleton v-if="zonefileLoading" class="h-48 w-full" />
          <ErrorState v-else-if="zonefileError" :error="zonefileError" @retry="loadZonefile" />
          <pre v-else class="max-h-96 overflow-auto rounded-md border bg-muted/40 p-3 font-mono text-xs leading-relaxed">{{ zonefile }}</pre>
        </TabsContent>
        <TabsContent value="json" class="mt-4">
          <JsonBlock :data="selected" />
        </TabsContent>
      </Tabs>
    </DetailSheet>

    <Dialog v-model:open="ttlOpen">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Change default TTL</DialogTitle>
          <DialogDescription>New default TTL for '{{ selected?.name }}' in seconds (60 – 2147483647).</DialogDescription>
        </DialogHeader>
        <form class="space-y-4" @submit.prevent="submitTtl">
          <div class="space-y-2">
            <Label for="zone-ttl-value">TTL</Label>
            <Input id="zone-ttl-value" v-model="ttlValue" type="number" min="60" max="2147483647" required />
          </div>
          <DialogFooter>
            <Button type="submit" :disabled="acting || !Number(ttlValue)">Save</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>

    <Dialog v-model:open="nsOpen">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Change primary nameservers</DialogTitle>
          <DialogDescription>Overwrite the primary nameservers of '{{ selected?.name }}'.</DialogDescription>
        </DialogHeader>
        <form class="space-y-4" @submit.prevent="submitNameservers">
          <NameserversEditor v-model="nsRows" />
          <DialogFooter>
            <Button type="submit" :disabled="acting || !nsRows.some((row) => row.address.trim())">Save</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>

    <Dialog v-model:open="importOpen">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Import zone file</DialogTitle>
          <DialogDescription>
            Replaces all record sets of '{{ selected?.name }}'. Fails if any record set is change-protected.
          </DialogDescription>
        </DialogHeader>
        <form class="space-y-4" @submit.prevent="submitImport">
          <div class="space-y-2">
            <Label for="zone-import-text">Zone file (BIND format)</Label>
            <Textarea id="zone-import-text" v-model="importText" rows="10" class="font-mono text-xs" required />
          </div>
          <DialogFooter>
            <Button type="submit" :disabled="acting || !importText.trim()">Import</Button>
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
            <Checkbox id="zone-protect-delete" v-model:checked="protectDelete" />
            <Label for="zone-protect-delete">Protect from deletion</Label>
          </div>
          <DialogFooter>
            <Button type="submit" :disabled="acting">Save</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>

    <ConfirmDialog
      v-model:open="deleteOpen"
      title="Delete zone?"
      :description="`This will permanently delete zone '${selected?.name}' and all its records.`"
      confirm-label="Delete"
      destructive
      @confirm="confirmDelete"
    />
  </div>
</template>
