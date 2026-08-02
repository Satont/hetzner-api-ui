<script setup lang="ts">
import { ref } from 'vue'
import { Plus, RefreshCw, Trash2 } from 'lucide-vue-next'
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
import SubnetsEditor, { emptySubnetRow, NETWORK_ZONES, type SubnetRow } from './SubnetsEditor.vue'
import RoutesEditor, { type RouteRow } from './RoutesEditor.vue'
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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'

type Network = ListItem<operations['list_networks'], 'networks'>
type CreateNetworkBody = RequestBody<operations['create_network']>
type SubnetInput = NonNullable<CreateNetworkBody['subnets']>[number]
type RouteInput = NonNullable<CreateNetworkBody['routes']>[number]

const { client, unwrap } = useApi()

const { items, loading, error, pageInfo, reload } = usePagedResource<Network>(async ({ page, per_page }) => {
  const data = unwrap(await client().GET('/networks', { params: { query: { page, per_page } } }))
  return { items: data.networks ?? [], pagination: data.meta?.pagination ?? {} }
})

// --- create ---
const createOpen = ref(false)
const createName = ref('')
const createIpRange = ref('')
const createLabels = ref('')
const createSubnets = ref<SubnetRow[]>([])
const createRoutes = ref<RouteRow[]>([])
const creating = ref(false)

function subnetRowsToInput(rows: SubnetRow[]): SubnetInput[] {
  return rows.map((row) => ({
    type: row.type,
    network_zone: row.network_zone,
    ...(row.ip_range.trim() ? { ip_range: row.ip_range.trim() } : {}),
    ...(row.type === 'vswitch' && row.vswitch_id.trim() ? { vswitch_id: Number(row.vswitch_id.trim()) } : {}),
  }))
}

function routeRowsToInput(rows: RouteRow[]): RouteInput[] {
  return rows
    .filter((row) => row.destination.trim() && row.gateway.trim())
    .map((row) => ({ destination: row.destination.trim(), gateway: row.gateway.trim() }))
}

async function submitCreate() {
  creating.value = true
  const result = await runAction(async () => {
    const labels = parseLabels(createLabels.value)
    const subnets = subnetRowsToInput(createSubnets.value)
    const routes = routeRowsToInput(createRoutes.value)
    return unwrap(
      await client().POST('/networks', {
        body: {
          name: createName.value.trim(),
          ip_range: createIpRange.value.trim(),
          ...(Object.keys(labels).length ? { labels } : {}),
          ...(subnets.length ? { subnets } : {}),
          ...(routes.length ? { routes } : {}),
        },
      }),
    )
  }, 'Network created')
  creating.value = false
  if (result !== undefined) {
    createOpen.value = false
    createName.value = ''
    createIpRange.value = ''
    createLabels.value = ''
    createSubnets.value = []
    createRoutes.value = []
    void reload()
  }
}

// --- detail ---
const selected = ref<Network | null>(null)
const detailOpen = ref(false)
const editName = ref('')
const editLabels = ref('')

function openDetail(network: Network) {
  selected.value = network
  editName.value = network.name ?? ''
  editLabels.value = labelsToText(network.labels)
  detailOpen.value = true
}

/** Refetches the open network so the sheet reflects mutations. */
async function refreshSelected() {
  const network = selected.value
  if (!network?.id) return
  const data = await runAction(async () =>
    unwrap(await client().GET('/networks/{id}', { params: { path: { id: network.id! } } })),
  )
  if (data?.network) selected.value = data.network
  void reload()
}

async function saveEdit() {
  const network = selected.value
  if (!network?.id) return
  const result = await runAction(async () => {
    return unwrap(
      await client().PUT('/networks/{id}', {
        params: { path: { id: network.id! } },
        body: { name: editName.value.trim(), labels: parseLabels(editLabels.value) },
      }),
    )
  }, 'Network updated')
  if (result !== undefined) void refreshSelected()
}

// --- add subnet ---
const addSubnetOpen = ref(false)
const addSubnetRow = ref<SubnetRow>(emptySubnetRow())

