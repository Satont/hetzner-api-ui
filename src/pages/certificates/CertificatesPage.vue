<script setup lang="ts">
import { ref } from 'vue'
import { Plus, RefreshCw } from 'lucide-vue-next'
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

type Certificate = ListItem<operations['list_certificates'], 'certificates'>
type CreateCertBody = RequestBody<operations['create_certificate']>

const { client, unwrap } = useApi()

const { items, loading, error, pageInfo, reload } = usePagedResource<Certificate>(async ({ page, per_page }) => {
  const data = unwrap(await client().GET('/certificates', { params: { query: { page, per_page } } }))
  return { items: data.certificates ?? [], pagination: data.meta?.pagination ?? {} }
})

function fmtDate(value: string | null | undefined): string | null {
  return value ? new Date(value).toLocaleString() : null
}

// --- create ---
const createOpen = ref(false)
const createType = ref('uploaded')
const createName = ref('')
const createDomains = ref('')
const createCertificate = ref('')
const createPrivateKey = ref('')
const createLabels = ref('')
const creating = ref(false)

async function submitCreate() {
  const labels = parseLabels(createLabels.value)
  const base = {
    name: createName.value.trim(),
    ...(Object.keys(labels).length ? { labels } : {}),
  }
  const body: CreateCertBody =
    createType.value === 'managed'
      ? {
          ...base,
          type: 'managed',
          domain_names: createDomains.value
            .split(',')
            .map((d) => d.trim())
            .filter(Boolean),
        }
      : {
          ...base,
          type: 'uploaded',
          certificate: createCertificate.value.trim(),
          private_key: createPrivateKey.value.trim(),
        }
  creating.value = true
  const result = await runAction(async () => {
    return unwrap(await client().POST('/certificates', { body }))
  }, 'Certificate created')
  creating.value = false
  if (result !== undefined) {
    createOpen.value = false
    createName.value = ''
    createDomains.value = ''
    createCertificate.value = ''
    createPrivateKey.value = ''
    createLabels.value = ''
    void reload()
  }
}

// --- detail / edit / delete / retry ---
const selected = ref<Certificate | null>(null)
const detailOpen = ref(false)
const editName = ref('')
const editLabels = ref('')

function openDetail(cert: Certificate) {
  selected.value = cert
  editName.value = cert.name ?? ''
  editLabels.value = labelsToText(cert.labels)
  detailOpen.value = true
}

async function saveEdit() {
  const cert = selected.value
  if (!cert) return
  const result = await runAction(async () => {
    return unwrap(
      await client().PUT('/certificates/{id}', {
        params: { path: { id: cert.id } },
        body: { name: editName.value.trim(), labels: parseLabels(editLabels.value) },
      }),
    )
  }, 'Certificate updated')
  if (result !== undefined) {
    detailOpen.value = false
    void reload()
  }
}

const deleteOpen = ref(false)

async function confirmDelete() {
  const cert = selected.value
  if (!cert) return
  const result = await runAction(async () => {
    await client().DELETE('/certificates/{id}', { params: { path: { id: cert.id } } })
    return true
  }, 'Certificate deleted')
  if (result !== undefined) {
    deleteOpen.value = false
    detailOpen.value = false
    void reload()
  }
}

const retryOpen = ref(false)

async function confirmRetry() {
  const cert = selected.value
  if (!cert) return
  const result = await runAction(async () => {
    return unwrap(await client().POST('/certificates/{id}/actions/retry', { params: { path: { id: cert.id } } }))
  }, 'Certificate issuance retry requested')
  if (result !== undefined) {
    retryOpen.value = false
    detailOpen.value = false
    void reload()
  }
}
</script>

