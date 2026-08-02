<script setup lang="ts">
import { ref, watch } from 'vue'
import { ChevronDown } from 'lucide-vue-next'
import { useApi } from '@/composables/useApi'
import { runAction } from '@/composables/usePagedResource'
import { parseLabels } from '@/lib/labels'
import type { operations } from '@/api/schema'
import type { RequestBody } from '@/api/client'
import type { ServerDetail, SshKey } from './types'
import ConfirmDialog from '@/components/shared/ConfirmDialog.vue'
import ResultDialog from './ResultDialog.vue'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
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
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const props = defineProps<{
  server: ServerDetail
}>()

const emit = defineEmits<{ done: [] }>()

const { client, unwrap } = useApi()

async function act<T>(fn: () => Promise<T>, successMessage: string): Promise<T | undefined> {
  const result = await runAction(fn, successMessage)
  if (result !== undefined) emit('done')
  return result
}

// --- generic confirm ---
const confirmOpen = ref(false)
const confirmTitle = ref('')
const confirmDescription = ref('')
const confirmLabel = ref('Confirm')
let pendingAction: (() => void) | null = null

function askConfirm(title: string, description: string, action: () => void, label = 'Confirm') {
  confirmTitle.value = title
  confirmDescription.value = description
  confirmLabel.value = label
  pendingAction = action
  confirmOpen.value = true
}

function onConfirm() {
  pendingAction?.()
  pendingAction = null
}

// --- result display (root passwords, console credentials) ---
const resultOpen = ref(false)
const resultTitle = ref('')
const resultDescription = ref('')
const resultFields = ref<{ label: string; value: string }[]>([])

function showResult(title: string, fields: { label: string; value: string }[], description = '') {
  resultTitle.value = title
  resultDescription.value = description
  resultFields.value = fields
  resultOpen.value = true
}

// --- simple power actions ---
function poweron() {
  void act(
    async () => unwrap(await client().POST('/servers/{id}/actions/poweron', { params: { path: { id: props.server.id } } })),
    'Power on requested',
  )
}

function poweroff() {
  askConfirm('Power off server?', `This forcefully cuts power to '${props.server.name}' and may lead to data loss.`, () => {
    void act(
      async () => unwrap(await client().POST('/servers/{id}/actions/poweroff', { params: { path: { id: props.server.id } } })),
      'Power off requested',
    )
  }, 'Power off')
}

function reboot() {
  void act(
    async () => unwrap(await client().POST('/servers/{id}/actions/reboot', { params: { path: { id: props.server.id } } })),
    'Reboot requested',
  )
}

function reset() {
  askConfirm('Reset server?', `This forcefully resets '${props.server.name}' and may lead to data loss.`, () => {
    void act(
      async () => unwrap(await client().POST('/servers/{id}/actions/reset', { params: { path: { id: props.server.id } } })),
      'Reset requested',
    )
  }, 'Reset')
}

function shutdown() {
  askConfirm('Shut down server?', `Sends a graceful ACPI shutdown request to '${props.server.name}'.`, () => {
    void act(
      async () => unwrap(await client().POST('/servers/{id}/actions/shutdown', { params: { path: { id: props.server.id } } })),
      'Shutdown requested',
    )
  }, 'Shut down')
}

// --- rescue ---
const rescueOpen = ref(false)
const rescueType = ref<'linux64'>('linux64')
const rescueKeys = ref<number[]>([])
const rescueKeysList = ref<SshKey[]>([])
const rescueKeysLoading = ref(false)
const rescueSubmitting = ref(false)

watch(rescueOpen, async (isOpen) => {
  if (!isOpen || rescueKeysList.value.length || rescueKeysLoading.value) return
  rescueKeysLoading.value = true
  try {
    const data = unwrap(await client().GET('/ssh_keys', { params: { query: { per_page: 100 } } }))
    rescueKeysList.value = data.ssh_keys ?? []
  } finally {
    rescueKeysLoading.value = false
  }
})

