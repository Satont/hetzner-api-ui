<script setup lang="ts">
import { ref, watch } from 'vue'
import { useApi } from '@/composables/useApi'
import { runAction } from '@/composables/usePagedResource'
import type { ListItem, RequestBody } from '@/api/client'
import type { operations } from '@/api/schema'
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

type LoadBalancer = ListItem<operations['list_load_balancers'], 'load_balancers'>
type LBService = LoadBalancer['services'][number]
type AddServiceBody = RequestBody<operations['add_load_balancer_service']>
type UpdateServiceBody = RequestBody<operations['update_load_balancer_service']>
type ServiceHealthCheck = NonNullable<AddServiceBody['health_check']>

const props = defineProps<{
  lbId: number
  initial?: LBService | null
}>()

const emit = defineEmits<{ saved: [] }>()
const open = defineModel<boolean>('open', { default: false })

const { client, unwrap } = useApi()

const protocol = ref('tcp')
const listenPort = ref('80')
const destinationPort = ref('80')
const proxyprotocol = ref(false)
const hcProtocol = ref('tcp')
const hcPort = ref('80')
const hcInterval = ref('15')
const hcTimeout = ref('10')
const hcRetries = ref('3')
const hcDomain = ref('')
const hcPath = ref('/')
const hcTls = ref(false)
const saving = ref(false)

watch(open, (isOpen) => {
  if (!isOpen) return
  const svc = props.initial
  protocol.value = svc?.protocol ?? 'tcp'
  listenPort.value = String(svc?.listen_port ?? 80)
  destinationPort.value = String(svc?.destination_port ?? 80)
  proxyprotocol.value = svc?.proxyprotocol ?? false
  hcProtocol.value = svc?.health_check.protocol ?? 'tcp'
  hcPort.value = String(svc?.health_check.port ?? 80)
  hcInterval.value = String(svc?.health_check.interval ?? 15)
  hcTimeout.value = String(svc?.health_check.timeout ?? 10)
  hcRetries.value = String(svc?.health_check.retries ?? 3)
  hcDomain.value = svc?.health_check.http?.domain ?? ''
  hcPath.value = svc?.health_check.http?.path ?? '/'
  hcTls.value = svc?.health_check.http?.tls ?? false
})

function buildHealthCheck(): ServiceHealthCheck {
  const hcProto = hcProtocol.value === 'http' ? 'http' : 'tcp'
  return {
    protocol: hcProto,
    port: Number(hcPort.value),
    interval: Number(hcInterval.value),
    timeout: Number(hcTimeout.value),
    retries: Number(hcRetries.value),
    ...(hcProto === 'http'
      ? {
          http: {
            domain: hcDomain.value.trim() || null,
            path: hcPath.value.trim() || '/',
            tls: hcTls.value,
          },
        }
      : {}),
  } as ServiceHealthCheck
}

async function submit() {
  const proto = protocol.value === 'https' ? 'https' : protocol.value === 'http' ? 'http' : 'tcp'
  saving.value = true
  let result: unknown
  if (props.initial) {
    const body: UpdateServiceBody = {
      protocol: proto,
      listen_port: Number(listenPort.value),
      destination_port: Number(destinationPort.value),
      proxyprotocol: proxyprotocol.value,
      health_check: buildHealthCheck(),
    }
    result = await runAction(async () => {
      return unwrap(
        await client().POST('/load_balancers/{id}/actions/update_service', {
          params: { path: { id: props.lbId } },
          body,
        }),
      )
    }, 'Service updated')
  } else {
    const body: AddServiceBody = {
      protocol: proto,
      listen_port: Number(listenPort.value),
      destination_port: Number(destinationPort.value),
      proxyprotocol: proxyprotocol.value,
      health_check: buildHealthCheck(),
    }
    result = await runAction(async () => {
      return unwrap(
        await client().POST('/load_balancers/{id}/actions/add_service', {
          params: { path: { id: props.lbId } },
          body,
        }),
      )
    }, 'Service added')
  }
  saving.value = false
  if (result !== undefined) {
    open.value = false
    emit('saved')
  }
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent>
      <DialogHeader>
        <DialogTitle>{{ initial ? 'Update service' : 'Add service' }}</DialogTitle>
        <DialogDescription>Configure a listener and its health check.</DialogDescription>
      </DialogHeader>
      <form class="max-h-[70vh] space-y-4 overflow-y-auto pr-1" @submit.prevent="submit">
        <div class="grid grid-cols-2 gap-4">
          <div class="space-y-2">
            <Label>Protocol</Label>
            <Select v-model="protocol">
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="tcp">tcp</SelectItem>
                <SelectItem value="http">http</SelectItem>
                <SelectItem value="https">https</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div class="flex items-end gap-2 pb-1">
            <Checkbox
              id="svc-proxy"
              :model-value="proxyprotocol"
              @update:model-value="proxyprotocol = $event === true"
            />
            <Label for="svc-proxy">Proxy protocol</Label>
          </div>
          <div class="space-y-2">
            <Label for="svc-listen">Listen port</Label>
            <Input id="svc-listen" v-model="listenPort" type="number" min="1" max="65535" required />
          </div>
          <div class="space-y-2">
            <Label for="svc-dest">Destination port</Label>
            <Input id="svc-dest" v-model="destinationPort" type="number" min="1" max="65535" required />
          </div>
        </div>

        <div class="space-y-3 rounded-md border p-3">
          <p class="text-sm font-medium">Health check</p>
          <div class="grid grid-cols-2 gap-4">
            <div class="space-y-2">
              <Label>Protocol</Label>
              <Select v-model="hcProtocol">
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="tcp">tcp</SelectItem>
                  <SelectItem value="http">http</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div class="space-y-2">
              <Label for="svc-hc-port">Port</Label>
              <Input id="svc-hc-port" v-model="hcPort" type="number" min="1" max="65535" required />
            </div>
            <div class="space-y-2">
              <Label for="svc-hc-interval">Interval (s)</Label>
              <Input id="svc-hc-interval" v-model="hcInterval" type="number" min="1" required />
            </div>
            <div class="space-y-2">
              <Label for="svc-hc-timeout">Timeout (s)</Label>
              <Input id="svc-hc-timeout" v-model="hcTimeout" type="number" min="1" required />
            </div>
            <div class="space-y-2">
              <Label for="svc-hc-retries">Retries</Label>
              <Input id="svc-hc-retries" v-model="hcRetries" type="number" min="0" required />
            </div>
          </div>
          <div v-if="hcProtocol === 'http'" class="grid grid-cols-2 gap-4">
            <div class="space-y-2">
              <Label for="svc-hc-domain">Domain (optional)</Label>
              <Input id="svc-hc-domain" v-model="hcDomain" placeholder="example.com" />
            </div>
            <div class="space-y-2">
              <Label for="svc-hc-path">Path</Label>
              <Input id="svc-hc-path" v-model="hcPath" placeholder="/" required />
            </div>
            <div class="flex items-center gap-2">
              <Checkbox id="svc-hc-tls" :model-value="hcTls" @update:model-value="hcTls = $event === true" />
              <Label for="svc-hc-tls">Use HTTPS (TLS)</Label>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button type="submit" :disabled="saving">{{ initial ? 'Update' : 'Add' }}</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>
