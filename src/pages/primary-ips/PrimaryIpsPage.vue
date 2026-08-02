<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { MoreHorizontal, Plus, RefreshCw } from 'lucide-vue-next'
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

type PrimaryIp = ListItem<operations['list_primary_ips'], 'primary_ips'>
type DatacenterItem = ListItem<operations['list_datacenters'], 'datacenters'>

const { client, unwrap } = useApi()

const { items, loading, error, pageInfo, reload } = usePagedResource<PrimaryIp>(async ({ page, per_page }) => {
  const data = unwrap(await client().GET('/primary_ips', { params: { query: { page, per_page } } }))
  return { items: data.primary_ips ?? [], pagination: data.meta?.pagination ?? {} }
})

// --- datacenters for the create dialog ---
const datacenters = ref<DatacenterItem[]>([])

onMounted(async () => {
  await runAction(async () => {
    const data = unwrap(await client().GET('/datacenters'))
    datacenters.value = data.datacenters ?? []
  })
})

function dnsPtrSummary(ip: PrimaryIp): string {
  const entries = ip.dns_ptr ?? []
  if (!entries.length) return '—'
  const first = entries[0]
  const rest = entries.length > 1 ? ` (+${entries.length - 1})` : ''
  return `${first.dns_ptr}${rest}`
}

// --- create ---
const createOpen = ref(false)
const createType = ref('ipv4')
const createName = ref('')
const createMode = ref('datacenter')
const createDatacenter = ref('')
const createAssignee = ref('')
const createAutoDelete = ref(false)
const createLabels = ref('')
const creating = ref(false)

const createValid = computed(() => {
  if (!createName.value.trim()) return false
  if (createMode.value === 'datacenter') return !!createDatacenter.value
  return !!Number(createAssignee.value)
})

async function submitCreate() {
  creating.value = true
  const result = await runAction(async () => {
    const labels = parseLabels(createLabels.value)
    const body: RequestBody<operations['create_primary_ip']> = {
      name: createName.value.trim(),
      type: createType.value === 'ipv6' ? 'ipv6' : 'ipv4',
      ...(createMode.value === 'datacenter'
        ? { location: datacenters.value.find((dc) => dc.name === createDatacenter.value)?.location?.name ?? '' }
        : { assignee_type: 'server' as const, assignee_id: Number(createAssignee.value) }),
      ...(createAutoDelete.value ? { auto_delete: true } : {}),
      ...(Object.keys(labels).length ? { labels } : {}),
    }
    return unwrap(await client().POST('/primary_ips', { body }))
  }, 'Primary IP created')
  creating.value = false
  if (result !== undefined) {
    createOpen.value = false
    createType.value = 'ipv4'
    createName.value = ''
    createMode.value = 'datacenter'
    createDatacenter.value = ''
    createAssignee.value = ''
    createAutoDelete.value = false
    createLabels.value = ''
    void reload()
  }
}

// --- detail / edit ---
const selected = ref<PrimaryIp | null>(null)
const detailOpen = ref(false)
const editName = ref('')
const editLabels = ref('')
const editAutoDelete = ref(false)
const acting = ref(false)

function openDetail(ip: PrimaryIp) {
  selected.value = ip
  editName.value = ip.name ?? ''
  editLabels.value = labelsToText(ip.labels)
  editAutoDelete.value = ip.auto_delete ?? false
  detailOpen.value = true
}

async function saveEdit() {
  const ip = selected.value
  if (!ip) return
  const result = await runAction(async () => {
    const body: RequestBody<operations['update_primary_ip']> = {
      name: editName.value.trim(),
      labels: parseLabels(editLabels.value),
      auto_delete: editAutoDelete.value,
    }
    return unwrap(await client().PUT('/primary_ips/{id}', { params: { path: { id: ip.id } }, body }))
  }, 'Primary IP updated')
  if (result !== undefined) {
    detailOpen.value = false
    void reload()
  }
}

// --- assign ---
const assignOpen = ref(false)
const assignAssignee = ref('')

