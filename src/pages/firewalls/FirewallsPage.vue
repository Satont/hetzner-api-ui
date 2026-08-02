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
import FirewallRulesEditor, { rowsToRules, rulesToRows, type FirewallRuleRow } from './FirewallRulesEditor.vue'
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

type Firewall = ListItem<operations['list_firewalls'], 'firewalls'>
type AppliedTo = Firewall['applied_to'][number]
type ResourceInput = RequestBody<operations['apply_firewall_to_resources']>['apply_to'][number]

const { client, unwrap } = useApi()

const { items, loading, error, pageInfo, reload } = usePagedResource<Firewall>(async ({ page, per_page }) => {
  const data = unwrap(await client().GET('/firewalls', { params: { query: { page, per_page } } }))
  return { items: data.firewalls ?? [], pagination: data.meta?.pagination ?? {} }
})

// --- create ---
const createOpen = ref(false)
const createName = ref('')
const createLabels = ref('')
const createRules = ref<FirewallRuleRow[]>([])
const creating = ref(false)

async function submitCreate() {
  creating.value = true
  const result = await runAction(async () => {
    const labels = parseLabels(createLabels.value)
    const rules = rowsToRules(createRules.value)
    return unwrap(
      await client().POST('/firewalls', {
        body: {
          name: createName.value.trim(),
          ...(Object.keys(labels).length ? { labels } : {}),
          ...(rules.length ? { rules } : {}),
        },
      }),
    )
  }, 'Firewall created')
  creating.value = false
  if (result !== undefined) {
    createOpen.value = false
    createName.value = ''
    createLabels.value = ''
    createRules.value = []
    void reload()
  }
}

// --- detail ---
const selected = ref<Firewall | null>(null)
const detailOpen = ref(false)
const editName = ref('')
const editLabels = ref('')
const editRules = ref<FirewallRuleRow[]>([])

function openDetail(firewall: Firewall) {
  selected.value = firewall
  editName.value = firewall.name ?? ''
  editLabels.value = labelsToText(firewall.labels)
  editRules.value = rulesToRows(firewall.rules ?? [])
  detailOpen.value = true
}

/** Refetches the open firewall so the sheet reflects mutations. */
async function refreshSelected() {
  const firewall = selected.value
  if (!firewall?.id) return
  const data = await runAction(async () =>
    unwrap(await client().GET('/firewalls/{id}', { params: { path: { id: firewall.id! } } })),
  )
  if (data?.firewall) {
    selected.value = data.firewall
    editRules.value = rulesToRows(data.firewall.rules ?? [])
  }
  void reload()
}

// --- set rules ---
const savingRules = ref(false)

async function saveRules() {
  const firewall = selected.value
  if (!firewall?.id) return
  savingRules.value = true
  const result = await runAction(async () => {
    return unwrap(
      await client().POST('/firewalls/{id}/actions/set_rules', {
        params: { path: { id: firewall.id! } },
        body: { rules: rowsToRules(editRules.value) },
      }),
    )
  }, 'Rules updated')
  savingRules.value = false
  if (result !== undefined) void refreshSelected()
}

// --- apply / remove resources ---
const applyOpen = ref(false)
const applyType = ref<'server' | 'label_selector'>('server')
const applyServerId = ref('')
const applySelector = ref('')

function openApply() {
  applyType.value = 'server'
  applyServerId.value = ''
  applySelector.value = ''
  applyOpen.value = true
}

function buildResource(type: 'server' | 'label_selector', serverId: string, selector: string): ResourceInput {
  return type === 'server'
    ? { type: 'server', server: { id: Number(serverId.trim()) } }
    : { type: 'label_selector', label_selector: { selector: selector.trim() } }
}

async function submitApply() {
  const firewall = selected.value
  if (!firewall?.id) return
  const result = await runAction(async () => {
    return unwrap(
      await client().POST('/firewalls/{id}/actions/apply_to_resources', {
        params: { path: { id: firewall.id! } },
        body: { apply_to: [buildResource(applyType.value, applyServerId.value, applySelector.value)] },
      }),
    )
  }, 'Firewall applied')
  if (result !== undefined) {
    applyOpen.value = false
    void refreshSelected()
  }
}

const removeOpen = ref(false)
const removeType = ref<'server' | 'label_selector'>('server')
const removeServerId = ref('')
const removeSelector = ref('')

function openRemove(resource: AppliedTo) {
  removeType.value = resource.type
  removeServerId.value = resource.server?.id !== undefined && resource.server?.id !== null ? String(resource.server.id) : ''
  removeSelector.value = resource.label_selector?.selector ?? ''
  removeOpen.value = true
}

async function submitRemove() {
  const firewall = selected.value
  if (!firewall?.id) return
  const result = await runAction(async () => {
    return unwrap(
      await client().POST('/firewalls/{id}/actions/remove_from_resources', {
        params: { path: { id: firewall.id! } },
        body: { remove_from: [buildResource(removeType.value, removeServerId.value, removeSelector.value)] },
      }),
    )
  }, 'Resource removed')
  if (result !== undefined) {
    removeOpen.value = false
    void refreshSelected()
  }
}