function openAddSubnet() {
  addSubnetRow.value = emptySubnetRow()
  addSubnetOpen.value = true
}

async function submitAddSubnet() {
  const network = selected.value
  if (!network?.id) return
  const row = addSubnetRow.value
  const result = await runAction(async () => {
    return unwrap(
      await client().POST('/networks/{id}/actions/add_subnet', {
        params: { path: { id: network.id! } },
        body: {
          type: row.type,
          network_zone: row.network_zone,
          ...(row.ip_range.trim() ? { ip_range: row.ip_range.trim() } : {}),
          ...(row.type === 'vswitch' && row.vswitch_id.trim() ? { vswitch_id: Number(row.vswitch_id.trim()) } : {}),
        },
      }),
    )
  }, 'Subnet added')
  if (result !== undefined) {
    addSubnetOpen.value = false
    void refreshSelected()
  }
}

// --- delete subnet ---
const deleteSubnetOpen = ref(false)
const deleteSubnetIpRange = ref('')

function openDeleteSubnet(ipRange?: string) {
  deleteSubnetIpRange.value = ipRange ?? ''
  deleteSubnetOpen.value = true
}

async function submitDeleteSubnet() {
  const network = selected.value
  if (!network?.id) return
  const result = await runAction(async () => {
    return unwrap(
      await client().POST('/networks/{id}/actions/delete_subnet', {
        params: { path: { id: network.id! } },
        body: { ip_range: deleteSubnetIpRange.value.trim() },
      }),
    )
  }, 'Subnet deleted')
  if (result !== undefined) {
    deleteSubnetOpen.value = false
    void refreshSelected()
  }
}

// --- add route ---
const addRouteOpen = ref(false)
const addRouteDestination = ref('')
const addRouteGateway = ref('')

function openAddRoute() {
  addRouteDestination.value = ''
  addRouteGateway.value = ''
  addRouteOpen.value = true
}

async function submitAddRoute() {
  const network = selected.value
  if (!network?.id) return
  const result = await runAction(async () => {
    return unwrap(
      await client().POST('/networks/{id}/actions/add_route', {
        params: { path: { id: network.id! } },
        body: { destination: addRouteDestination.value.trim(), gateway: addRouteGateway.value.trim() },
      }),
    )
  }, 'Route added')
  if (result !== undefined) {
    addRouteOpen.value = false
    void refreshSelected()
  }
}

// --- delete route ---
const deleteRouteOpen = ref(false)
const deleteRouteDestination = ref('')
const deleteRouteGateway = ref('')

function openDeleteRoute(destination: string, gateway: string) {
  deleteRouteDestination.value = destination
  deleteRouteGateway.value = gateway
  deleteRouteOpen.value = true
}

async function submitDeleteRoute() {
  const network = selected.value
  if (!network?.id) return
  const result = await runAction(async () => {
    return unwrap(
      await client().POST('/networks/{id}/actions/delete_route', {
        params: { path: { id: network.id! } },
        body: { destination: deleteRouteDestination.value.trim(), gateway: deleteRouteGateway.value.trim() },
      }),
    )
  }, 'Route deleted')
  if (result !== undefined) {
    deleteRouteOpen.value = false
    void refreshSelected()
  }
}

// --- change ip range ---
const changeIpRangeOpen = ref(false)
const changeIpRangeValue = ref('')

function openChangeIpRange() {
  changeIpRangeValue.value = selected.value?.ip_range ?? ''
  changeIpRangeOpen.value = true
}

async function submitChangeIpRange() {
  const network = selected.value
  if (!network?.id) return
  const result = await runAction(async () => {
    return unwrap(
      await client().POST('/networks/{id}/actions/change_ip_range', {
        params: { path: { id: network.id! } },
        body: { ip_range: changeIpRangeValue.value.trim() },
      }),
    )
  }, 'IP range change requested')
  if (result !== undefined) {
    changeIpRangeOpen.value = false
    void refreshSelected()
  }
}

// --- change protection ---
const protectionOpen = ref(false)
const protectDelete = ref<boolean | 'indeterminate'>(false)