function toggleRescueKey(keyId: number, checked: boolean | 'indeterminate') {
  if (checked === true) {
    if (!rescueKeys.value.includes(keyId)) rescueKeys.value = [...rescueKeys.value, keyId]
  } else {
    rescueKeys.value = rescueKeys.value.filter((existing) => existing !== keyId)
  }
}

async function submitRescue() {
  const body: RequestBody<operations['enable_server_rescue']> = {
    type: rescueType.value,
    ...(rescueKeys.value.length ? { ssh_keys: rescueKeys.value } : {}),
  }
  rescueSubmitting.value = true
  const result = await act(
    async () => unwrap(await client().POST('/servers/{id}/actions/enable_rescue', { params: { path: { id: props.server.id } }, body })),
    'Rescue mode enabled',
  )
  rescueSubmitting.value = false
  if (result !== undefined) {
    rescueOpen.value = false
    rescueKeys.value = []
    if (result.root_password) {
      showResult('Rescue mode enabled', [{ label: 'Root password', value: result.root_password }], 'Boot into the rescue system and log in with these credentials.')
    }
  }
}

function disableRescue() {
  void act(
    async () => unwrap(await client().POST('/servers/{id}/actions/disable_rescue', { params: { path: { id: props.server.id } } })),
    'Rescue mode disabled',
  )
}

// --- root password / console ---
function resetPassword() {
  askConfirm('Reset root password?', `Generates a new root password for '${props.server.name}'. Requires the qemu guest agent.`, async () => {
    const result = await act(
      async () => unwrap(await client().POST('/servers/{id}/actions/reset_password', { params: { path: { id: props.server.id } } })),
      'Root password reset',
    )
    if (result?.root_password) {
      showResult('New root password', [{ label: 'Root password', value: result.root_password }], 'Store this password safely — it is only shown once.')
    }
  }, 'Reset password')
}

async function requestConsole() {
  const result = await act(
    async () => unwrap(await client().POST('/servers/{id}/actions/request_console', { params: { path: { id: props.server.id } } })),
    'Console requested',
  )
  if (result && result.wss_url && result.password) {
    showResult(
      'VNC console credentials',
      [
        { label: 'WebSocket URL', value: result.wss_url },
        { label: 'Password', value: result.password },
      ],
      'The URL is valid for 1 minute. Connect with a websocket-capable VNC client.',
    )
  }
}

// --- images / rebuild / type ---
const imageOpen = ref(false)
const imageDescription = ref('')
const imageType = ref<'snapshot' | 'backup'>('snapshot')
const imageLabels = ref('')
const imageSubmitting = ref(false)

async function submitCreateImage() {
  const labels = parseLabels(imageLabels.value)
  const body: RequestBody<operations['create_server_image']> = {
    type: imageType.value,
    ...(imageDescription.value.trim() ? { description: imageDescription.value.trim() } : {}),
    ...(Object.keys(labels).length ? { labels } : {}),
  }
  imageSubmitting.value = true
  const result = await act(
    async () => unwrap(await client().POST('/servers/{id}/actions/create_image', { params: { path: { id: props.server.id } }, body })),
    'Image creation started',
  )
  imageSubmitting.value = false
  if (result !== undefined) {
    imageOpen.value = false
    imageDescription.value = ''
    imageLabels.value = ''
  }
}

const rebuildOpen = ref(false)
const rebuildImage = ref('')
const rebuildSubmitting = ref(false)

async function submitRebuild() {
  const body: RequestBody<operations['rebuild_server']> = { image: rebuildImage.value.trim() }
  rebuildSubmitting.value = true
  const result = await act(
    async () => unwrap(await client().POST('/servers/{id}/actions/rebuild', { params: { path: { id: props.server.id } }, body })),
    'Rebuild started',
  )
  rebuildSubmitting.value = false
  if (result !== undefined) {
    rebuildOpen.value = false
    rebuildImage.value = ''
  }
}

const changeTypeOpen = ref(false)
const changeTypeName = ref('')
const changeTypeUpgradeDisk = ref(true)
const changeTypeSubmitting = ref(false)

