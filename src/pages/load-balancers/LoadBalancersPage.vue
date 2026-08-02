<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Plus, RefreshCw } from 'lucide-vue-next'
import { useApi } from '@/composables/useApi'
import { usePagedResource, runAction } from '@/composables/usePagedResource'
import { parseLabels } from '@/lib/labels'
import type { ListItem, RequestBody } from '@/api/client'
import type { operations } from '@/api/schema'
import PageHeader from '@/components/shared/PageHeader.vue'
import PaginationBar from '@/components/shared/PaginationBar.vue'
import ErrorState from '@/components/shared/ErrorState.vue'
import LabelsBadges from '@/components/shared/LabelsBadges.vue'
import LoadBalancerDetail from './LoadBalancerDetail.vue'
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
import { Textarea } from '@/components/ui/textarea'

type LoadBalancer = ListItem<operations['list_load_balancers'], 'load_balancers'>
type LBType = ListItem<operations['list_load_balancer_types'], 'load_balancer_types'>
type Location = ListItem<operations['list_locations'], 'locations'>
type CreateLbBody = RequestBody<operations['create_load_balancer']>

const { client, unwrap } = useApi()

const { items, loading, error, pageInfo, reload } = usePagedResource<LoadBalancer>(async ({ page, per_page }) => {
  const data = unwrap(await client().GET('/load_balancers', { params: { query: { page, per_page } } }))
  return { items: data.load_balancers ?? [], pagination: data.meta?.pagination ?? {} }
})

// --- create ---
const createOpen = ref(false)
const createName = ref('')
const createType = ref('')
const placementMode = ref<'location' | 'network_zone'>('location')
const createLocation = ref('')
const createZone = ref('')
const createNetwork = ref('')
const createAlgo = ref('round_robin')
const createLabels = ref('')
const creating = ref(false)

const lbTypes = ref<LBType[]>([])
const locations = ref<Location[]>([])
const createDataLoading = ref(false)

const networkZones = computed(() => [...new Set(locations.value.map((l) => l.network_zone))])

watch(createOpen, async (isOpen) => {
  if (!isOpen || createDataLoading.value) return
  createDataLoading.value = true
  const [types, locs] = await Promise.all([
    runAction(async () => unwrap(await client().GET('/load_balancer_types', {}))),
    runAction(async () => unwrap(await client().GET('/locations', {}))),
  ])
  createDataLoading.value = false
  if (types) {
    lbTypes.value = types.load_balancer_types ?? []
    if (!createType.value && lbTypes.value.length) createType.value = lbTypes.value[0]!.name
  }
  if (locs) {
    locations.value = locs.locations ?? []
    if (!createLocation.value && locations.value.length) createLocation.value = locations.value[0]!.name
    if (!createZone.value && networkZones.value.length) createZone.value = networkZones.value[0]!
  }
})

async function submitCreate() {
  const labels = parseLabels(createLabels.value)
  const body: CreateLbBody = {
    name: createName.value.trim(),
    load_balancer_type: createType.value,
    algorithm: { type: createAlgo.value === 'least_connections' ? 'least_connections' : 'round_robin' },
    ...(placementMode.value === 'location'
      ? { location: createLocation.value }
      : { network_zone: createZone.value }),
    ...(createNetwork.value.trim() ? { network: Number(createNetwork.value) } : {}),
    ...(Object.keys(labels).length ? { labels } : {}),
  }
  creating.value = true
  const result = await runAction(async () => {
    return unwrap(await client().POST('/load_balancers', { body }))
  }, 'Load Balancer created')
  creating.value = false
  if (result !== undefined) {
    createOpen.value = false
    createName.value = ''
    createNetwork.value = ''
    createAlgo.value = 'round_robin'
    createLabels.value = ''
    void reload()
  }
}

// --- detail ---
const selected = ref<LoadBalancer | null>(null)
const detailOpen = ref(false)

function openDetail(lb: LoadBalancer) {
  selected.value = lb
  detailOpen.value = true
}

async function handleMutated() {
  await reload()
  const current = selected.value
  if (!current) return
  const fresh = items.value.find((i) => i.id === current.id)
  if (fresh) selected.value = fresh
}

function handleDeleted() {
  selected.value = null
  void reload()
}
</script>

