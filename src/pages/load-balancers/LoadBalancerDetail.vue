<script setup lang="ts">
import { ref, watch } from 'vue'
import { Pencil, Plus, Trash2 } from 'lucide-vue-next'
import { useApi } from '@/composables/useApi'
import { runAction } from '@/composables/usePagedResource'
import { parseLabels, labelsToText } from '@/lib/labels'
import type { ListItem, RequestBody, ResponseItem } from '@/api/client'
import type { operations } from '@/api/schema'
import DetailSheet from '@/components/shared/DetailSheet.vue'
import ConfirmDialog from '@/components/shared/ConfirmDialog.vue'
import KeyValue from '@/components/shared/KeyValue.vue'
import LabelsBadges from '@/components/shared/LabelsBadges.vue'
import JsonBlock from '@/components/shared/JsonBlock.vue'
import MetricsChart from './MetricsChart.vue'
import ServiceFormDialog from './ServiceFormDialog.vue'
import TargetFormDialog from './TargetFormDialog.vue'
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'

type LoadBalancer = ListItem<operations['list_load_balancers'], 'load_balancers'>
type LBService = LoadBalancer['services'][number]
type LBTarget = LoadBalancer['targets'][number]
type LBType = ListItem<operations['list_load_balancer_types'], 'load_balancer_types'>
type RemoveTargetBody = RequestBody<operations['remove_load_balancer_target']>
type Metrics = ResponseItem<operations['get_load_balancer_metrics'], 'metrics'>

const props = defineProps<{
  lb: LoadBalancer
}>()

const emit = defineEmits<{ mutated: []; deleted: [] }>()
const open = defineModel<boolean>('open', { default: false })

const { client, unwrap } = useApi()

function fmtDate(value: string | null | undefined): string | null {
  return value ? new Date(value).toLocaleString() : null
}

function targetTypeOf(t: LBTarget): string {
  if ('server' in t) return 'server'
  if ('label_selector' in t) return 'label_selector'
  return 'ip'
}

function targetSummary(t: LBTarget): string {
  if ('server' in t) return `server #${t.server.id}`
  if ('label_selector' in t) return t.label_selector.selector
  return t.ip.ip
}

function targetHealth(t: LBTarget): string {
  if ('health_status' in t && t.health_status.length) {
    return t.health_status.map((h) => `${h.listen_port}: ${h.status}`).join(', ')
  }
  return '—'
}

function targetPrivateIp(t: LBTarget): string {
  if ('use_private_ip' in t) return t.use_private_ip ? 'yes' : 'no'
  return '—'
}

function healthSummary(svc: LBService): string {
  const hc = svc.health_check
  const base = `${hc.protocol}:${hc.port} · every ${hc.interval}s · timeout ${hc.timeout}s · ${hc.retries} retries`
  if (hc.protocol === 'http' && hc.http) {
    return `${base} · ${hc.http.tls ? 'https' : 'http'}://${hc.http.domain ?? ''}${hc.http.path}`
  }
  return base
}

function targetBodyForRemove(t: LBTarget): RemoveTargetBody {
  if ('server' in t) return { type: 'server', server: { id: t.server.id } }
  if ('label_selector' in t) return { type: 'label_selector', label_selector: { selector: t.label_selector.selector } }
  return { type: 'ip', ip: { ip: t.ip.ip } }
}

// --- edit ---
const editName = ref('')
const editLabels = ref('')

watch(
  () => props.lb,
  (lb) => {
    editName.value = lb.name ?? ''
    editLabels.value = labelsToText(lb.labels)
  },
  { immediate: true },
)

async function saveEdit() {
  const result = await runAction(async () => {
    return unwrap(
      await client().PUT('/load_balancers/{id}', {
        params: { path: { id: props.lb.id } },
        body: { name: editName.value.trim(), labels: parseLabels(editLabels.value) },
      }),
    )
  }, 'Load Balancer updated')
  if (result !== undefined) emit('mutated')
}

// --- delete ---
const deleteOpen = ref(false)

async function confirmDelete() {
  const result = await runAction(async () => {
    await client().DELETE('/load_balancers/{id}', { params: { path: { id: props.lb.id } } })
    return true
  }, 'Load Balancer deleted')
  if (result !== undefined) {
    deleteOpen.value = false
    open.value = false
    emit('deleted')
  }
}