async function submitChangeType() {
  const body: RequestBody<operations['change_server_type']> = {
    server_type: changeTypeName.value.trim(),
    upgrade_disk: changeTypeUpgradeDisk.value,
  }
  changeTypeSubmitting.value = true
  const result = await act(
    async () => unwrap(await client().POST('/servers/{id}/actions/change_type', { params: { path: { id: props.server.id } }, body })),
    'Server type change started',
  )
  changeTypeSubmitting.value = false
  if (result !== undefined) {
    changeTypeOpen.value = false
    changeTypeName.value = ''
  }
}

// --- backup ---
function enableBackup() {
  void act(
    async () => unwrap(await client().POST('/servers/{id}/actions/enable_backup', { params: { path: { id: props.server.id } } })),
    'Backups enabled',
  )
}

function disableBackup() {
  askConfirm('Disable backups?', `This disables backups and permanently deletes all existing backups of '${props.server.name}'.`, () => {
    void act(
      async () => unwrap(await client().POST('/servers/{id}/actions/disable_backup', { params: { path: { id: props.server.id } } })),
      'Backups disabled',
    )
  }, 'Disable backups')
}

// --- iso ---
const attachIsoOpen = ref(false)
const attachIsoName = ref('')
const attachIsoSubmitting = ref(false)

async function submitAttachIso() {
  const body: RequestBody<operations['attach_server_iso']> = { iso: attachIsoName.value.trim() }
  attachIsoSubmitting.value = true
  const result = await act(
    async () => unwrap(await client().POST('/servers/{id}/actions/attach_iso', { params: { path: { id: props.server.id } }, body })),
    'ISO attached',
  )
  attachIsoSubmitting.value = false
  if (result !== undefined) {
    attachIsoOpen.value = false
    attachIsoName.value = ''
  }
}

function detachIso() {
  void act(
    async () => unwrap(await client().POST('/servers/{id}/actions/detach_iso', { params: { path: { id: props.server.id } } })),
    'ISO detached',
  )
}

// --- networks ---
function parseIdList(text: string): string[] {
  return text
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
}

const attachNetworkOpen = ref(false)
const attachNetworkId = ref('')
const attachNetworkIp = ref('')
const attachNetworkAliases = ref('')
const attachNetworkSubmitting = ref(false)

async function submitAttachNetwork() {
  const aliasIps = parseIdList(attachNetworkAliases.value)
  const body: RequestBody<operations['attach_server_to_network']> = {
    network: Number(attachNetworkId.value),
    ...(attachNetworkIp.value.trim() ? { ip: attachNetworkIp.value.trim() } : {}),
    ...(aliasIps.length ? { alias_ips: aliasIps } : {}),
  }
  attachNetworkSubmitting.value = true
  const result = await act(
    async () => unwrap(await client().POST('/servers/{id}/actions/attach_to_network', { params: { path: { id: props.server.id } }, body })),
    'Attached to network',
  )
  attachNetworkSubmitting.value = false
  if (result !== undefined) {
    attachNetworkOpen.value = false
    attachNetworkId.value = ''
    attachNetworkIp.value = ''
    attachNetworkAliases.value = ''
  }
}

const detachNetworkOpen = ref(false)
const detachNetworkId = ref('')
const detachNetworkSubmitting = ref(false)

async function submitDetachNetwork() {
  const body: RequestBody<operations['detach_server_from_network']> = { network: Number(detachNetworkId.value) }
  detachNetworkSubmitting.value = true
  const result = await act(
    async () => unwrap(await client().POST('/servers/{id}/actions/detach_from_network', { params: { path: { id: props.server.id } }, body })),
    'Detached from network',
  )
  detachNetworkSubmitting.value = false
  if (result !== undefined) {
    detachNetworkOpen.value = false
    detachNetworkId.value = ''
  }
}

const aliasIpsOpen = ref(false)
const aliasIpsNetworkId = ref('')
const aliasIpsValue = ref('')
const aliasIpsSubmitting = ref(false)