<template>
  <div class="space-y-4">
    <PageHeader title="Load Balancers" description="Distribute traffic across your servers.">
      <Button variant="outline" size="sm" :disabled="loading" @click="reload()">
        <RefreshCw class="mr-2 size-4" />
        Refresh
      </Button>
      <Button size="sm" @click="createOpen = true">
        <Plus class="mr-2 size-4" />
        Create Load Balancer
      </Button>
    </PageHeader>

    <ErrorState v-if="error" :error="error" @retry="reload()" />

    <div class="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Public IPv4</TableHead>
            <TableHead>Algorithm</TableHead>
            <TableHead>Location</TableHead>
            <TableHead>Services</TableHead>
            <TableHead>Targets</TableHead>
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
            <TableCell colspan="8" class="py-8 text-center text-muted-foreground">No Load Balancers.</TableCell>
          </TableRow>
          <TableRow v-for="lb in items" v-else :key="lb.id" class="cursor-pointer" @click="openDetail(lb)">
            <TableCell class="font-medium">{{ lb.name }}</TableCell>
            <TableCell class="font-mono text-xs">{{ lb.public_net.ipv4.ip ?? '—' }}</TableCell>
            <TableCell><span class="font-mono text-xs">{{ lb.algorithm.type }}</span></TableCell>
            <TableCell>{{ lb.location.name }}</TableCell>
            <TableCell>{{ lb.services.length }}</TableCell>
            <TableCell>{{ lb.targets.length }}</TableCell>
            <TableCell><LabelsBadges :labels="lb.labels" /></TableCell>
            <TableCell class="text-muted-foreground">{{ lb.created ? new Date(lb.created).toLocaleString() : '—' }}</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>

    <PaginationBar :page-info="pageInfo" :loading="loading" @change="reload" />

    <Dialog v-model:open="createOpen">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Load Balancer</DialogTitle>
          <DialogDescription>Provision a new Load Balancer in a location or network zone.</DialogDescription>
        </DialogHeader>
        <form class="space-y-4" @submit.prevent="submitCreate">
          <div class="space-y-2">
            <Label for="lb-name">Name</Label>
            <Input id="lb-name" v-model="createName" required />
          </div>
          <div class="space-y-2">
            <Label>Load Balancer type</Label>
            <Select v-model="createType">
              <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
              <SelectContent>
                <SelectItem v-for="t in lbTypes" :key="t.id" :value="t.name">{{ t.name }} — {{ t.description }}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div class="grid grid-cols-2 gap-4">
            <div class="space-y-2">
              <Label>Placement</Label>
              <Select v-model="placementMode">
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="location">Location</SelectItem>
                  <SelectItem value="network_zone">Network zone</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div v-if="placementMode === 'location'" class="space-y-2">
              <Label>Location</Label>
              <Select v-model="createLocation">
                <SelectTrigger><SelectValue placeholder="Select location" /></SelectTrigger>
                <SelectContent>
                  <SelectItem v-for="l in locations" :key="l.id" :value="l.name">{{ l.name }} — {{ l.city }}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div v-else class="space-y-2">
              <Label>Network zone</Label>
              <Select v-model="createZone">
                <SelectTrigger><SelectValue placeholder="Select zone" /></SelectTrigger>
                <SelectContent>
                  <SelectItem v-for="z in networkZones" :key="z" :value="z">{{ z }}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div class="grid grid-cols-2 gap-4">
            <div class="space-y-2">
              <Label for="lb-network">Network ID (optional)</Label>
              <Input id="lb-network" v-model="createNetwork" type="number" min="1" placeholder="Attach on creation" />
            </div>
            <div class="space-y-2">
              <Label>Algorithm</Label>
              <Select v-model="createAlgo">
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="round_robin">round_robin</SelectItem>
                  <SelectItem value="least_connections">least_connections</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div class="space-y-2">
            <Label for="lb-labels">Labels (one key=value per line)</Label>
            <Textarea id="lb-labels" v-model="createLabels" rows="2" class="font-mono text-xs" />
          </div>
          <DialogFooter>
            <Button type="submit" :disabled="creating || !createType">Create</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>

    <LoadBalancerDetail
      v-if="selected"
      v-model:open="detailOpen"
      :lb="selected"
      @mutated="handleMutated"
      @deleted="handleDeleted"
    />
  </div>
</template>
