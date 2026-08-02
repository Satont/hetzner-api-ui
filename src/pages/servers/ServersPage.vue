<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { Plus, RefreshCw } from 'lucide-vue-next'
import { useApi } from '@/composables/useApi'
import { usePagedResource } from '@/composables/usePagedResource'
import { formatHourly, formatMonthly, priceForLocation } from '@/lib/price'
import type { Server } from './types'
import PageHeader from '@/components/shared/PageHeader.vue'
import PaginationBar from '@/components/shared/PaginationBar.vue'
import ErrorState from '@/components/shared/ErrorState.vue'
import StatusBadge from '@/components/shared/StatusBadge.vue'
import MaskedValue from '@/components/shared/MaskedValue.vue'
import LabelsBadges from '@/components/shared/LabelsBadges.vue'
import CreateServerDialog from './CreateServerDialog.vue'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

const { client, unwrap } = useApi()
const router = useRouter()

const { items, loading, error, pageInfo, reload } = usePagedResource<Server>(async ({ page, per_page }) => {
  const data = unwrap(
    await client().GET('/servers', { params: { query: { page, per_page, sort: ['id:desc'] } } }),
  )
  return { items: data.servers ?? [], pagination: data.meta?.pagination ?? {} }
})

const createOpen = ref(false)

function serverPriceLabel(server: Server): string | null {
  const price = priceForLocation(server.server_type.prices, server.location.name)
  return price ? `${formatHourly(price.price_hourly.net)}/h` : null
}

function serverMonthlyLabel(server: Server): string | null {
  const price = priceForLocation(server.server_type.prices, server.location.name)
  return price ? `${formatMonthly(price.price_monthly.net)}/mo` : null
}
</script>

<template>
  <div class="space-y-4">
    <PageHeader title="Servers" description="Virtual servers running in your Hetzner Cloud project.">
      <Button variant="outline" size="sm" :disabled="loading" @click="reload()">
        <RefreshCw class="mr-2 size-4" />
        Refresh
      </Button>
      <Button size="sm" @click="createOpen = true">
        <Plus class="mr-2 size-4" />
        Create server
      </Button>
    </PageHeader>

    <ErrorState v-if="error" :error="error" @retry="reload()" />

    <div class="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Public IPv4</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Price</TableHead>
            <TableHead>Location</TableHead>
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
            <TableCell colspan="8" class="py-8 text-center text-muted-foreground">No servers.</TableCell>
          </TableRow>
          <TableRow
            v-for="server in items"
            v-else
            :key="server.id"
            class="cursor-pointer"
            @click="router.push(`/servers/${server.id}`)"
          >
            <TableCell class="font-medium">{{ server.name }}</TableCell>
            <TableCell><StatusBadge :status="server.status" /></TableCell>
            <TableCell><MaskedValue :value="server.public_net.ipv4?.ip" /></TableCell>
            <TableCell>{{ server.server_type.name }}</TableCell>
            <TableCell>
              <template v-if="serverPriceLabel(server)">
                <div>{{ serverPriceLabel(server) }}</div>
                <div class="text-xs text-muted-foreground">{{ serverMonthlyLabel(server) }}</div>
              </template>
              <span v-else class="text-muted-foreground">—</span>
            </TableCell>
            <TableCell>{{ server.location.name }}</TableCell>
            <TableCell><LabelsBadges :labels="server.labels" /></TableCell>
            <TableCell class="text-muted-foreground">
              {{ server.created ? new Date(server.created).toLocaleString() : '—' }}
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>

    <PaginationBar :page-info="pageInfo" :loading="loading" @change="reload" />

    <CreateServerDialog v-model:open="createOpen" @created="reload()" />
  </div>
</template>