// --- services ---
const serviceDialogOpen = ref(false)
const editingService = ref<LBService | null>(null)
const deleteServiceOpen = ref(false)
const deletingService = ref<LBService | null>(null)

function openAddService() {
  editingService.value = null
  serviceDialogOpen.value = true
}

function openEditService(svc: LBService) {
  editingService.value = svc
  serviceDialogOpen.value = true
}

function askDeleteService(svc: LBService) {
  deletingService.value = svc
  deleteServiceOpen.value = true
}

async function confirmDeleteService() {
  const svc = deletingService.value
  if (!svc) return
  const result = await runAction(async () => {
    return unwrap(
      await client().POST('/load_balancers/{id}/actions/delete_service', {
        params: { path: { id: props.lb.id } },
        body: { listen_port: svc.listen_port },
      }),
    )
  }, 'Service deleted')
  if (result !== undefined) {
    deleteServiceOpen.value = false
    emit('mutated')
  }
}

// --- targets ---
const targetDialogOpen = ref(false)
const removeTargetOpen = ref(false)
const removingTarget = ref<LBTarget | null>(null)

function askRemoveTarget(t: LBTarget) {
  removingTarget.value = t
  removeTargetOpen.value = true
}

async function confirmRemoveTarget() {
  const t = removingTarget.value
  if (!t) return
  const result = await runAction(async () => {
    return unwrap(
      await client().POST('/load_balancers/{id}/actions/remove_target', {
        params: { path: { id: props.lb.id } },
        body: targetBodyForRemove(t),
      }),
    )
  }, 'Target removed')
  if (result !== undefined) {
    removeTargetOpen.value = false
    emit('mutated')
  }
}

// --- actions: attach / detach ---
const attachOpen = ref(false)
const attachNetwork = ref('')
const attachIp = ref('')

async function submitAttach() {
  const result = await runAction(async () => {
    return unwrap(
      await client().POST('/load_balancers/{id}/actions/attach_to_network', {
        params: { path: { id: props.lb.id } },
        body: {
          network: Number(attachNetwork.value),
          ...(attachIp.value.trim() ? { ip: attachIp.value.trim() } : {}),
        },
      }),
    )
  }, 'Attach to network requested')
  if (result !== undefined) {
    attachOpen.value = false
    attachNetwork.value = ''
    attachIp.value = ''
    emit('mutated')
  }
}

const detachOpen = ref(false)
const detachNetwork = ref('')

async function submitDetach() {
  const result = await runAction(async () => {
    return unwrap(
      await client().POST('/load_balancers/{id}/actions/detach_from_network', {
        params: { path: { id: props.lb.id } },
        body: { network: Number(detachNetwork.value) },
      }),
    )
  }, 'Detach from network requested')
  if (result !== undefined) {
    detachOpen.value = false
    detachNetwork.value = ''
    emit('mutated')
  }
}

// --- actions: algorithm / type ---
const algoOpen = ref(false)
const algoType = ref('')

watch(algoOpen, (isOpen) => {
  if (isOpen) algoType.value = props.lb.algorithm.type
})

async function submitAlgorithm() {
  const result = await runAction(async () => {
    return unwrap(
      await client().POST('/load_balancers/{id}/actions/change_algorithm', {
        params: { path: { id: props.lb.id } },
        body: { type: algoType.value === 'least_connections' ? 'least_connections' : 'round_robin' },
      }),
    )
  }, 'Algorithm change requested')
  if (result !== undefined) {
    algoOpen.value = false
    emit('mutated')
  }
}

const typeOpen = ref(false)
const typeName = ref('')
const lbTypes = ref<LBType[]>([])
const lbTypesLoading = ref(false)

watch(typeOpen, async (isOpen) => {
  if (!isOpen) return
  typeName.value = props.lb.load_balancer_type.name
  if (lbTypes.value.length || lbTypesLoading.value) return
  lbTypesLoading.value = true
  const data = await runAction(async () => {
    return unwrap(await client().GET('/load_balancer_types', {}))
  })
  lbTypesLoading.value = false
  if (data) lbTypes.value = data.load_balancer_types ?? []
})