<template>
  <div class="space-y-4">
    <PageHeader title="Certificates" description="TLS certificates for Load Balancers.">
      <Button variant="outline" size="sm" :disabled="loading" @click="reload()">
        <RefreshCw class="mr-2 size-4" />
        Refresh
      </Button>
      <Button size="sm" @click="createOpen = true">
        <Plus class="mr-2 size-4" />
        Add Certificate
      </Button>
    </PageHeader>

    <ErrorState v-if="error" :error="error" @retry="reload()" />

    <div class="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Domains</TableHead>
            <TableHead>Fingerprint</TableHead>
            <TableHead>Valid until</TableHead>
            <TableHead>Used by</TableHead>
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
            <TableCell colspan="8" class="py-8 text-center text-muted-foreground">No certificates.</TableCell>
          </TableRow>
          <TableRow v-for="cert in items" v-else :key="cert.id" class="cursor-pointer" @click="openDetail(cert)">
            <TableCell class="font-medium">{{ cert.name }}</TableCell>
            <TableCell>
              <Badge :variant="cert.type === 'managed' ? 'default' : 'secondary'">{{ cert.type ?? 'uploaded' }}</Badge>
            </TableCell>
            <TableCell class="max-w-48 truncate text-xs" :title="cert.domain_names.join(', ')">
              {{ cert.domain_names.join(', ') || '—' }}
            </TableCell>
            <TableCell class="max-w-40 truncate font-mono text-xs" :title="cert.fingerprint ?? ''">
              {{ cert.fingerprint ?? '—' }}
            </TableCell>
            <TableCell class="text-muted-foreground">{{ fmtDate(cert.not_valid_after) ?? '—' }}</TableCell>
            <TableCell>{{ cert.used_by.length }}</TableCell>
            <TableCell><LabelsBadges :labels="cert.labels" /></TableCell>
            <TableCell class="text-muted-foreground">{{ fmtDate(cert.created) ?? '—' }}</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>

    <PaginationBar :page-info="pageInfo" :loading="loading" @change="reload" />

    <Dialog v-model:open="createOpen">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Certificate</DialogTitle>
          <DialogDescription>Upload an existing certificate or request a managed Let's Encrypt certificate.</DialogDescription>
        </DialogHeader>
        <form class="max-h-[70vh] space-y-4 overflow-y-auto pr-1" @submit.prevent="submitCreate">
          <div class="space-y-2">
            <Label>Type</Label>
            <Select v-model="createType">
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="uploaded">uploaded — bring your own PEM</SelectItem>
                <SelectItem value="managed">managed — Let's Encrypt via Hetzner DNS</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div class="space-y-2">
            <Label for="cert-name">Name</Label>
            <Input id="cert-name" v-model="createName" required />
          </div>
          <div v-if="createType === 'managed'" class="space-y-2">
            <Label for="cert-domains">Domain names (comma-separated)</Label>
            <Textarea id="cert-domains" v-model="createDomains" rows="2" class="font-mono text-xs" placeholder="example.com, www.example.com" required />
          </div>
          <template v-else>
            <div class="space-y-2">
              <Label for="cert-pem">Certificate (PEM)</Label>
              <Textarea id="cert-pem" v-model="createCertificate" rows="6" class="font-mono text-xs" placeholder="-----BEGIN CERTIFICATE-----" required />
            </div>
            <div class="space-y-2">
              <Label for="cert-key">Private key (PEM)</Label>
              <Textarea id="cert-key" v-model="createPrivateKey" rows="6" class="font-mono text-xs" placeholder="-----BEGIN PRIVATE KEY-----" required />
            </div>
          </template>
          <div class="space-y-2">
            <Label for="cert-labels">Labels (one key=value per line)</Label>
            <Textarea id="cert-labels" v-model="createLabels" rows="2" class="font-mono text-xs" />
          </div>
          <DialogFooter>
            <Button type="submit" :disabled="creating">Create</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>

    <DetailSheet v-model:open="detailOpen" :title="selected?.name ?? 'Certificate'" description="Certificate details">
      <Tabs v-if="selected" default-value="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="edit">Edit</TabsTrigger>
          <TabsTrigger value="json">JSON</TabsTrigger>
        </TabsList>
        <TabsContent value="overview" class="mt-4 space-y-4">
          <KeyValue
            :items="[
              { label: 'ID', value: selected.id },
              { label: 'Name', value: selected.name },
              { label: 'Type', value: selected.type ?? 'uploaded' },
              { label: 'Domain names', value: selected.domain_names.join(', ') || null },
              { label: 'Fingerprint', value: selected.fingerprint },
              { label: 'Not valid before', value: fmtDate(selected.not_valid_before) },
              { label: 'Not valid after', value: fmtDate(selected.not_valid_after) },
              {
                label: 'Used by',
                value: selected.used_by.length ? selected.used_by.map((u) => `${u.type} #${u.id}`).join(', ') : null,
              },
              { label: 'Created', value: fmtDate(selected.created) },
              ...(selected.type === 'managed'
                ? [
                    { label: 'Issuance', value: selected.status?.issuance ?? null },
                    { label: 'Renewal', value: selected.status?.renewal ?? null },
                    { label: 'Status error', value: selected.status?.error ? `${selected.status.error.code ?? ''}: ${selected.status.error.message ?? ''}` : null },
                  ]
                : []),
            ]"
          />
          <div class="space-y-1">
            <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">Labels</p>
            <LabelsBadges :labels="selected.labels" />
          </div>
          <Button v-if="selected.type === 'managed'" variant="outline" size="sm" @click="retryOpen = true">
            Retry issuance / renewal
          </Button>
        </TabsContent>
        <TabsContent value="edit" class="mt-4">
          <form class="space-y-4" @submit.prevent="saveEdit">
            <div class="space-y-2">
              <Label for="cert-edit-name">Name</Label>
              <Input id="cert-edit-name" v-model="editName" required />
            </div>
            <div class="space-y-2">
              <Label for="cert-edit-labels">Labels</Label>
              <Textarea id="cert-edit-labels" v-model="editLabels" rows="3" class="font-mono text-xs" />
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
      title="Delete Certificate?"
      :description="`This will permanently delete '${selected?.name}'.`"
      confirm-label="Delete"
      destructive
      @confirm="confirmDelete"
    />
    <ConfirmDialog
      v-model:open="retryOpen"
      title="Retry issuance or renewal?"
      :description="`This will retry the failed issuance or renewal for '${selected?.name}'.`"
      confirm-label="Retry"
      @confirm="confirmRetry"
    />
  </div>
</template>