async function submitAssign() {
  const ip = selected.value
  if (!ip) return
  acting.value = true
  const result = await runAction(async () => {
    const body: RequestBody<operations['assign_primary_ip']> = {
      assignee_type: 'server',
      assignee_id: Number(assignAssignee.value),
    }
    return unwrap(await client().POST('/primary_ips/{id}/actions/assign', { params: { path: { id: ip.id } }, body }))
  }, 'Primary IP assign started')
  acting.value = false
  if (result !== undefined) {
    assignOpen.value = false
    assignAssignee.value = ''
    void reload()
  }
}

// --- unassign ---
const unassignOpen = ref(false)

async function confirmUnassign() {
  const ip = selected.value
  if (!ip) return
  const result = await runAction(async () => {
    return unwrap(await client().POST('/primary_ips/{id}/actions/unassign', { params: { path: { id: ip.id } } }))
  }, 'Primary IP unassign started')
  if (result !== undefined) {
    unassignOpen.value = false
    void reload()
  }
}

// --- change dns ptr ---
const dnsOpen = ref(false)
const dnsIp = ref('')
const dnsPtr = ref('')

function openDns() {
  const ip = selected.value
  if (!ip) return
  dnsIp.value = ip.ip ?? ''
  dnsPtr.value = ip.dns_ptr?.find((entry) => entry.ip === ip.ip)?.dns_ptr ?? ip.dns_ptr?.[0]?.dns_ptr ?? ''
  dnsOpen.value = true
}

