<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useApi } from '@/composables/useApi'
import { runAction } from '@/composables/usePagedResource'
import { parseLabels } from '@/lib/labels'
import type { operations } from '@/api/schema'
import type { RequestBody } from '@/api/client'
import type { Image, Location, Network, ServerType, SshKey } from './types'
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

const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ created: [] }>()

const { client, unwrap } = useApi()

// --- selectable options ---
const serverTypes = ref<ServerType[]>([])
const images = ref<Image[]>([])
const locations = ref<Location[]>([])
const sshKeys = ref<SshKey[]>([])
const networks = ref<Network[]>([])
const optionsLoading = ref(false)
const optionsLoaded = ref(false)

async function loadOptions() {
  if (optionsLoaded.value || optionsLoading.value) return
  optionsLoading.value = true
  try {
    const [typesData, imagesData, locationsData, keysData, networksData] = await Promise.all([
      unwrap(await client().GET('/server_types', { params: { query: { per_page: 100 } } })),
      unwrap(
        await client().GET('/images', {
          params: { query: { per_page: 100, status: ['available'], sort: ['name'] } },
        }),
      ),
      unwrap(await client().GET('/locations', { params: { query: { per_page: 100 } } })),
      unwrap(await client().GET('/ssh_keys', { params: { query: { per_page: 100 } } })),
      unwrap(await client().GET('/networks', { params: { query: { per_page: 100 } } })),
    ])
    serverTypes.value = typesData.server_types ?? []
    images.value = imagesData.images ?? []
    locations.value = locationsData.locations ?? []
    sshKeys.value = keysData.ssh_keys ?? []
    networks.value = networksData.networks ?? []
    optionsLoaded.value = true
  } finally {
    optionsLoading.value = false
  }
}

watch(open, (value) => {
  if (value) void loadOptions()
})

// --- form state ---
const name = ref('')
const serverType = ref('')
const image = ref('')
const location = ref('')
const selectedSshKeys = ref<string[]>([])
const selectedNetworks = ref<number[]>([])
const userData = ref('')
const labelsText = ref('')
const startAfterCreate = ref(true)
const creating = ref(false)

const selectedType = computed(() => serverTypes.value.find((t) => t.name === serverType.value))

const filteredImages = computed(() => {
  const arch = selectedType.value?.architecture
  if (!arch) return images.value
  const matching = images.value.filter((img) => img.architecture === arch)
  return matching.length ? matching : images.value
})

function imageValue(img: Image): string {
  return img.name ?? String(img.id)
}

function imageLabel(img: Image): string {
  return img.name ?? `${img.description} (#${img.id})`
}

watch(serverType, () => {
  if (image.value && !filteredImages.value.some((img) => imageValue(img) === image.value)) {
    image.value = ''
  }
})

function toggleSshKey(keyName: string, checked: boolean | 'indeterminate') {
  if (checked === true) {
    if (!selectedSshKeys.value.includes(keyName)) selectedSshKeys.value = [...selectedSshKeys.value, keyName]
  } else {
    selectedSshKeys.value = selectedSshKeys.value.filter((existing) => existing !== keyName)
  }
}

function toggleNetwork(networkId: number, checked: boolean | 'indeterminate') {
  if (checked === true) {
    if (!selectedNetworks.value.includes(networkId)) selectedNetworks.value = [...selectedNetworks.value, networkId]
  } else {
    selectedNetworks.value = selectedNetworks.value.filter((existing) => existing !== networkId)
  }
}

function resetForm() {
  name.value = ''
  serverType.value = ''
  image.value = ''
  location.value = ''
  selectedSshKeys.value = []
  selectedNetworks.value = []
  userData.value = ''
  labelsText.value = ''
  startAfterCreate.value = true
}