// --- edit / delete ---
async function saveEdit() {
  const firewall = selected.value
  if (!firewall?.id) return
  const result = await runAction(async () => {
    return unwrap(
      await client().PUT('/firewalls/{id}', {
        params: { path: { id: firewall.id! } },
        body: { name: editName.value.trim(), labels: parseLabels(editLabels.value) },
      }),
    )
  }, 'Firewall updated')
  if (result !== undefined) void refreshSelected()
}

const deleteOpen = ref(false)

async function confirmDelete() {
  const firewall = selected.value
  if (!firewall?.id) return
  const result = await runAction(async () => {
    await client().DELETE('/firewalls/{id}', { params: { path: { id: firewall.id! } } })
    return true
  }, 'Firewall deleted')
  if (result !== undefined) {
    deleteOpen.value = false
    detailOpen.value = false
    void reload()
  }
}

function ruleIps(rule: Firewall['rules'][number]): string {
  const ips = rule.direction === 'in' ? rule.source_ips : rule.destination_ips
  return ips.length ? ips.join(', ') : '—'
}

function appliedToLabel(resource: AppliedTo): string {
  if (resource.type === 'server') return `server #${resource.server?.id ?? '?'}`
  return `selector: ${resource.label_selector?.selector ?? '?'}`
}
</script>

