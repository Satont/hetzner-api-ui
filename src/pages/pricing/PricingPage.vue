<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { RefreshCw } from 'lucide-vue-next'
import { useApi } from '@/composables/useApi'
import { ApiError, type ResponseItem } from '@/api/client'
import type { operations } from '@/api/schema'
import PageHeader from '@/components/shared/PageHeader.vue'
import ErrorState from '@/components/shared/ErrorState.vue'
import KeyValue from '@/components/shared/KeyValue.vue'
import JsonBlock from '@/components/shared/JsonBlock.vue'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

type Pricing = ResponseItem<operations['get_pricing'], 'pricing'>

const { client, unwrap } = useApi()

const pricing = ref<Pricing | null>(null)
const loading = ref(false)
const error = ref<string | null>(null)

async function load() {
  loading.value = true
  error.value = null
  try {
    const data = unwrap(await client().GET('/pricing'))
    pricing.value = data.pricing
  } catch (e) {
    error.value = e instanceof ApiError ? e.message : String(e)
  } finally {
    loading.value = false
  }
}

onMounted(load)

function fmtPrice(value: string): string {
  const currency = pricing.value?.currency ?? 'EUR'
  return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(Number(value))
}

function fmtTraffic(bytes: number): string {
  const tb = bytes / 1099511627776
  return `${Number.isInteger(tb) ? tb : tb.toFixed(1)} TB`
}
</script>