async function submitChangeType() {
  const result = await runAction(async () => {
    return unwrap(
      await client().POST('/load_balancers/{id}/actions/change_type', {
        params: { path: { id: props.lb.id } },
        body: { load_balancer_type: typeName.value },
      }),
    )
  }, 'Type change requested')
  if (result !== undefined) {
    typeOpen.value = false
    emit('mutated')
  }
}

// --- actions: public interface ---
async function enablePublicInterface() {
  const result = await runAction(async () => {
    return unwrap(
      await client().POST('/load_balancers/{id}/actions/enable_public_interface', {
        params: { path: { id: props.lb.id } },
      }),
    )
  }, 'Enable public interface requested')
  if (result !== undefined) emit('mutated')
}

const disablePublicOpen = ref(false)

async function confirmDisablePublic() {
  const result = await runAction(async () => {
    return unwrap(
      await client().POST('/load_balancers/{id}/actions/disable_public_interface', {
        params: { path: { id: props.lb.id } },
      }),
    )
  }, 'Disable public interface requested')
  if (result !== undefined) {
    disablePublicOpen.value = false
    emit('mutated')
  }
}

// --- actions: dns ptr ---
const dnsOpen = ref(false)
const dnsIp = ref('')
const dnsPtr = ref('')

watch(dnsOpen, (isOpen) => {
  if (!isOpen) return
  dnsIp.value = props.lb.public_net.ipv4.ip ?? ''
  dnsPtr.value = props.lb.public_net.ipv4.dns_ptr ?? ''
})

async function submitDnsPtr() {
  const result = await runAction(async () => {
    return unwrap(
      await client().POST('/load_balancers/{id}/actions/change_dns_ptr', {
        params: { path: { id: props.lb.id } },
        body: { ip: dnsIp.value.trim(), dns_ptr: dnsPtr.value.trim() || null },
      }),
    )
  }, 'Reverse DNS change requested')
  if (result !== undefined) {
    dnsOpen.value = false
    emit('mutated')
  }
}

// --- actions: protection ---
const protectOpen = ref(false)
const protectDelete = ref(false)

watch(protectOpen, (isOpen) => {
  if (isOpen) protectDelete.value = props.lb.protection.delete
})

async function submitProtection() {
  const result = await runAction(async () => {
    return unwrap(
      await client().POST('/load_balancers/{id}/actions/change_protection', {
        params: { path: { id: props.lb.id } },
        body: { delete: protectDelete.value },
      }),
    )
  }, 'Protection updated')
  if (result !== undefined) {
    protectOpen.value = false
    emit('mutated')
  }
}

// --- metrics ---
const METRIC_TYPES = ['open_connections', 'connections_per_second', 'requests_per_second', 'bandwidth'] as const

const metricType = ref<string>('open_connections')
const metricLoading = ref(false)
const metrics = ref<Metrics | null>(null)

function toLocalInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

const metricStart = ref(toLocalInput(new Date(Date.now() - 3600_000)))
const metricEnd = ref(toLocalInput(new Date()))
const metricStep = ref('60')

async function loadMetrics() {
  const type = METRIC_TYPES.find((m) => m === metricType.value) ?? 'open_connections'
  metricLoading.value = true
  const data = await runAction(async () => {
    return unwrap(
      await client().GET('/load_balancers/{id}/metrics', {
        params: {
          path: { id: props.lb.id },
          query: {
            type: [type],
            start: new Date(metricStart.value).toISOString(),
            end: new Date(metricEnd.value).toISOString(),
            ...(metricStep.value.trim() ? { step: metricStep.value.trim() } : {}),
          },
        },
      }),
    )
  })
  metricLoading.value = false
  if (data) metrics.value = data.metrics as Metrics
}
</script>