function openProtection() {
  protectDelete.value = selected.value?.protection?.delete ?? false
  protectionOpen.value = true
}

async function submitProtection() {
  const network = selected.value
  if (!network?.id) return
  const result = await runAction(async () => {
    return unwrap(
      await client().POST('/networks/{id}/actions/change_protection', {
        params: { path: { id: network.id! } },
        body: { delete: protectDelete.value === true },
      }),
    )
  }, 'Protection updated')
  if (result !== undefined) {
    protectionOpen.value = false
    void refreshSelected()
  }
}

// --- delete ---
const deleteOpen = ref(false)

async function confirmDelete() {
  const network = selected.value
  if (!network?.id) return
  const result = await runAction(async () => {
    await client().DELETE('/networks/{id}', { params: { path: { id: network.id! } } })
    return true
  }, 'Network deleted')
  if (result !== undefined) {
    deleteOpen.value = false
    detailOpen.value = false
    void reload()
  }
}
</script>

<template>
  <div class="space-y-4">
    <PageHeader title="Networks" description="Private networks connecting your cloud resources.">
      <Button variant="outline" size="sm" :disabled="loading" @click="reload()">
        <RefreshCw class="mr-2 size-4" />
        Refresh
      </Button>
      <Button size="sm" @click="createOpen = true">
        <Plus class="mr-2 size-4" />
        Add network
      </Button>
    </PageHeader>

    <ErrorState v-if="error" :error="error" @retry="reload()" />

    <div class="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>IP range</TableHead>
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
            <TableCell colspan="5" class="py-8 text-center text-muted-foreground">No networks.</TableCell>
          </TableRow>
          <TableRow v-for="network in items" v-else :key="network.id" class="cursor-pointer" @click="openDetail(network)">
            <TableCell class="font-medium">{{ network.name }}</TableCell>
            <TableCell class="font-mono text-xs">{{ network.ip_range }}</TableCell>
            <TableCell>{{ network.servers?.length ?? 0 }}</TableCell>
            <TableCell><LabelsBadges :labels="network.labels" /></TableCell>
            <TableCell class="text-muted-foreground">{{ network.created ? new Date(network.created).toLocaleString() : '—' }}</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>

    <PaginationBar :page-info="pageInfo" :loading="loading" @change="reload" />

    <Dialog v-model:open="createOpen">
      <DialogContent class="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Add network</DialogTitle>
          <DialogDescription>The IP range must be a private RFC1918 range, /24 or larger.</DialogDescription>
        </DialogHeader>
        <form class="space-y-4" @submit.prevent="submitCreate">
          <div class="space-y-2">
            <Label for="net-name">Name</Label>
            <Input id="net-name" v-model="createName" required />
          </div>
          <div class="space-y-2">
            <Label for="net-ip-range">IP range</Label>
            <Input id="net-ip-range" v-model="createIpRange" class="font-mono text-xs" placeholder="10.0.0.0/16" required />
          </div>
          <div class="space-y-2">
            <Label>Subnets (optional)</Label>
            <SubnetsEditor v-model="createSubnets" />
          </div>
          <div class="space-y-2">
            <Label>Routes (optional)</Label>
            <RoutesEditor v-model="createRoutes" />
          </div>
          <div class="space-y-2">
            <Label for="net-labels">Labels (one key=value per line)</Label>
            <Textarea id="net-labels" v-model="createLabels" rows="2" class="font-mono text-xs" />
          </div>
          <DialogFooter>
            <Button type="submit" :disabled="creating">Create</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>

    <DetailSheet v-model:open="detailOpen" :title="selected?.name ?? 'Network'" description="Network details">
      <Tabs v-if="selected" default-value="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="edit">Edit</TabsTrigger>
          <TabsTrigger value="json">JSON</TabsTrigger>
        </TabsList>
        <TabsContent value="overview" class="mt-4 space-y-6">
          <KeyValue
            :items="[
              { label: 'ID', value: selected.id },
              { label: 'Name', value: selected.name },
              { label: 'IP range', value: selected.ip_range },
              { label: 'Servers', value: selected.servers?.length ?? 0 },
              { label: 'Load balancers', value: selected.load_balancers?.length ?? 0 },
              { label: 'Delete protection', value: selected.protection?.delete ? 'enabled' : 'disabled' },
              { label: 'Created', value: selected.created ? new Date(selected.created).toLocaleString() : null },
            ]"
          />

          <div class="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" @click="openAddSubnet">Add subnet</Button>
            <Button variant="outline" size="sm" @click="openAddRoute">Add route</Button>
            <Button variant="outline" size="sm" @click="openChangeIpRange">Change IP range</Button>
            <Button variant="outline" size="sm" @click="openProtection">Protection</Button>
          </div>

          <div class="space-y-2">
            <h3 class="text-sm font-medium">Subnets</h3>
            <div class="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>IP range</TableHead>
                    <TableHead>Zone</TableHead>
                    <TableHead>Gateway</TableHead>
                    <TableHead class="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow v-if="!selected.subnets?.length">
                    <TableCell colspan="5" class="py-4 text-center text-muted-foreground">No subnets.</TableCell>
                  </TableRow>
                  <TableRow v-for="subnet in selected.subnets" v-else :key="`${subnet.ip_range}-${subnet.network_zone}`">
                    <TableCell><Badge variant="outline">{{ subnet.type }}</Badge></TableCell>
                    <TableCell class="font-mono text-xs">{{ subnet.ip_range ?? '—' }}</TableCell>
                    <TableCell>{{ subnet.network_zone }}</TableCell>
                    <TableCell class="font-mono text-xs">{{ subnet.gateway }}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" @click="openDeleteSubnet(subnet.ip_range)">
                        <Trash2 class="size-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </div>

          <div class="space-y-2">
            <h3 class="text-sm font-medium">Routes</h3>
            <div class="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Destination</TableHead>
                    <TableHead>Gateway</TableHead>
                    <TableHead class="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow v-if="!selected.routes?.length">
                    <TableCell colspan="3" class="py-4 text-center text-muted-foreground">No routes.</TableCell>
                  </TableRow>
                  <TableRow v-for="route in selected.routes" v-else :key="route.destination">
                    <TableCell class="font-mono text-xs">{{ route.destination }}</TableCell>
                    <TableCell class="font-mono text-xs">{{ route.gateway }}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" @click="openDeleteRoute(route.destination, route.gateway)">
                        <Trash2 class="size-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </div>
        </TabsContent>
        <TabsContent value="edit" class="mt-4">
          <form class="space-y-4" @submit.prevent="saveEdit">
            <div class="space-y-2">
              <Label for="net-edit-name">Name</Label>
              <Input id="net-edit-name" v-model="editName" required />
            </div>
            <div class="space-y-2">
              <Label for="net-edit-labels">Labels</Label>
              <Textarea id="net-edit-labels" v-model="editLabels" rows="3" class="font-mono text-xs" />
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

    <Dialog v-model:open="addSubnetOpen">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add subnet</DialogTitle>
          <DialogDescription>Without an IP range the first available /24 range is used.</DialogDescription>
        </DialogHeader>
        <form class="space-y-4" @submit.prevent="submitAddSubnet">
          <div class="space-y-2">
            <Label>Type</Label>
            <Select v-model="addSubnetRow.type">
              <SelectTrigger>
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cloud">cloud</SelectItem>
                <SelectItem value="server">server</SelectItem>
                <SelectItem value="vswitch">vswitch</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div class="space-y-2">
            <Label>Network zone</Label>
            <Select v-model="addSubnetRow.network_zone">
              <SelectTrigger>
                <SelectValue placeholder="Network zone" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem v-for="zone in NETWORK_ZONES" :key="zone" :value="zone">{{ zone }}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div class="space-y-2">
            <Label for="add-subnet-range">IP range (optional)</Label>
            <Input id="add-subnet-range" v-model="addSubnetRow.ip_range" class="font-mono text-xs" placeholder="10.0.1.0/24" />
          </div>
          <div v-if="addSubnetRow.type === 'vswitch'" class="space-y-2">
            <Label for="add-subnet-vswitch">vSwitch ID</Label>
            <Input id="add-subnet-vswitch" v-model="addSubnetRow.vswitch_id" class="font-mono text-xs" placeholder="1000" />
          </div>
          <DialogFooter>
            <Button type="submit">Add subnet</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>

    <Dialog v-model:open="deleteSubnetOpen">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete subnet</DialogTitle>
          <DialogDescription>Subnets with attached resources cannot be deleted.</DialogDescription>
        </DialogHeader>
        <form class="space-y-4" @submit.prevent="submitDeleteSubnet">
          <div class="space-y-2">
            <Label for="del-subnet-range">Subnet IP range</Label>
            <Input id="del-subnet-range" v-model="deleteSubnetIpRange" class="font-mono text-xs" placeholder="10.0.1.0/24" required />
          </div>
          <DialogFooter>
            <Button type="submit" variant="destructive">Delete subnet</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>

    <Dialog v-model:open="addRouteOpen">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add route</DialogTitle>
          <DialogDescription>Destination must be a private RFC1918 range or 0.0.0.0/0.</DialogDescription>
        </DialogHeader>
        <form class="space-y-4" @submit.prevent="submitAddRoute">
          <div class="space-y-2">
            <Label for="add-route-dest">Destination</Label>
            <Input id="add-route-dest" v-model="addRouteDestination" class="font-mono text-xs" placeholder="10.100.1.0/24" required />
          </div>
          <div class="space-y-2">
            <Label for="add-route-gw">Gateway</Label>
            <Input id="add-route-gw" v-model="addRouteGateway" class="font-mono text-xs" placeholder="10.0.1.1" required />
          </div>
          <DialogFooter>
            <Button type="submit">Add route</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>

    <Dialog v-model:open="deleteRouteOpen">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete route</DialogTitle>
          <DialogDescription>Removes the route entry from this network.</DialogDescription>
        </DialogHeader>
        <form class="space-y-4" @submit.prevent="submitDeleteRoute">
          <div class="space-y-2">
            <Label for="del-route-dest">Destination</Label>
            <Input id="del-route-dest" v-model="deleteRouteDestination" class="font-mono text-xs" required />
          </div>
          <div class="space-y-2">
            <Label for="del-route-gw">Gateway</Label>
            <Input id="del-route-gw" v-model="deleteRouteGateway" class="font-mono text-xs" required />
          </div>
          <DialogFooter>
            <Button type="submit" variant="destructive">Delete route</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>

    <Dialog v-model:open="changeIpRangeOpen">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Change IP range</DialogTitle>
          <DialogDescription>
            Destructive: the range can only be extended, never shrunk, and the network address must stay the same.
            Attached servers need a reboot or manual route updates afterwards.
          </DialogDescription>
        </DialogHeader>
        <form class="space-y-4" @submit.prevent="submitChangeIpRange">
          <div class="space-y-2">
            <Label for="change-ip-range">New IP range</Label>
            <Input id="change-ip-range" v-model="changeIpRangeValue" class="font-mono text-xs" placeholder="10.0.0.0/15" required />
          </div>
          <DialogFooter>
            <Button type="submit" variant="destructive">Change IP range</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>

    <Dialog v-model:open="protectionOpen">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Change protection</DialogTitle>
          <DialogDescription>Protected networks cannot be deleted.</DialogDescription>
        </DialogHeader>
        <form class="space-y-4" @submit.prevent="submitProtection">
          <div class="flex items-center gap-2">
            <Checkbox id="protect-delete" v-model="protectDelete" />
            <Label for="protect-delete">Protect from deletion</Label>
          </div>
          <DialogFooter>
            <Button type="submit">Save</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>

    <ConfirmDialog
      v-model:open="deleteOpen"
      title="Delete network?"
      :description="`This will permanently delete '${selected?.name}'. Attached resources will be detached automatically.`"
      confirm-label="Delete"
      destructive
      @confirm="confirmDelete"
    />
  </div>
</template>