async function submitDns() {
  const ip = selected.value
  if (!ip) return
  acting.value = true
  const result = await runAction(async () => {
    const body: RequestBody<operations['change_primary_ip_dns_ptr']> = {
      ip: dnsIp.value.trim(),
      dns_ptr: dnsPtr.value.trim() || null,
    }
    return unwrap(await client().POST('/primary_ips/{id}/actions/change_dns_ptr', { params: { path: { id: ip.id } }, body }))
  }, 'Reverse DNS update started')
  acting.value = false
  if (result !== undefined) {
    dnsOpen.value = false
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
  const ip = selected.value
  if (!ip) return
  acting.value = true
  const result = await runAction(async () => {
    const body: RequestBody<operations['change_primary_ip_protection']> = { delete: protectDelete.value }
    return unwrap(
      await client().POST('/primary_ips/{id}/actions/change_protection', { params: { path: { id: ip.id } }, body }),
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
  const ip = selected.value
  if (!ip) return
  const result = await runAction(async () => {
    await client().DELETE('/primary_ips/{id}', { params: { path: { id: ip.id } } })
    return true
  }, 'Primary IP deleted')
  if (result !== undefined) {
    deleteOpen.value = false
    detailOpen.value = false
    void reload()
  }
}
</script>

<template>
  <div class="space-y-4">
    <PageHeader title="Primary IPs" description="Primary public IPs assigned to servers.">
      <Button variant="outline" size="sm" :disabled="loading" @click="reload()">
        <RefreshCw class="mr-2 size-4" />
        Refresh
      </Button>
      <Button size="sm" @click="createOpen = true">
        <Plus class="mr-2 size-4" />
        Create primary IP
      </Button>
    </PageHeader>

    <ErrorState v-if="error" :error="error" @retry="reload()" />

    <div class="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>IP</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>DNS PTR</TableHead>
            <TableHead>Location</TableHead>
            <TableHead>Assignee</TableHead>
            <TableHead>Auto delete</TableHead>
            <TableHead>Blocked</TableHead>
            <TableHead>Labels</TableHead>
            <TableHead>Created</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <template v-if="loading">
            <TableRow v-for="i in 5" :key="i">
              <TableCell colspan="9"><Skeleton class="h-5 w-full" /></TableCell>
            </TableRow>
          </template>
          <TableRow v-else-if="!items.length">
            <TableCell colspan="9" class="py-8 text-center text-muted-foreground">No primary IPs.</TableCell>
          </TableRow>
          <TableRow v-for="ip in items" v-else :key="ip.id" class="cursor-pointer" @click="openDetail(ip)">
            <TableCell class="font-medium font-mono text-xs">{{ ip.ip }}</TableCell>
            <TableCell><Badge variant="secondary">{{ ip.type }}</Badge></TableCell>
            <TableCell class="max-w-48 truncate" :title="dnsPtrSummary(ip)">{{ dnsPtrSummary(ip) }}</TableCell>
            <TableCell>{{ ip.location?.name ?? '—' }}</TableCell>
            <TableCell class="font-mono text-xs">
              <span v-if="ip.assignee_id !== null && ip.assignee_id !== undefined">{{ ip.assignee_type }}:{{ ip.assignee_id }}</span>
              <span v-else class="text-muted-foreground">—</span>
            </TableCell>
            <TableCell>
              <Badge v-if="ip.auto_delete" variant="outline">auto-delete</Badge>
              <span v-else class="text-muted-foreground">—</span>
            </TableCell>
            <TableCell>
              <Badge v-if="ip.blocked" variant="destructive">blocked</Badge>
              <span v-else class="text-muted-foreground">—</span>
            </TableCell>
            <TableCell><LabelsBadges :labels="ip.labels" /></TableCell>
            <TableCell class="text-muted-foreground">{{ ip.created ? new Date(ip.created).toLocaleString() : '—' }}</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>

    <PaginationBar :page-info="pageInfo" :loading="loading" @change="reload" />

    <Dialog v-model:open="createOpen">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create primary IP</DialogTitle>
          <DialogDescription>Bind to a datacenter or assign directly to a server — not both.</DialogDescription>
        </DialogHeader>
        <form class="space-y-4" @submit.prevent="submitCreate">
          <div class="space-y-2">
            <Label for="pip-name">Name</Label>
            <Input id="pip-name" v-model="createName" required />
          </div>
          <div class="space-y-2">
            <Label for="pip-type">Type</Label>
            <Select v-model="createType">
              <SelectTrigger id="pip-type"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ipv4">IPv4</SelectItem>
                <SelectItem value="ipv6">IPv6</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div class="space-y-2">
            <Label for="pip-mode">Bind to</Label>
            <Select v-model="createMode">
              <SelectTrigger id="pip-mode"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="datacenter">Datacenter</SelectItem>
                <SelectItem value="assignee">Server (assign on create)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div v-if="createMode === 'datacenter'" class="space-y-2">
            <Label for="pip-datacenter">Datacenter</Label>
            <Select v-model="createDatacenter">
              <SelectTrigger id="pip-datacenter"><SelectValue placeholder="Select a datacenter" /></SelectTrigger>
              <SelectContent>
                <SelectItem v-for="dc in datacenters" :key="dc.id" :value="dc.name">
                  {{ dc.name }} — {{ dc.description }}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div v-else class="space-y-2">
            <Label for="pip-assignee">Server ID (assignee)</Label>
            <Input id="pip-assignee" v-model="createAssignee" type="number" min="1" required />
          </div>
          <div class="flex items-center gap-2">
            <Checkbox id="pip-auto-delete" v-model:checked="createAutoDelete" />
            <Label for="pip-auto-delete">Auto-delete when the assigned resource is deleted</Label>
          </div>
          <div class="space-y-2">
            <Label for="pip-labels">Labels (one key=value per line)</Label>
            <Textarea id="pip-labels" v-model="createLabels" rows="2" class="font-mono text-xs" />
          </div>
          <DialogFooter>
            <Button type="submit" :disabled="creating || !createValid">Create</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>

    <DetailSheet v-model:open="detailOpen" :title="selected?.ip ?? 'Primary IP'" description="Primary IP details">
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
                <DropdownMenuItem @click="assignOpen = true">Assign to server…</DropdownMenuItem>
                <DropdownMenuItem :disabled="selected.assignee_id === null" @click="unassignOpen = true">Unassign…</DropdownMenuItem>
                <DropdownMenuItem @click="openDns">Change reverse DNS…</DropdownMenuItem>
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
              { label: 'IP', value: selected.ip },
              { label: 'Type', value: selected.type },
              { label: 'DNS PTR', value: dnsPtrSummary(selected) },
              { label: 'Location', value: selected.location?.name },
              { label: 'Assignee type', value: selected.assignee_type },
              { label: 'Assignee ID', value: selected.assignee_id },
              { label: 'Auto delete', value: selected.auto_delete ? 'yes' : 'no' },
              { label: 'Blocked', value: selected.blocked ? 'yes' : 'no' },
              { label: 'Protection', value: `delete: ${selected.protection?.delete ?? false}` },
              { label: 'Created', value: selected.created ? new Date(selected.created).toLocaleString() : null },
            ]"
          />
        </TabsContent>
        <TabsContent value="edit" class="mt-4">
          <form class="space-y-4" @submit.prevent="saveEdit">
            <div class="space-y-2">
              <Label for="pip-edit-name">Name</Label>
              <Input id="pip-edit-name" v-model="editName" required />
            </div>
            <div class="flex items-center gap-2">
              <Checkbox id="pip-edit-auto-delete" v-model:checked="editAutoDelete" />
              <Label for="pip-edit-auto-delete">Auto-delete when the assigned resource is deleted</Label>
            </div>
            <div class="space-y-2">
              <Label for="pip-edit-labels">Labels</Label>
              <Textarea id="pip-edit-labels" v-model="editLabels" rows="3" class="font-mono text-xs" />
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

    <Dialog v-model:open="assignOpen">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Assign primary IP</DialogTitle>
          <DialogDescription>Assign '{{ selected?.ip }}' to a server.</DialogDescription>
        </DialogHeader>
        <form class="space-y-4" @submit.prevent="submitAssign">
          <div class="space-y-2">
            <Label for="pip-assign-id">Server ID (assignee)</Label>
            <Input id="pip-assign-id" v-model="assignAssignee" type="number" min="1" required />
          </div>
          <DialogFooter>
            <Button type="submit" :disabled="acting || !Number(assignAssignee)">Assign</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>

    <Dialog v-model:open="dnsOpen">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Change reverse DNS</DialogTitle>
          <DialogDescription>Set the PTR record for a single IP of '{{ selected?.ip }}'. Empty value resets it.</DialogDescription>
        </DialogHeader>
        <form class="space-y-4" @submit.prevent="submitDns">
          <div class="space-y-2">
            <Label for="pip-dns-ip">IP address</Label>
            <Input id="pip-dns-ip" v-model="dnsIp" class="font-mono text-xs" required />
          </div>
          <div class="space-y-2">
            <Label for="pip-dns-ptr">DNS PTR</Label>
            <Input id="pip-dns-ptr" v-model="dnsPtr" placeholder="server.example.com" />
          </div>
          <DialogFooter>
            <Button type="submit" :disabled="acting || !dnsIp.trim()">Save</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>

    <Dialog v-model:open="protectionOpen">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Change protection</DialogTitle>
          <DialogDescription>Protection settings for '{{ selected?.ip }}'.</DialogDescription>
        </DialogHeader>
        <form class="space-y-4" @submit.prevent="submitProtection">
          <div class="flex items-center gap-2">
            <Checkbox id="pip-protect-delete" v-model:checked="protectDelete" />
            <Label for="pip-protect-delete">Protect from deletion</Label>
          </div>
          <DialogFooter>
            <Button type="submit" :disabled="acting">Save</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>

    <ConfirmDialog
      v-model:open="unassignOpen"
      title="Unassign primary IP?"
      :description="`This will unassign '${selected?.ip}' from ${selected?.assignee_type} ${selected?.assignee_id}.`"
      confirm-label="Unassign"
      @confirm="confirmUnassign"
    />
    <ConfirmDialog
      v-model:open="deleteOpen"
      title="Delete primary IP?"
      :description="`This will permanently delete '${selected?.ip}'.`"
      confirm-label="Delete"
      destructive
      @confirm="confirmDelete"
    />
  </div>
</template>