async function submitAliasIps() {
  const body: RequestBody<operations['change_server_alias_ips']> = {
    network: Number(aliasIpsNetworkId.value),
    alias_ips: parseIdList(aliasIpsValue.value),
  }
  aliasIpsSubmitting.value = true
  const result = await act(
    async () => unwrap(await client().POST('/servers/{id}/actions/change_alias_ips', { params: { path: { id: props.server.id } }, body })),
    'Alias IPs updated',
  )
  aliasIpsSubmitting.value = false
  if (result !== undefined) {
    aliasIpsOpen.value = false
    aliasIpsNetworkId.value = ''
    aliasIpsValue.value = ''
  }
}

// --- placement group ---
const placementOpen = ref(false)
const placementGroupId = ref('')
const placementSubmitting = ref(false)

async function submitAddToPlacementGroup() {
  const body: RequestBody<operations['add_server_to_placement_group']> = { placement_group: Number(placementGroupId.value) }
  placementSubmitting.value = true
  const result = await act(
    async () => unwrap(await client().POST('/servers/{id}/actions/add_to_placement_group', { params: { path: { id: props.server.id } }, body })),
    'Added to placement group',
  )
  placementSubmitting.value = false
  if (result !== undefined) {
    placementOpen.value = false
    placementGroupId.value = ''
  }
}

function removeFromPlacementGroup() {
  void act(
    async () => unwrap(await client().POST('/servers/{id}/actions/remove_from_placement_group', { params: { path: { id: props.server.id } } })),
    'Removed from placement group',
  )
}

// --- dns ptr ---
const dnsPtrOpen = ref(false)
const dnsPtrIp = ref('')
const dnsPtrValue = ref('')
const dnsPtrSubmitting = ref(false)

function openDnsPtr() {
  dnsPtrIp.value = props.server.public_net.ipv4?.ip ?? ''
  dnsPtrValue.value = ''
  dnsPtrOpen.value = true
}

async function submitDnsPtr() {
  const body: RequestBody<operations['change_server_dns_ptr']> = {
    ip: dnsPtrIp.value.trim(),
    dns_ptr: dnsPtrValue.value.trim() || null,
  }
  dnsPtrSubmitting.value = true
  const result = await act(
    async () => unwrap(await client().POST('/servers/{id}/actions/change_dns_ptr', { params: { path: { id: props.server.id } }, body })),
    'Reverse DNS updated',
  )
  dnsPtrSubmitting.value = false
  if (result !== undefined) dnsPtrOpen.value = false
}

// --- protection ---
const protectionOpen = ref(false)
const protectionDelete = ref(false)
const protectionRebuild = ref(false)
const protectionSubmitting = ref(false)

function openProtection() {
  protectionDelete.value = props.server.protection.delete
  protectionRebuild.value = props.server.protection.rebuild
  protectionOpen.value = true
}

async function submitProtection() {
  const body: RequestBody<operations['change_server_protection']> = {
    delete: protectionDelete.value,
    rebuild: protectionRebuild.value,
  }
  protectionSubmitting.value = true
  const result = await act(
    async () => unwrap(await client().POST('/servers/{id}/actions/change_protection', { params: { path: { id: props.server.id } }, body })),
    'Protection updated',
  )
  protectionSubmitting.value = false
  if (result !== undefined) protectionOpen.value = false
}
</script>