<template>
  <div class="space-y-4">
    <PageHeader title="Pricing" description="Current prices for all billable Hetzner Cloud resources.">
      <Button variant="outline" size="sm" :disabled="loading" @click="load()">
        <RefreshCw class="mr-2 size-4" />
        Refresh
      </Button>
    </PageHeader>

    <ErrorState v-if="error" :error="error" @retry="load()" />

    <div v-if="loading && !pricing" class="grid gap-4 lg:grid-cols-2">
      <Skeleton v-for="i in 4" :key="i" class="h-48 w-full" />
    </div>

    <Tabs v-if="pricing" default-value="overview">
      <TabsList>
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="json">JSON</TabsTrigger>
      </TabsList>

      <TabsContent value="overview" class="mt-4 space-y-4">
        <div class="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>General</CardTitle>
              <CardDescription>Currency, taxes and backup surcharge.</CardDescription>
            </CardHeader>
            <CardContent>
              <KeyValue
                :items="[
                  { label: 'Currency', value: pricing.currency },
                  { label: 'VAT rate', value: `${pricing.vat_rate}%` },
                  { label: 'Server backup', value: `+${pricing.server_backup.percentage}% of server price` },
                ]"
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Storage &amp; IPs</CardTitle>
              <CardDescription>Flat per-resource prices (net / gross).</CardDescription>
            </CardHeader>
            <CardContent>
              <KeyValue
                :items="[
                  {
                    label: 'Image per GB/month',
                    value: `${fmtPrice(pricing.image.price_per_gb_month.net)} / ${fmtPrice(pricing.image.price_per_gb_month.gross)}`,
                  },
                  {
                    label: 'Volume per GB/month',
                    value: `${fmtPrice(pricing.volume.price_per_gb_month.net)} / ${fmtPrice(pricing.volume.price_per_gb_month.gross)}`,
                  },
                  {
                    label: 'Floating IP per month',
                    value: `${fmtPrice(pricing.floating_ip.price_monthly.net)} / ${fmtPrice(pricing.floating_ip.price_monthly.gross)}`,
                  },
                ]"
              />
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Floating IPs</CardTitle>
            <CardDescription>Monthly price per type and location.</CardDescription>
          </CardHeader>
          <CardContent>
            <div class="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead class="text-right">Monthly net</TableHead>
                    <TableHead class="text-right">Monthly gross</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <template v-for="entry in pricing.floating_ips" :key="entry.type">
                    <TableRow v-for="price in entry.prices" :key="`${entry.type}-${price.location}`">
                      <TableCell class="uppercase">{{ entry.type }}</TableCell>
                      <TableCell class="font-mono">{{ price.location }}</TableCell>
                      <TableCell class="text-right">{{ fmtPrice(price.price_monthly.net) }}</TableCell>
                      <TableCell class="text-right">{{ fmtPrice(price.price_monthly.gross) }}</TableCell>
                    </TableRow>
                  </template>
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Primary IPs</CardTitle>
            <CardDescription>Hourly and monthly price per type and location.</CardDescription>
          </CardHeader>
          <CardContent>
            <div class="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead class="text-right">Hourly net</TableHead>
                    <TableHead class="text-right">Hourly gross</TableHead>
                    <TableHead class="text-right">Monthly net</TableHead>
                    <TableHead class="text-right">Monthly gross</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <template v-for="entry in pricing.primary_ips" :key="entry.type">
                    <TableRow v-for="price in entry.prices" :key="`${entry.type}-${price.location}`">
                      <TableCell class="uppercase">{{ entry.type }}</TableCell>
                      <TableCell class="font-mono">{{ price.location }}</TableCell>
                      <TableCell class="text-right">{{ fmtPrice(price.price_hourly.net) }}</TableCell>
                      <TableCell class="text-right">{{ fmtPrice(price.price_hourly.gross) }}</TableCell>
                      <TableCell class="text-right">{{ fmtPrice(price.price_monthly.net) }}</TableCell>
                      <TableCell class="text-right">{{ fmtPrice(price.price_monthly.gross) }}</TableCell>
                    </TableRow>
                  </template>
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Load Balancers</CardTitle>
            <CardDescription>Price per load balancer type and location, including traffic.</CardDescription>
          </CardHeader>
          <CardContent class="space-y-6">
            <div v-for="lbType in pricing.load_balancer_types" :key="lbType.id" class="space-y-2">
              <h3 class="text-sm font-medium">{{ lbType.name }}</h3>
              <div class="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Location</TableHead>
                      <TableHead class="text-right">Hourly net</TableHead>
                      <TableHead class="text-right">Hourly gross</TableHead>
                      <TableHead class="text-right">Monthly net</TableHead>
                      <TableHead class="text-right">Monthly gross</TableHead>
                      <TableHead class="text-right">Included traffic</TableHead>
                      <TableHead class="text-right">Per extra TB</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow v-for="price in lbType.prices" :key="price.location">
                      <TableCell class="font-mono">{{ price.location }}</TableCell>
                      <TableCell class="text-right">{{ fmtPrice(price.price_hourly.net) }}</TableCell>
                      <TableCell class="text-right">{{ fmtPrice(price.price_hourly.gross) }}</TableCell>
                      <TableCell class="text-right">{{ fmtPrice(price.price_monthly.net) }}</TableCell>
                      <TableCell class="text-right">{{ fmtPrice(price.price_monthly.gross) }}</TableCell>
                      <TableCell class="text-right">{{ fmtTraffic(price.included_traffic) }}</TableCell>
                      <TableCell class="text-right">{{ fmtPrice(price.price_per_tb_traffic.net) }}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Server Types</CardTitle>
            <CardDescription>Hourly and monthly price per server type and location, including traffic.</CardDescription>
          </CardHeader>
          <CardContent class="space-y-6">
            <div v-for="serverType in pricing.server_types" :key="serverType.id" class="space-y-2">
              <h3 class="text-sm font-medium">{{ serverType.name }}</h3>
              <div class="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Location</TableHead>
                      <TableHead class="text-right">Hourly net</TableHead>
                      <TableHead class="text-right">Hourly gross</TableHead>
                      <TableHead class="text-right">Monthly net</TableHead>
                      <TableHead class="text-right">Monthly gross</TableHead>
                      <TableHead class="text-right">Included traffic</TableHead>
                      <TableHead class="text-right">Per extra TB</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow v-for="price in serverType.prices" :key="price.location">
                      <TableCell class="font-mono">{{ price.location }}</TableCell>
                      <TableCell class="text-right">{{ fmtPrice(price.price_hourly.net) }}</TableCell>
                      <TableCell class="text-right">{{ fmtPrice(price.price_hourly.gross) }}</TableCell>
                      <TableCell class="text-right">{{ fmtPrice(price.price_monthly.net) }}</TableCell>
                      <TableCell class="text-right">{{ fmtPrice(price.price_monthly.gross) }}</TableCell>
                      <TableCell class="text-right">{{ fmtTraffic(price.included_traffic) }}</TableCell>
                      <TableCell class="text-right">{{ fmtPrice(price.price_per_tb_traffic.net) }}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="json" class="mt-4">
        <JsonBlock :data="pricing" />
      </TabsContent>
    </Tabs>
  </div>
</template>
