<script setup lang="ts">
import { ref } from 'vue'
import { Plus, RefreshCw } from 'lucide-vue-next'
import { useApi } from '@/composables/useApi'
import { usePagedResource, runAction } from '@/composables/usePagedResource'
import { parseLabels, labelsToText } from '@/lib/labels'
import type { ListItem } from '@/api/client'
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
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'

type SshKey = ListItem<operations['list_ssh_keys'], 'ssh_keys'>

const { client, unwrap } = useApi()

const { items, loading, error, pageInfo, reload } = usePagedResource<SshKey>(async ({ page, per_page }) => {
  const data = unwrap(await client().GET('/ssh_keys', { params: { query: { page, per_page } } }))
  return { items: data.ssh_keys ?? [], pagination: data.meta?.pagination ?? {} }
})

// --- create ---
const createOpen = ref(false)
const createName = ref('')
const createPublicKey = ref('')
const createLabels = ref('')
const creating = ref(false)

async function submitCreate() {
  creating.value = true
  const result = await runAction(async () => {
    const labels = parseLabels(createLabels.value)
    return unwrap(
      await client().POST('/ssh_keys', {
        body: {
          name: createName.value.trim(),
          public_key: createPublicKey.value.trim(),
          ...(Object.keys(labels).length ? { labels } : {}),
        },
      }),
    )
  }, 'SSH key created')
  creating.value = false
  if (result !== undefined) {
    createOpen.value = false
    createName.value = ''
    createPublicKey.value = ''
    createLabels.value = ''
    void reload()
  }
}

// --- detail / edit / delete ---
const selected = ref<SshKey | null>(null)
const detailOpen = ref(false)
const editName = ref('')
const editLabels = ref('')

function openDetail(key: SshKey) {
  selected.value = key
  editName.value = key.name ?? ''
  editLabels.value = labelsToText(key.labels)
  detailOpen.value = true
}

async function saveEdit() {
  const key = selected.value
  if (!key?.id) return
  const result = await runAction(async () => {
    return unwrap(
      await client().PUT('/ssh_keys/{id}', {
        params: { path: { id: key.id! } },
        body: { name: editName.value.trim(), labels: parseLabels(editLabels.value) },
      }),
    )
  }, 'SSH key updated')
  if (result !== undefined) {
    detailOpen.value = false
    void reload()
  }
}

const deleteOpen = ref(false)

async function confirmDelete() {
  const key = selected.value
  if (!key?.id) return
  const result = await runAction(async () => {
    await client().DELETE('/ssh_keys/{id}', { params: { path: { id: key.id! } } })
    return true
  }, 'SSH key deleted')
  if (result !== undefined) {
    deleteOpen.value = false
    detailOpen.value = false
    void reload()
  }
}
</script>

<template>
  <div class="space-y-4">
    <PageHeader title="SSH Keys" description="Public keys injected into servers at creation time.">
      <Button variant="outline" size="sm" :disabled="loading" @click="reload()">
        <RefreshCw class="mr-2 size-4" />
        Refresh
      </Button>
      <Button size="sm" @click="createOpen = true">
        <Plus class="mr-2 size-4" />
        Add SSH key
      </Button>
    </PageHeader>

    <ErrorState v-if="error" :error="error" @retry="reload()" />

    <div class="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Fingerprint</TableHead>
            <TableHead>Labels</TableHead>
            <TableHead>Created</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <template v-if="loading">
            <TableRow v-for="i in 5" :key="i">
              <TableCell colspan="4"><Skeleton class="h-5 w-full" /></TableCell>
            </TableRow>
          </template>
          <TableRow v-else-if="!items.length">
            <TableCell colspan="4" class="py-8 text-center text-muted-foreground">No SSH keys.</TableCell>
          </TableRow>
          <TableRow v-for="key in items" v-else :key="key.id" class="cursor-pointer" @click="openDetail(key)">
            <TableCell class="font-medium">{{ key.name }}</TableCell>
            <TableCell class="font-mono text-xs">{{ key.fingerprint }}</TableCell>
            <TableCell><LabelsBadges :labels="key.labels" /></TableCell>
            <TableCell class="text-muted-foreground">{{ key.created ? new Date(key.created).toLocaleString() : '—' }}</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>

    <PaginationBar :page-info="pageInfo" :loading="loading" @change="reload" />

    <Dialog v-model:open="createOpen">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add SSH key</DialogTitle>
          <DialogDescription>Paste an OpenSSH public key.</DialogDescription>
        </DialogHeader>
        <form class="space-y-4" @submit.prevent="submitCreate">
          <div class="space-y-2">
            <Label for="sk-name">Name</Label>
            <Input id="sk-name" v-model="createName" required />
          </div>
          <div class="space-y-2">
            <Label for="sk-key">Public key</Label>
            <Textarea id="sk-key" v-model="createPublicKey" rows="4" class="font-mono text-xs" placeholder="ssh-ed25519 AAAA…" required />
          </div>
          <div class="space-y-2">
            <Label for="sk-labels">Labels (one key=value per line)</Label>
            <Textarea id="sk-labels" v-model="createLabels" rows="2" class="font-mono text-xs" />
          </div>
          <DialogFooter>
            <Button type="submit" :disabled="creating">Create</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>

    <DetailSheet v-model:open="detailOpen" :title="selected?.name ?? 'SSH key'" description="SSH key details">
      <Tabs v-if="selected" default-value="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="edit">Edit</TabsTrigger>
          <TabsTrigger value="json">JSON</TabsTrigger>
        </TabsList>
        <TabsContent value="overview" class="mt-4">
          <KeyValue
            :items="[
              { label: 'ID', value: selected.id },
              { label: 'Name', value: selected.name },
              { label: 'Fingerprint', value: selected.fingerprint },
              { label: 'Created', value: selected.created ? new Date(selected.created).toLocaleString() : null },
            ]"
          />
        </TabsContent>
        <TabsContent value="edit" class="mt-4">
          <form class="space-y-4" @submit.prevent="saveEdit">
            <div class="space-y-2">
              <Label for="sk-edit-name">Name</Label>
              <Input id="sk-edit-name" v-model="editName" required />
            </div>
            <div class="space-y-2">
              <Label for="sk-edit-labels">Labels</Label>
              <Textarea id="sk-edit-labels" v-model="editLabels" rows="3" class="font-mono text-xs" />
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
      title="Delete SSH key?"
      :description="`This will permanently delete '${selected?.name}'.`"
      confirm-label="Delete"
      destructive
      @confirm="confirmDelete"
    />
  </div>
</template>
