<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { MoreHorizontal, Plus, RefreshCw } from 'lucide-vue-next'
import { useApi } from '@/composables/useApi'
import { usePricing } from '@/composables/usePricing'
import { formatMonthly } from '@/lib/price'
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

type FloatingIp = ListItem<operations['list_floating_ips'], 'floating_ips'>
type LocationItem = ListItem<operations['list_locations'], 'locations'>

const { client, unwrap } = useApi()

const { items, loading, error, pageInfo, reload } = usePagedResource<FloatingIp>(async ({ page, per_page }) => {
  const data = unwrap(await client().GET('/floating_ips', { params: { query: { page, per_page } } }))
  return { items: data.floating_ips ?? [], pagination: data.meta?.pagination ?? {} }
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

function dnsPtrSummary(ip: FloatingIp): string {
  const entries = ip.dns_ptr ?? []
  if (!entries.length) return '—'
  const first = entries[0]
  const rest = entries.length > 1 ? ` (+${entries.length - 1})` : ''
  return `${first.dns_ptr}${rest}`
}

// Monthly price for the selected type + location (cheapest location as fallback).
const createPriceLabel = computed(() => {
  const entry = (pricing.value?.floating_ips ?? []).find((e) => e.type === createType.value)
  const prices = entry?.prices ?? []
  if (!prices.length) return null
  const exact = createLocation.value ? prices.find((p) => p.location === createLocation.value) : undefined
  const cheapest = prices.reduce((min, p) => (Number(p.price_monthly.net) < Number(min.price_monthly.net) ? p : min))
  const price = exact ?? cheapest
  const prefix = exact ? '' : 'from '
  return `${prefix}${formatMonthly(price.price_monthly.net)}/mo (${price.location})`
})

// --- create ---
const createOpen = ref(false)
const createType = ref('ipv4')
const createMode = ref('location')
const createLocation = ref('')
const createServer = ref('')
const createDescription = ref('')
const createLabels = ref('')
const creating = ref(false)

const createValid = computed(() => {
  if (createMode.value === 'location') return !!createLocation.value
  return !!Number(createServer.value)
})

async function submitCreate() {
  creating.value = true
  const result = await runAction(async () => {
    const labels = parseLabels(createLabels.value)
    const body: RequestBody<operations['create_floating_ip']> = {
      type: createType.value === 'ipv6' ? 'ipv6' : 'ipv4',
      ...(createMode.value === 'location' ? { home_location: createLocation.value } : { server: Number(createServer.value) }),
      ...(createDescription.value.trim() ? { description: createDescription.value.trim() } : {}),
      ...(Object.keys(labels).length ? { labels } : {}),
    }
    return unwrap(await client().POST('/floating_ips', { body }))
  }, 'Floating IP created')
  creating.value = false
  if (result !== undefined) {
    createOpen.value = false
    createType.value = 'ipv4'
    createMode.value = 'location'
    createLocation.value = ''
    createServer.value = ''
    createDescription.value = ''
    createLabels.value = ''
    void reload()
  }
}

// --- detail / edit ---
const selected = ref<FloatingIp | null>(null)
const detailOpen = ref(false)
const editDescription = ref('')
const editLabels = ref('')
const acting = ref(false)

function openDetail(ip: FloatingIp) {
  selected.value = ip
  editDescription.value = ip.description ?? ''
  editLabels.value = labelsToText(ip.labels)
  detailOpen.value = true
}

async function saveEdit() {
  const ip = selected.value
  if (!ip) return
  const result = await runAction(async () => {
    const body: RequestBody<operations['update_floating_ip']> = {
      description: editDescription.value.trim() || null,
      labels: parseLabels(editLabels.value),
    }
    return unwrap(await client().PUT('/floating_ips/{id}', { params: { path: { id: ip.id } }, body }))
  }, 'Floating IP updated')
  if (result !== undefined) {
    detailOpen.value = false
    void reload()
  }
}

// --- assign ---
const assignOpen = ref(false)
const assignServer = ref('')

async function submitAssign() {
  const ip = selected.value
  if (!ip) return
  acting.value = true
  const result = await runAction(async () => {
    const body: RequestBody<operations['assign_floating_ip']> = { server: Number(assignServer.value) }
    return unwrap(await client().POST('/floating_ips/{id}/actions/assign', { params: { path: { id: ip.id } }, body }))
  }, 'Floating IP assign started')
  acting.value = false
  if (result !== undefined) {
    assignOpen.value = false
    assignServer.value = ''
    void reload()
  }
}

// --- unassign ---
const unassignOpen = ref(false)

async function confirmUnassign() {
  const ip = selected.value
  if (!ip) return
  const result = await runAction(async () => {
    return unwrap(await client().POST('/floating_ips/{id}/actions/unassign', { params: { path: { id: ip.id } } }))
  }, 'Floating IP unassign started')
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
    const body: RequestBody<operations['change_floating_ip_dns_ptr']> = {
      ip: dnsIp.value.trim(),
      dns_ptr: dnsPtr.value.trim() || null,
    }
    return unwrap(await client().POST('/floating_ips/{id}/actions/change_dns_ptr', { params: { path: { id: ip.id } }, body }))
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
    const body: RequestBody<operations['change_floating_ip_protection']> = { delete: protectDelete.value }
    return unwrap(
      await client().POST('/floating_ips/{id}/actions/change_protection', { params: { path: { id: ip.id } }, body }),
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
    await client().DELETE('/floating_ips/{id}', { params: { path: { id: ip.id } } })
    return true
  }, 'Floating IP deleted')
  if (result !== undefined) {
    deleteOpen.value = false
    detailOpen.value = false
    void reload()
  }
}
</script>

<template>
  <div class="space-y-4">
    <PageHeader title="Floating IPs" description="Public IPs that can be reassigned between servers.">
      <Button variant="outline" size="sm" :disabled="loading" @click="reload()">
        <RefreshCw class="mr-2 size-4" />
        Refresh
      </Button>
      <Button size="sm" @click="createOpen = true">
        <Plus class="mr-2 size-4" />
        Create floating IP
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
            <TableHead>Home location</TableHead>
            <TableHead>Server</TableHead>
            <TableHead>Blocked</TableHead>
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
            <TableCell colspan="8" class="py-8 text-center text-muted-foreground">No floating IPs.</TableCell>
          </TableRow>
          <TableRow v-for="ip in items" v-else :key="ip.id" class="cursor-pointer" @click="openDetail(ip)">
            <TableCell class="font-medium font-mono text-xs">{{ ip.ip }}</TableCell>
            <TableCell><Badge variant="secondary">{{ ip.type }}</Badge></TableCell>
            <TableCell class="max-w-48 truncate" :title="dnsPtrSummary(ip)">{{ dnsPtrSummary(ip) }}</TableCell>
            <TableCell>{{ ip.home_location?.name ?? '—' }}</TableCell>
            <TableCell class="font-mono text-xs">{{ ip.server ?? '—' }}</TableCell>
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
          <DialogTitle>Create floating IP</DialogTitle>
          <DialogDescription>Provide either a home location or a server to assign to — not both.</DialogDescription>
        </DialogHeader>
        <form class="space-y-4" @submit.prevent="submitCreate">
          <div class="space-y-2">
            <Label for="fip-type">Type</Label>
            <Select v-model="createType">
              <SelectTrigger id="fip-type"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ipv4">IPv4</SelectItem>
                <SelectItem value="ipv6">IPv6</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div class="space-y-2">
            <Label for="fip-mode">Bind to</Label>
            <Select v-model="createMode">
              <SelectTrigger id="fip-mode"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="location">Home location</SelectItem>
                <SelectItem value="server">Server (assign on create)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div v-if="createMode === 'location'" class="space-y-2">
            <Label for="fip-location">Home location</Label>
            <Select v-model="createLocation">
              <SelectTrigger id="fip-location"><SelectValue placeholder="Select a location" /></SelectTrigger>
              <SelectContent>
                <SelectItem v-for="loc in locations" :key="loc.id" :value="loc.name">
                  {{ loc.name }} — {{ loc.description }}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div v-else class="space-y-2">
            <Label for="fip-server">Server ID</Label>
            <Input id="fip-server" v-model="createServer" type="number" min="1" required />
          </div>
          <p v-if="createPriceLabel" class="text-xs text-muted-foreground">{{ createPriceLabel }}</p>
          <div class="space-y-2">
            <Label for="fip-description">Description</Label>
            <Input id="fip-description" v-model="createDescription" />
          </div>
          <div class="space-y-2">
            <Label for="fip-labels">Labels (one key=value per line)</Label>
            <Textarea id="fip-labels" v-model="createLabels" rows="2" class="font-mono text-xs" />
          </div>
          <DialogFooter>
            <Button type="submit" :disabled="creating || !createValid">Create</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>

    <DetailSheet v-model:open="detailOpen" :title="selected?.ip ?? 'Floating IP'" description="Floating IP details">
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
                <DropdownMenuItem :disabled="selected.server === null" @click="unassignOpen = true">Unassign…</DropdownMenuItem>
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
              { label: 'Description', value: selected.description },
              { label: 'DNS PTR', value: dnsPtrSummary(selected) },
              { label: 'Home location', value: selected.home_location?.name },
              { label: 'Server', value: selected.server },
              { label: 'Blocked', value: selected.blocked ? 'yes' : 'no' },
              { label: 'Protection', value: `delete: ${selected.protection?.delete ?? false}` },
              { label: 'Created', value: selected.created ? new Date(selected.created).toLocaleString() : null },
            ]"
          />
        </TabsContent>
        <TabsContent value="edit" class="mt-4">
          <form class="space-y-4" @submit.prevent="saveEdit">
            <div class="space-y-2">
              <Label for="fip-edit-description">Description</Label>
              <Input id="fip-edit-description" v-model="editDescription" />
            </div>
            <div class="space-y-2">
              <Label for="fip-edit-labels">Labels</Label>
              <Textarea id="fip-edit-labels" v-model="editLabels" rows="3" class="font-mono text-xs" />
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
          <DialogTitle>Assign floating IP</DialogTitle>
          <DialogDescription>Assign '{{ selected?.ip }}' to a server.</DialogDescription>
        </DialogHeader>
        <form class="space-y-4" @submit.prevent="submitAssign">
          <div class="space-y-2">
            <Label for="fip-assign-server">Server ID</Label>
            <Input id="fip-assign-server" v-model="assignServer" type="number" min="1" required />
          </div>
          <DialogFooter>
            <Button type="submit" :disabled="acting || !Number(assignServer)">Assign</Button>
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
            <Label for="fip-dns-ip">IP address</Label>
            <Input id="fip-dns-ip" v-model="dnsIp" class="font-mono text-xs" required />
          </div>
          <div class="space-y-2">
            <Label for="fip-dns-ptr">DNS PTR</Label>
            <Input id="fip-dns-ptr" v-model="dnsPtr" placeholder="server.example.com" />
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
            <Checkbox id="fip-protect-delete" v-model:checked="protectDelete" />
            <Label for="fip-protect-delete">Protect from deletion</Label>
          </div>
          <DialogFooter>
            <Button type="submit" :disabled="acting">Save</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>

    <ConfirmDialog
      v-model:open="unassignOpen"
      title="Unassign floating IP?"
      :description="`This will unassign '${selected?.ip}' from server ${selected?.server}. The IP will be unreachable.`"
      confirm-label="Unassign"
      @confirm="confirmUnassign"
    />
    <ConfirmDialog
      v-model:open="deleteOpen"
      title="Delete floating IP?"
      :description="`This will permanently delete '${selected?.ip}'.`"
      confirm-label="Delete"
      destructive
      @confirm="confirmDelete"
    />
  </div>
</template>