<template>
  <div class="space-y-4">
    <PageHeader title="Firewalls" description="Stateful firewall rules applied to servers or label selectors.">
      <Button variant="outline" size="sm" :disabled="loading" @click="reload()">
        <RefreshCw class="mr-2 size-4" />
        Refresh
      </Button>
      <Button size="sm" @click="createOpen = true">
        <Plus class="mr-2 size-4" />
        Add firewall
      </Button>
    </PageHeader>

    <ErrorState v-if="error" :error="error" @retry="reload()" />

    <div class="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Rules</TableHead>
            <TableHead>Applied to</TableHead>
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
            <TableCell colspan="5" class="py-8 text-center text-muted-foreground">No firewalls.</TableCell>
          </TableRow>
          <TableRow v-for="firewall in items" v-else :key="firewall.id" class="cursor-pointer" @click="openDetail(firewall)">
            <TableCell class="font-medium">{{ firewall.name }}</TableCell>
            <TableCell>{{ firewall.rules?.length ?? 0 }}</TableCell>
            <TableCell>{{ firewall.applied_to?.length ?? 0 }}</TableCell>
            <TableCell><LabelsBadges :labels="firewall.labels" /></TableCell>
            <TableCell class="text-muted-foreground">{{ firewall.created ? new Date(firewall.created).toLocaleString() : '—' }}</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>

    <PaginationBar :page-info="pageInfo" :loading="loading" @change="reload" />

    <Dialog v-model:open="createOpen">
      <DialogContent class="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Add firewall</DialogTitle>
          <DialogDescription>Rules and resources can also be added after creation.</DialogDescription>
        </DialogHeader>
        <form class="space-y-4" @submit.prevent="submitCreate">
          <div class="space-y-2">
            <Label for="fw-name">Name</Label>
            <Input id="fw-name" v-model="createName" required />
          </div>
          <div class="space-y-2">
            <Label>Rules (optional)</Label>
            <FirewallRulesEditor v-model="createRules" />
          </div>
          <div class="space-y-2">
            <Label for="fw-labels">Labels (one key=value per line)</Label>
            <Textarea id="fw-labels" v-model="createLabels" rows="2" class="font-mono text-xs" />
          </div>
          <DialogFooter>
            <Button type="submit" :disabled="creating">Create</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>

    <DetailSheet v-model:open="detailOpen" :title="selected?.name ?? 'Firewall'" description="Firewall details">
      <Tabs v-if="selected" default-value="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="rules">Rules</TabsTrigger>
          <TabsTrigger value="resources">Resources</TabsTrigger>
          <TabsTrigger value="edit">Edit</TabsTrigger>
          <TabsTrigger value="json">JSON</TabsTrigger>
        </TabsList>
        <TabsContent value="overview" class="mt-4 space-y-6">
          <KeyValue
            :items="[
              { label: 'ID', value: selected.id },
              { label: 'Name', value: selected.name },
              { label: 'Rules', value: selected.rules?.length ?? 0 },
              { label: 'Applied to', value: selected.applied_to?.length ?? 0 },
              { label: 'Created', value: selected.created ? new Date(selected.created).toLocaleString() : null },
            ]"
          />

          <div class="space-y-2">
            <h3 class="text-sm font-medium">Rules</h3>
            <div class="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Direction</TableHead>
                    <TableHead>Protocol</TableHead>
                    <TableHead>Port</TableHead>
                    <TableHead>IPs</TableHead>
                    <TableHead>Description</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow v-if="!selected.rules?.length">
                    <TableCell colspan="5" class="py-4 text-center text-muted-foreground">No rules.</TableCell>
                  </TableRow>
                  <TableRow v-for="(rule, index) in selected.rules" v-else :key="index">
                    <TableCell><Badge :variant="rule.direction === 'in' ? 'default' : 'secondary'">{{ rule.direction }}</Badge></TableCell>
                    <TableCell class="font-mono text-xs">{{ rule.protocol }}</TableCell>
                    <TableCell class="font-mono text-xs">{{ rule.port ?? '—' }}</TableCell>
                    <TableCell class="max-w-48 truncate font-mono text-xs" :title="ruleIps(rule)">{{ ruleIps(rule) }}</TableCell>
                    <TableCell class="text-muted-foreground">{{ rule.description ?? '—' }}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </div>

          <div class="space-y-2">
            <h3 class="text-sm font-medium">Applied to</h3>
            <div class="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Target</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow v-if="!selected.applied_to?.length">
                    <TableCell colspan="2" class="py-4 text-center text-muted-foreground">Not applied to any resource.</TableCell>
                  </TableRow>
                  <TableRow v-for="(resource, index) in selected.applied_to" v-else :key="index">
                    <TableCell><Badge variant="outline">{{ resource.type }}</Badge></TableCell>
                    <TableCell class="font-mono text-xs">{{ appliedToLabel(resource) }}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </div>
        </TabsContent>
        <TabsContent value="rules" class="mt-4 space-y-4">
          <p class="text-sm text-muted-foreground">Saving replaces all existing rules of this firewall.</p>
          <FirewallRulesEditor v-model="editRules" />
          <div class="flex justify-end">
            <Button :disabled="savingRules" @click="saveRules">Save rules</Button>
          </div>
        </TabsContent>
        <TabsContent value="resources" class="mt-4 space-y-4">
          <div class="flex justify-end">
            <Button variant="outline" size="sm" @click="openApply">Apply to resource</Button>
          </div>
          <div class="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Target</TableHead>
                  <TableHead class="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow v-if="!selected.applied_to?.length">
                  <TableCell colspan="3" class="py-4 text-center text-muted-foreground">Not applied to any resource.</TableCell>
                </TableRow>
                <TableRow v-for="(resource, index) in selected.applied_to" v-else :key="index">
                  <TableCell><Badge variant="outline">{{ resource.type }}</Badge></TableCell>
                  <TableCell class="font-mono text-xs">{{ appliedToLabel(resource) }}</TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" @click="openRemove(resource)">
                      <Trash2 class="size-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </TabsContent>
        <TabsContent value="edit" class="mt-4">
          <form class="space-y-4" @submit.prevent="saveEdit">
            <div class="space-y-2">
              <Label for="fw-edit-name">Name</Label>
              <Input id="fw-edit-name" v-model="editName" required />
            </div>
            <div class="space-y-2">
              <Label for="fw-edit-labels">Labels</Label>
              <Textarea id="fw-edit-labels" v-model="editLabels" rows="3" class="font-mono text-xs" />
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

    <Dialog v-model:open="applyOpen">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Apply to resource</DialogTitle>
          <DialogDescription>Apply this firewall to a server or all servers matching a label selector.</DialogDescription>
        </DialogHeader>
        <form class="space-y-4" @submit.prevent="submitApply">
          <div class="space-y-2">
            <Label>Type</Label>
            <Select v-model="applyType">
              <SelectTrigger>
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="server">server</SelectItem>
                <SelectItem value="label_selector">label_selector</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div v-if="applyType === 'server'" class="space-y-2">
            <Label for="apply-server-id">Server ID</Label>
            <Input id="apply-server-id" v-model="applyServerId" class="font-mono text-xs" placeholder="42" required />
          </div>
          <div v-else class="space-y-2">
            <Label for="apply-selector">Label selector</Label>
            <Input id="apply-selector" v-model="applySelector" class="font-mono text-xs" placeholder="env=prod" required />
          </div>
          <DialogFooter>
            <Button type="submit">Apply</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>

    <Dialog v-model:open="removeOpen">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Remove from resource</DialogTitle>
          <DialogDescription>Stop applying this firewall to the selected resource.</DialogDescription>
        </DialogHeader>
        <form class="space-y-4" @submit.prevent="submitRemove">
          <div class="space-y-2">
            <Label>Type</Label>
            <Select v-model="removeType">
              <SelectTrigger>
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="server">server</SelectItem>
                <SelectItem value="label_selector">label_selector</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div v-if="removeType === 'server'" class="space-y-2">
            <Label for="remove-server-id">Server ID</Label>
            <Input id="remove-server-id" v-model="removeServerId" class="font-mono text-xs" required />
          </div>
          <div v-else class="space-y-2">
            <Label for="remove-selector">Label selector</Label>
            <Input id="remove-selector" v-model="removeSelector" class="font-mono text-xs" required />
          </div>
          <DialogFooter>
            <Button type="submit" variant="destructive">Remove</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>

    <ConfirmDialog
      v-model:open="deleteOpen"
      title="Delete firewall?"
      :description="`This will permanently delete '${selected?.name}'. It must not be applied to any resource.`"
      confirm-label="Delete"
      destructive
      @confirm="confirmDelete"
    />
  </div>
</template>