async function submit() {
  const labels = parseLabels(labelsText.value)
  const body: RequestBody<operations['create_server']> = {
    name: name.value.trim(),
    server_type: serverType.value,
    image: image.value,
    start_after_create: startAfterCreate.value,
    ...(location.value ? { location: location.value } : {}),
    ...(selectedSshKeys.value.length ? { ssh_keys: selectedSshKeys.value } : {}),
    ...(selectedNetworks.value.length ? { networks: selectedNetworks.value } : {}),
    ...(userData.value.trim() ? { user_data: userData.value } : {}),
    ...(Object.keys(labels).length ? { labels } : {}),
  }
  creating.value = true
  const result = await runAction(async () => {
    return unwrap(await client().POST('/servers', { body }))
  }, 'Server created')
  creating.value = false
  if (result !== undefined) {
    open.value = false
    resetForm()
    emit('created')
  }
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="max-h-[90vh] overflow-y-auto sm:max-w-lg">
      <DialogHeader>
        <DialogTitle>Create server</DialogTitle>
        <DialogDescription>Provision a new cloud server. Only the name, type, and image are required.</DialogDescription>
      </DialogHeader>
      <form class="space-y-4" @submit.prevent="submit">
        <div class="space-y-2">
          <Label for="srv-name">Name</Label>
          <Input id="srv-name" v-model="name" placeholder="my-server" required />
        </div>

        <template v-if="optionsLoading">
          <Skeleton v-for="i in 3" :key="i" class="h-9 w-full" />
        </template>
        <template v-else>
          <div class="space-y-2">
            <Label>Server type</Label>
            <Select v-model="serverType" required>
              <SelectTrigger class="w-full">
                <SelectValue placeholder="Select a server type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem v-for="type in serverTypes" :key="type.id" :value="type.name">
                  {{ type.name }} — {{ type.cores }} vCPU / {{ type.memory }} GB / {{ type.disk }} GB
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div class="space-y-2">
            <Label>Image</Label>
            <Select v-model="image" required>
              <SelectTrigger class="w-full">
                <SelectValue placeholder="Select an image" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem v-for="img in filteredImages" :key="img.id" :value="imageValue(img)">
                  {{ imageLabel(img) }}
                </SelectItem>
              </SelectContent>
            </Select>
            <p v-if="selectedType?.architecture" class="text-xs text-muted-foreground">
              Filtered to {{ selectedType.architecture }} images matching the selected type.
            </p>
          </div>

          <div class="space-y-2">
            <Label>Location</Label>
            <Select v-model="location">
              <SelectTrigger class="w-full">
                <SelectValue placeholder="Auto (cheapest)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem v-for="loc in locations" :key="loc.id" :value="loc.name">
                  {{ loc.name }} — {{ loc.description }}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div v-if="sshKeys.length" class="space-y-2">
            <Label>SSH keys</Label>
            <div class="space-y-2 rounded-md border p-3">
              <div v-for="key in sshKeys" :key="key.id" class="flex items-center gap-2">
                <Checkbox
                  :id="`srv-key-${key.id}`"
                  :model-value="selectedSshKeys.includes(key.name)"
                  @update:model-value="toggleSshKey(key.name, $event)"
                />
                <Label :for="`srv-key-${key.id}`" class="font-normal">{{ key.name }}</Label>
              </div>
            </div>
          </div>

          <div v-if="networks.length" class="space-y-2">
            <Label>Networks</Label>
            <div class="space-y-2 rounded-md border p-3">
              <div v-for="network in networks" :key="network.id" class="flex items-center gap-2">
                <Checkbox
                  :id="`srv-net-${network.id}`"
                  :model-value="selectedNetworks.includes(network.id)"
                  @update:model-value="toggleNetwork(network.id, $event)"
                />
                <Label :for="`srv-net-${network.id}`" class="font-normal">
                  {{ network.name }} <span class="text-muted-foreground">({{ network.ip_range }})</span>
                </Label>
              </div>
            </div>
          </div>
        </template>

        <div class="space-y-2">
          <Label for="srv-user-data">User data (cloud-init)</Label>
          <Textarea id="srv-user-data" v-model="userData" rows="3" class="font-mono text-xs" placeholder="#cloud-config" />
        </div>

        <div class="space-y-2">
          <Label for="srv-labels">Labels (one key=value per line)</Label>
          <Textarea id="srv-labels" v-model="labelsText" rows="2" class="font-mono text-xs" />
        </div>

        <div class="flex items-center gap-2">
          <Checkbox id="srv-start" v-model="startAfterCreate" />
          <Label for="srv-start" class="font-normal">Start server after creation</Label>
        </div>

        <DialogFooter>
          <Button type="submit" :disabled="creating || !name || !serverType || !image">
            {{ creating ? 'Creating…' : 'Create' }}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>