<template>
  <DropdownMenu>
    <DropdownMenuTrigger as-child>
      <Button variant="outline" size="sm">
        Actions
        <ChevronDown class="ml-2 size-4" />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end" class="w-56">
      <DropdownMenuLabel>Power</DropdownMenuLabel>
      <DropdownMenuItem @click="poweron">Power on</DropdownMenuItem>
      <DropdownMenuItem @click="poweroff">Power off</DropdownMenuItem>
      <DropdownMenuItem @click="reboot">Reboot</DropdownMenuItem>
      <DropdownMenuItem @click="reset">Reset</DropdownMenuItem>
      <DropdownMenuItem @click="shutdown">Shut down</DropdownMenuItem>

      <DropdownMenuSeparator />
      <DropdownMenuLabel>Rescue & access</DropdownMenuLabel>
      <DropdownMenuItem @click="rescueOpen = true">Enable rescue mode</DropdownMenuItem>
      <DropdownMenuItem @click="disableRescue">Disable rescue mode</DropdownMenuItem>
      <DropdownMenuItem @click="resetPassword">Reset root password</DropdownMenuItem>
      <DropdownMenuItem @click="requestConsole">Request console</DropdownMenuItem>

      <DropdownMenuSeparator />
      <DropdownMenuLabel>Images & type</DropdownMenuLabel>
      <DropdownMenuItem @click="imageOpen = true">Create image</DropdownMenuItem>
      <DropdownMenuItem @click="rebuildOpen = true">Rebuild</DropdownMenuItem>
      <DropdownMenuItem @click="changeTypeOpen = true">Change type</DropdownMenuItem>

      <DropdownMenuSeparator />
      <DropdownMenuLabel>Backup & ISO</DropdownMenuLabel>
      <DropdownMenuItem @click="enableBackup">Enable backups</DropdownMenuItem>
      <DropdownMenuItem @click="disableBackup">Disable backups</DropdownMenuItem>
      <DropdownMenuItem @click="attachIsoOpen = true">Attach ISO</DropdownMenuItem>
      <DropdownMenuItem @click="detachIso">Detach ISO</DropdownMenuItem>

      <DropdownMenuSeparator />
      <DropdownMenuLabel>Networking</DropdownMenuLabel>
      <DropdownMenuItem @click="attachNetworkOpen = true">Attach to network</DropdownMenuItem>
      <DropdownMenuItem @click="detachNetworkOpen = true">Detach from network</DropdownMenuItem>
      <DropdownMenuItem @click="aliasIpsOpen = true">Change alias IPs</DropdownMenuItem>
      <DropdownMenuItem @click="openDnsPtr">Change reverse DNS</DropdownMenuItem>

      <DropdownMenuSeparator />
      <DropdownMenuLabel>Placement & protection</DropdownMenuLabel>
      <DropdownMenuItem v-if="!server.placement_group" @click="placementOpen = true">Add to placement group</DropdownMenuItem>
      <DropdownMenuItem v-else @click="removeFromPlacementGroup">Remove from placement group</DropdownMenuItem>
      <DropdownMenuItem @click="openProtection">Change protection</DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>

  <ConfirmDialog
    v-model:open="confirmOpen"
    :title="confirmTitle"
    :description="confirmDescription"
    :confirm-label="confirmLabel"
    destructive
    @confirm="onConfirm"
  />

  <ResultDialog
    v-model:open="resultOpen"
    :title="resultTitle"
    :description="resultDescription"
    :fields="resultFields"
  />

  <Dialog v-model:open="rescueOpen">
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Enable rescue mode</DialogTitle>
        <DialogDescription>The rescue system boots on next restart and allows repairing the server.</DialogDescription>
      </DialogHeader>
      <form class="space-y-4" @submit.prevent="submitRescue">
        <div class="space-y-2">
          <Label>Rescue type</Label>
          <Select v-model="rescueType">
            <SelectTrigger class="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="linux64">Linux (64-bit)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div class="space-y-2">
          <Label>SSH keys to inject</Label>
          <Skeleton v-if="rescueKeysLoading" class="h-16 w-full" />
          <div v-else-if="rescueKeysList.length" class="max-h-40 space-y-2 overflow-y-auto rounded-md border p-3">
            <div v-for="key in rescueKeysList" :key="key.id" class="flex items-center gap-2">
              <Checkbox
                :id="`rescue-key-${key.id}`"
                :model-value="rescueKeys.includes(key.id)"
                @update:model-value="toggleRescueKey(key.id, $event)"
              />
              <Label :for="`rescue-key-${key.id}`" class="font-normal">{{ key.name }}</Label>
            </div>
          </div>
          <p v-else class="text-xs text-muted-foreground">No SSH keys in this project.</p>
        </div>
        <DialogFooter>
          <Button type="submit" :disabled="rescueSubmitting">Enable rescue</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>

  <Dialog v-model:open="imageOpen">
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Create image</DialogTitle>
        <DialogDescription>Creates a snapshot or backup of this server's disks.</DialogDescription>
      </DialogHeader>
      <form class="space-y-4" @submit.prevent="submitCreateImage">
        <div class="space-y-2">
          <Label for="img-desc">Description</Label>
          <Input id="img-desc" v-model="imageDescription" placeholder="my-snapshot" />
        </div>
        <div class="space-y-2">
          <Label>Type</Label>
          <Select v-model="imageType">
            <SelectTrigger class="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="snapshot">Snapshot</SelectItem>
              <SelectItem value="backup">Backup</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div class="space-y-2">
          <Label for="img-labels">Labels (one key=value per line)</Label>
          <Textarea id="img-labels" v-model="imageLabels" rows="2" class="font-mono text-xs" />
        </div>
        <DialogFooter>
          <Button type="submit" :disabled="imageSubmitting">Create image</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>

  <Dialog v-model:open="rebuildOpen">
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Rebuild server</DialogTitle>
        <DialogDescription>
          Rebuilds the server from an image, <span class="font-medium text-destructive">destroying all data on disk</span>.
        </DialogDescription>
      </DialogHeader>
      <form class="space-y-4" @submit.prevent="submitRebuild">
        <div class="space-y-2">
          <Label for="rebuild-image">Image name or ID</Label>
          <Input id="rebuild-image" v-model="rebuildImage" placeholder="ubuntu-24.04" required />
        </div>
        <DialogFooter>
          <Button type="submit" variant="destructive" :disabled="rebuildSubmitting || !rebuildImage.trim()">Rebuild</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>

  <Dialog v-model:open="changeTypeOpen">
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Change server type</DialogTitle>
        <DialogDescription>Server must be powered off. Only types with equal or bigger disks are allowed.</DialogDescription>
      </DialogHeader>
      <form class="space-y-4" @submit.prevent="submitChangeType">
        <div class="space-y-2">
          <Label for="ct-name">Server type name</Label>
          <Input id="ct-name" v-model="changeTypeName" placeholder="cpx32" required />
        </div>
        <div class="flex items-center gap-2">
          <Checkbox id="ct-upgrade" v-model="changeTypeUpgradeDisk" />
          <Label for="ct-upgrade" class="font-normal">Upgrade disk (irreversible, prevents downgrades)</Label>
        </div>
        <DialogFooter>
          <Button type="submit" :disabled="changeTypeSubmitting || !changeTypeName.trim()">Change type</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>

  <Dialog v-model:open="attachIsoOpen">
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Attach ISO</DialogTitle>
        <DialogDescription>The server will try to boot from the ISO on next boot.</DialogDescription>
      </DialogHeader>
      <form class="space-y-4" @submit.prevent="submitAttachIso">
        <div class="space-y-2">
          <Label for="iso-name">ISO name or ID</Label>
          <Input id="iso-name" v-model="attachIsoName" placeholder="FreeBSD-14.0-RELEASE-amd64-dvd1" required />
        </div>
        <DialogFooter>
          <Button type="submit" :disabled="attachIsoSubmitting || !attachIsoName.trim()">Attach</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>

  <Dialog v-model:open="attachNetworkOpen">
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Attach to network</DialogTitle>
        <DialogDescription>Adds a private network interface to the server.</DialogDescription>
      </DialogHeader>
      <form class="space-y-4" @submit.prevent="submitAttachNetwork">
        <div class="space-y-2">
          <Label for="an-id">Network ID</Label>
          <Input id="an-id" v-model="attachNetworkId" inputmode="numeric" placeholder="4711" required />
        </div>
        <div class="space-y-2">
          <Label for="an-ip">IP (optional, auto-assigned if empty)</Label>
          <Input id="an-ip" v-model="attachNetworkIp" placeholder="10.0.1.1" />
        </div>
        <div class="space-y-2">
          <Label for="an-aliases">Alias IPs (optional, comma-separated)</Label>
          <Input id="an-aliases" v-model="attachNetworkAliases" placeholder="10.0.1.2, 10.0.1.3" />
        </div>
        <DialogFooter>
          <Button type="submit" :disabled="attachNetworkSubmitting || !attachNetworkId.trim()">Attach</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>

  <Dialog v-model:open="detachNetworkOpen">
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Detach from network</DialogTitle>
        <DialogDescription>Removes the private network interface from the server.</DialogDescription>
      </DialogHeader>
      <form class="space-y-4" @submit.prevent="submitDetachNetwork">
        <div class="space-y-2">
          <Label for="dn-id">Network ID</Label>
          <Input id="dn-id" v-model="detachNetworkId" inputmode="numeric" placeholder="4711" required />
        </div>
        <DialogFooter>
          <Button type="submit" :disabled="detachNetworkSubmitting || !detachNetworkId.trim()">Detach</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>

  <Dialog v-model:open="aliasIpsOpen">
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Change alias IPs</DialogTitle>
        <DialogDescription>Replaces all alias IPs of an attached network.</DialogDescription>
      </DialogHeader>
      <form class="space-y-4" @submit.prevent="submitAliasIps">
        <div class="space-y-2">
          <Label for="ai-id">Network ID</Label>
          <Input id="ai-id" v-model="aliasIpsNetworkId" inputmode="numeric" placeholder="4711" required />
        </div>
        <div class="space-y-2">
          <Label for="ai-ips">Alias IPs (comma-separated)</Label>
          <Input id="ai-ips" v-model="aliasIpsValue" placeholder="10.0.0.3, 10.0.0.4" />
        </div>
        <DialogFooter>
          <Button type="submit" :disabled="aliasIpsSubmitting || !aliasIpsNetworkId.trim()">Save</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>

  <Dialog v-model:open="placementOpen">
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Add to placement group</DialogTitle>
        <DialogDescription>Server must be powered off for this to succeed.</DialogDescription>
      </DialogHeader>
      <form class="space-y-4" @submit.prevent="submitAddToPlacementGroup">
        <div class="space-y-2">
          <Label for="pg-id">Placement group ID</Label>
          <Input id="pg-id" v-model="placementGroupId" inputmode="numeric" placeholder="42" required />
        </div>
        <DialogFooter>
          <Button type="submit" :disabled="placementSubmitting || !placementGroupId.trim()">Add</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>

  <Dialog v-model:open="dnsPtrOpen">
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Change reverse DNS</DialogTitle>
        <DialogDescription>Sets the PTR record for one of the server's public IPs.</DialogDescription>
      </DialogHeader>
      <form class="space-y-4" @submit.prevent="submitDnsPtr">
        <div class="space-y-2">
          <Label for="ptr-ip">IP address</Label>
          <Input id="ptr-ip" v-model="dnsPtrIp" required />
        </div>
        <div class="space-y-2">
          <Label for="ptr-value">DNS PTR (empty to reset)</Label>
          <Input id="ptr-value" v-model="dnsPtrValue" placeholder="server01.example.com" />
        </div>
        <DialogFooter>
          <Button type="submit" :disabled="dnsPtrSubmitting || !dnsPtrIp.trim()">Save</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>

  <Dialog v-model:open="protectionOpen">
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Change protection</DialogTitle>
        <DialogDescription>Protect the server against destructive operations.</DialogDescription>
      </DialogHeader>
      <form class="space-y-4" @submit.prevent="submitProtection">
        <div class="flex items-center gap-2">
          <Checkbox id="prot-delete" v-model="protectionDelete" />
          <Label for="prot-delete" class="font-normal">Protect from deletion</Label>
        </div>
        <div class="flex items-center gap-2">
          <Checkbox id="prot-rebuild" v-model="protectionRebuild" />
          <Label for="prot-rebuild" class="font-normal">Protect from rebuild</Label>
        </div>
        <DialogFooter>
          <Button type="submit" :disabled="protectionSubmitting">Save</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>
