<script setup lang="ts">
import { ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ArrowLeft, RefreshCw, Trash2 } from 'lucide-vue-next'
import { useApi, ApiError } from '@/composables/useApi'
import { runAction } from '@/composables/usePagedResource'
import { formatHourly, formatMonthly, priceForLocation } from '@/lib/price'
import type { ServerDetail } from './types'
import { formatBytes } from './types'
import PageHeader from '@/components/shared/PageHeader.vue'
import ErrorState from '@/components/shared/ErrorState.vue'
import ConfirmDialog from '@/components/shared/ConfirmDialog.vue'
import KeyValue from '@/components/shared/KeyValue.vue'
import JsonBlock from '@/components/shared/JsonBlock.vue'
import StatusBadge from '@/components/shared/StatusBadge.vue'
import LabelsBadges from '@/components/shared/LabelsBadges.vue'
import ServerActionsDropdown from './ServerActionsDropdown.vue'
import ServerMetricsPanel from './ServerMetricsPanel.vue'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

const props = defineProps<{
  id: string
}>()

const router = useRouter()
const { client, unwrap } = useApi()

const server = ref<ServerDetail | null>(null)
const loading = ref(true)
const error = ref<string | null>(null)

async function fetchServer() {
  loading.value = true
  error.value = null
  try {
    const data = unwrap(await client().GET('/servers/{id}', { params: { path: { id: Number(props.id) } } }))
    server.value = data.server ?? null
    if (!data.server) error.value = 'Server not found.'
  } catch (e) {
    error.value = e instanceof ApiError ? e.message : String(e)
    server.value = null
  } finally {
    loading.value = false
  }
}

watch(() => props.id, fetchServer, { immediate: true })

function priceLabel(current: ServerDetail): string | null {
  const price = priceForLocation(current.server_type.prices, current.location.name)
  if (!price) return null
  return `${formatHourly(price.price_hourly.net)}/h · ${formatMonthly(price.price_monthly.net)}/mo (net, ${price.location})`
}

const deleteOpen = ref(false)

async function confirmDelete() {
  const current = server.value
  if (!current) return
  const result = await runAction(async () => {
    await client().DELETE('/servers/{id}', { params: { path: { id: current.id } } })
    return true
  }, 'Server deleted')
  if (result !== undefined) {
    deleteOpen.value = false
    router.push('/servers')
  }
}
</script>

<template>
  <div class="space-y-4">
    <PageHeader
      :title="server?.name ?? `Server #${id}`"
      :description="server ? `ID ${server.id} · ${server.server_type.description} in ${server.location.name}` : 'Server details'"
    >
      <StatusBadge v-if="server" :status="server.status" />
      <Button variant="outline" size="sm" :disabled="loading" @click="fetchServer()">
        <RefreshCw class="mr-2 size-4" />
        Refresh
      </Button>
      <ServerActionsDropdown v-if="server" :server="server" @done="fetchServer()" />
      <Button v-if="server" variant="destructive" size="sm" @click="deleteOpen = true">
        <Trash2 class="mr-2 size-4" />
        Delete
      </Button>
    </PageHeader>

    <ErrorState v-if="error" :error="error" @retry="fetchServer()" />

    <div v-if="loading" class="space-y-3">
      <Skeleton v-for="i in 4" :key="i" class="h-9 w-full" />
    </div>

    <template v-else-if="server">
      <Tabs default-value="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="metrics">Metrics</TabsTrigger>
          <TabsTrigger value="json">JSON</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" class="mt-4 space-y-6">
          <KeyValue
            :items="[
              { label: 'ID', value: server.id },
              { label: 'Status', value: server.status },
              { label: 'Public IPv4', value: server.public_net.ipv4?.ip, mask: true },
              { label: 'Public IPv6', value: server.public_net.ipv6?.ip, mask: true },
              {
                label: 'Private networks',
                value: server.private_net.length
                  ? server.private_net.map((net) => `${net.ip ?? '—'} (net ${net.network ?? '—'})`).join(', ')
                  : null,
                mask: true,
              },
              { label: 'Server type', value: `${server.server_type.name} (${server.server_type.description})` },
              { label: 'Image', value: server.image ? (server.image.name ?? server.image.description) : null },
              { label: 'Location', value: `${server.location.name} — ${server.location.description}` },
              { label: 'Price', value: priceLabel(server) },
              { label: 'Placement group', value: server.placement_group?.name },
              { label: 'ISO', value: server.iso ? (server.iso.name ?? server.iso.description) : null },
              { label: 'Rescue enabled', value: server.rescue_enabled ? 'Yes' : 'No' },
              { label: 'Backup window', value: server.backup_window },
              { label: 'Included traffic', value: formatBytes(server.included_traffic) },
              { label: 'Outgoing traffic', value: formatBytes(server.outgoing_traffic) },
              { label: 'Ingoing traffic', value: formatBytes(server.ingoing_traffic) },
              {
                label: 'Protection',
                value: [
                  server.protection.delete ? 'delete' : null,
                  server.protection.rebuild ? 'rebuild' : null,
                ]
                  .filter(Boolean)
                  .join(', ') || 'None',
              },
              { label: 'Created', value: server.created ? new Date(server.created).toLocaleString() : null },
            ]"
          />
          <div>
            <p class="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">Labels</p>
            <LabelsBadges :labels="server.labels" />
          </div>
        </TabsContent>

        <TabsContent value="metrics" class="mt-4">
          <ServerMetricsPanel :server-id="server.id" />
        </TabsContent>

        <TabsContent value="json" class="mt-4">
          <JsonBlock :data="server" />
        </TabsContent>
      </Tabs>
    </template>

    <div v-else-if="!error" class="text-sm text-muted-foreground">
      <Button variant="outline" size="sm" @click="router.push('/servers')">
        <ArrowLeft class="mr-2 size-4" />
        Back to servers
      </Button>
    </div>

    <ConfirmDialog
      v-model:open="deleteOpen"
      title="Delete server?"
      :description="`This will permanently delete '${server?.name}' and detach all attached resources.`"
      confirm-label="Delete"
      destructive
      @confirm="confirmDelete"
    />
  </div>
</template>