<template>
  <DetailSheet v-model:open="open" :title="lb.name" description="Load Balancer details">
    <Tabs default-value="overview">
      <TabsList class="flex-wrap">
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="services">Services</TabsTrigger>
        <TabsTrigger value="targets">Targets</TabsTrigger>
        <TabsTrigger value="actions">Actions</TabsTrigger>
        <TabsTrigger value="metrics">Metrics</TabsTrigger>
        <TabsTrigger value="edit">Edit</TabsTrigger>
        <TabsTrigger value="json">JSON</TabsTrigger>
      </TabsList>

      <TabsContent value="overview" class="mt-4 space-y-4">
        <KeyValue
          :items="[
            { label: 'ID', value: lb.id },
            { label: 'Name', value: lb.name },
            { label: 'Public IPv4', value: lb.public_net.ipv4.ip, mask: true },
            { label: 'IPv4 DNS PTR', value: lb.public_net.ipv4.dns_ptr },
            { label: 'Public IPv6', value: lb.public_net.ipv6.ip, mask: true },
            { label: 'IPv6 DNS PTR', value: lb.public_net.ipv6.dns_ptr },
            { label: 'Public interface', value: lb.public_net.enabled ? 'enabled' : 'disabled' },
            {
              label: 'Private networks',
              value: lb.private_net.length ? lb.private_net.map((n) => `#${n.network} · ${n.ip}`).join(', ') : null,
              mask: true,
            },
            { label: 'Type', value: `${lb.load_balancer_type.name} (${lb.load_balancer_type.description})` },
            { label: 'Location', value: `${lb.location.name} · ${lb.location.city}, ${lb.location.country}` },
            { label: 'Algorithm', value: lb.algorithm.type },
            { label: 'Protection', value: lb.protection.delete ? 'delete' : null },
            { label: 'Created', value: fmtDate(lb.created) },
          ]"
        />
        <div class="space-y-1">
          <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">Labels</p>
          <LabelsBadges :labels="lb.labels" />
        </div>
      </TabsContent>

      <TabsContent value="services" class="mt-4 space-y-3">
        <div class="flex justify-end">
          <Button size="sm" @click="openAddService">
            <Plus class="mr-2 size-4" />
            Add service
          </Button>
        </div>
        <div class="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Protocol</TableHead>
                <TableHead>Listen</TableHead>
                <TableHead>Destination</TableHead>
                <TableHead>Proxy</TableHead>
                <TableHead>Health check</TableHead>
                <TableHead class="w-20" />
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow v-if="!lb.services.length">
                <TableCell colspan="6" class="py-6 text-center text-muted-foreground">No services.</TableCell>
              </TableRow>
              <TableRow v-for="svc in lb.services" v-else :key="svc.listen_port">
                <TableCell><span class="font-mono text-xs">{{ svc.protocol }}</span></TableCell>
                <TableCell>{{ svc.listen_port }}</TableCell>
                <TableCell>{{ svc.destination_port }}</TableCell>
                <TableCell>{{ svc.proxyprotocol ? 'yes' : 'no' }}</TableCell>
                <TableCell class="text-xs text-muted-foreground">{{ healthSummary(svc) }}</TableCell>
                <TableCell>
                  <div class="flex justify-end gap-1">
                    <Button variant="ghost" size="icon" @click="openEditService(svc)">
                      <Pencil class="size-4" />
                    </Button>
                    <Button variant="ghost" size="icon" @click="askDeleteService(svc)">
                      <Trash2 class="size-4 text-destructive" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </TabsContent>

      <TabsContent value="targets" class="mt-4 space-y-3">
        <div class="flex justify-end">
          <Button size="sm" @click="targetDialogOpen = true">
            <Plus class="mr-2 size-4" />
            Add target
          </Button>
        </div>
        <div class="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>Target</TableHead>
                <TableHead>Health status</TableHead>
                <TableHead>Private IP</TableHead>
                <TableHead class="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow v-if="!lb.targets.length">
                <TableCell colspan="5" class="py-6 text-center text-muted-foreground">No targets.</TableCell>
              </TableRow>
              <TableRow v-for="(t, i) in lb.targets" v-else :key="i">
                <TableCell><span class="font-mono text-xs">{{ targetTypeOf(t) }}</span></TableCell>
                <TableCell class="font-mono text-xs">{{ targetSummary(t) }}</TableCell>
                <TableCell class="text-xs text-muted-foreground">{{ targetHealth(t) }}</TableCell>
                <TableCell>{{ targetPrivateIp(t) }}</TableCell>
                <TableCell>
                  <Button variant="ghost" size="icon" @click="askRemoveTarget(t)">
                    <Trash2 class="size-4 text-destructive" />
                  </Button>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </TabsContent>

      <TabsContent value="actions" class="mt-4">
        <div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <Button variant="outline" size="sm" @click="attachOpen = true">Attach to network</Button>
          <Button variant="outline" size="sm" @click="detachOpen = true">Detach from network</Button>
          <Button variant="outline" size="sm" @click="algoOpen = true">Change algorithm</Button>
          <Button variant="outline" size="sm" @click="typeOpen = true">Change type</Button>
          <Button variant="outline" size="sm" :disabled="lb.public_net.enabled" @click="enablePublicInterface">
            Enable public interface
          </Button>
          <Button variant="outline" size="sm" :disabled="!lb.public_net.enabled" @click="disablePublicOpen = true">
            Disable public interface
          </Button>
          <Button variant="outline" size="sm" @click="dnsOpen = true">Change DNS PTR</Button>
          <Button variant="outline" size="sm" @click="protectOpen = true">Change protection</Button>
        </div>
      </TabsContent>

      <TabsContent value="metrics" class="mt-4 space-y-3">
        <div class="grid grid-cols-2 gap-3">
          <div class="space-y-2">
            <Label>Metric</Label>
            <Select v-model="metricType">
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem v-for="m in METRIC_TYPES" :key="m" :value="m">{{ m }}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div class="space-y-2">
            <Label for="lb-metric-step">Step (seconds)</Label>
            <Input id="lb-metric-step" v-model="metricStep" type="number" min="1" />
          </div>
          <div class="space-y-2">
            <Label for="lb-metric-start">Start</Label>
            <Input id="lb-metric-start" v-model="metricStart" type="datetime-local" />
          </div>
          <div class="space-y-2">
            <Label for="lb-metric-end">End</Label>
            <Input id="lb-metric-end" v-model="metricEnd" type="datetime-local" />
          </div>
        </div>
        <Button size="sm" :disabled="metricLoading" @click="loadMetrics">
          {{ metricLoading ? 'Loading…' : 'Load metrics' }}
        </Button>
        <MetricsChart
          v-if="metrics"
          :series="Object.entries(metrics.time_series).map(([name, ts]) => ({ name, values: ts.values }))"
        />
      </TabsContent>

      <TabsContent value="edit" class="mt-4">
        <form class="space-y-4" @submit.prevent="saveEdit">
          <div class="space-y-2">
            <Label for="lb-edit-name">Name</Label>
            <Input id="lb-edit-name" v-model="editName" required />
          </div>
          <div class="space-y-2">
            <Label for="lb-edit-labels">Labels</Label>
            <Textarea id="lb-edit-labels" v-model="editLabels" rows="3" class="font-mono text-xs" />
          </div>
          <div class="flex items-center justify-between">
            <Button type="button" variant="destructive" @click="deleteOpen = true">Delete</Button>
            <Button type="submit">Save</Button>
          </div>
        </form>
      </TabsContent>

      <TabsContent value="json" class="mt-4">
        <JsonBlock :data="lb" />
      </TabsContent>
    </Tabs>

    <ServiceFormDialog v-model:open="serviceDialogOpen" :lb-id="lb.id" :initial="editingService" @saved="emit('mutated')" />
    <TargetFormDialog v-model:open="targetDialogOpen" :lb-id="lb.id" @saved="emit('mutated')" />

    <ConfirmDialog
      v-model:open="deleteOpen"
      title="Delete Load Balancer?"
      :description="`This will permanently delete '${lb.name}'.`"
      confirm-label="Delete"
      destructive
      @confirm="confirmDelete"
    />
    <ConfirmDialog
      v-model:open="deleteServiceOpen"
      title="Delete service?"
      :description="`This will delete the service listening on port ${deletingService?.listen_port}.`"
      confirm-label="Delete"
      destructive
      @confirm="confirmDeleteService"
    />
    <ConfirmDialog
      v-model:open="removeTargetOpen"
      title="Remove target?"
      :description="`This will remove target '${removingTarget ? targetSummary(removingTarget) : ''}'.`"
      confirm-label="Remove"
      destructive
      @confirm="confirmRemoveTarget"
    />
    <ConfirmDialog
      v-model:open="disablePublicOpen"
      title="Disable public interface?"
      description="The Load Balancer will no longer be accessible from the internet via its public IPs."
      confirm-label="Disable"
      destructive
      @confirm="confirmDisablePublic"
    />

    <Dialog v-model:open="attachOpen">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Attach to network</DialogTitle>
          <DialogDescription>Attach this Load Balancer to a private network.</DialogDescription>
        </DialogHeader>
        <form class="space-y-4" @submit.prevent="submitAttach">
          <div class="space-y-2">
            <Label for="lb-attach-net">Network ID</Label>
            <Input id="lb-attach-net" v-model="attachNetwork" type="number" min="1" required />
          </div>
          <div class="space-y-2">
            <Label for="lb-attach-ip">IP (optional)</Label>
            <Input id="lb-attach-ip" v-model="attachIp" placeholder="10.0.1.1" />
          </div>
          <DialogFooter>
            <Button type="submit">Attach</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>

    <Dialog v-model:open="detachOpen">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Detach from network</DialogTitle>
          <DialogDescription>
            Attached: {{ lb.private_net.length ? lb.private_net.map((n) => `#${n.network}`).join(', ') : 'none' }}
          </DialogDescription>
        </DialogHeader>
        <form class="space-y-4" @submit.prevent="submitDetach">
          <div class="space-y-2">
            <Label for="lb-detach-net">Network ID</Label>
            <Input id="lb-detach-net" v-model="detachNetwork" type="number" min="1" required />
          </div>
          <DialogFooter>
            <Button type="submit" variant="destructive">Detach</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>

    <Dialog v-model:open="algoOpen">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Change algorithm</DialogTitle>
          <DialogDescription>Select the balancing algorithm.</DialogDescription>
        </DialogHeader>
        <form class="space-y-4" @submit.prevent="submitAlgorithm">
          <div class="space-y-2">
            <Label>Algorithm</Label>
            <Select v-model="algoType">
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="round_robin">round_robin</SelectItem>
                <SelectItem value="least_connections">least_connections</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button type="submit">Change</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>

    <Dialog v-model:open="typeOpen">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Change type</DialogTitle>
          <DialogDescription>Migrate this Load Balancer to another type.</DialogDescription>
        </DialogHeader>
        <form class="space-y-4" @submit.prevent="submitChangeType">
          <div class="space-y-2">
            <Label>Load Balancer type</Label>
            <Select v-model="typeName">
              <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
              <SelectContent>
                <SelectItem v-for="t in lbTypes" :key="t.id" :value="t.name">{{ t.name }} — {{ t.description }}</SelectItem>
              </SelectContent>
            </Select>
            <p v-if="lbTypesLoading" class="text-xs text-muted-foreground">Loading types…</p>
          </div>
          <DialogFooter>
            <Button type="submit" :disabled="!typeName">Change</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>

    <Dialog v-model:open="dnsOpen">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Change DNS PTR</DialogTitle>
          <DialogDescription>Set the reverse DNS entry for a public IP of this Load Balancer.</DialogDescription>
        </DialogHeader>
        <form class="space-y-4" @submit.prevent="submitDnsPtr">
          <div class="space-y-2">
            <Label for="lb-dns-ip">IP address</Label>
            <Input id="lb-dns-ip" v-model="dnsIp" required />
          </div>
          <div class="space-y-2">
            <Label for="lb-dns-ptr">DNS PTR (empty to reset)</Label>
            <Input id="lb-dns-ptr" v-model="dnsPtr" placeholder="lb1.example.com" />
          </div>
          <DialogFooter>
            <Button type="submit">Change</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>

    <Dialog v-model:open="protectOpen">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Change protection</DialogTitle>
          <DialogDescription>Protect this Load Balancer from accidental deletion.</DialogDescription>
        </DialogHeader>
        <form class="space-y-4" @submit.prevent="submitProtection">
          <div class="flex items-center gap-2">
            <Checkbox id="lb-protect-delete" :model-value="protectDelete" @update:model-value="protectDelete = $event === true" />
            <Label for="lb-protect-delete">Protect from deletion</Label>
          </div>
          <DialogFooter>
            <Button type="submit">Save</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  </DetailSheet>
</template>
