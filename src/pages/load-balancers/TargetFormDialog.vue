<script setup lang="ts">
import { ref, watch } from 'vue'
import { useApi } from '@/composables/useApi'
import { runAction } from '@/composables/usePagedResource'
import type { RequestBody } from '@/api/client'
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

type AddTargetBody = RequestBody<operations['add_load_balancer_target']>

const props = defineProps<{
  lbId: number
}>()

const emit = defineEmits<{ saved: [] }>()
const open = defineModel<boolean>('open', { default: false })

const { client, unwrap } = useApi()

const targetType = ref('server')
const serverId = ref('')
const targetIp = ref('')
const selector = ref('')
const usePrivateIp = ref(false)
const saving = ref(false)

watch(open, (isOpen) => {
  if (!isOpen) return
  targetType.value = 'server'
  serverId.value = ''
  targetIp.value = ''
  selector.value = ''
  usePrivateIp.value = false
})

async function submit() {
  let body: AddTargetBody
  if (targetType.value === 'ip') {
    body = { type: 'ip', ip: { ip: targetIp.value.trim() } }
  } else if (targetType.value === 'label_selector') {
    body = {
      type: 'label_selector',
      label_selector: { selector: selector.value.trim() },
      use_private_ip: usePrivateIp.value,
    }
  } else {
    body = {
      type: 'server',
      server: { id: Number(serverId.value) },
      use_private_ip: usePrivateIp.value,
    }
  }
  saving.value = true
  const result = await runAction(async () => {
    return unwrap(
      await client().POST('/load_balancers/{id}/actions/add_target', {
        params: { path: { id: props.lbId } },
        body,
      }),
    )
  }, 'Target added')
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
        <DialogTitle>Add target</DialogTitle>
        <DialogDescription>Add a server, IP or label selector target.</DialogDescription>
      </DialogHeader>
      <form class="space-y-4" @submit.prevent="submit">
        <div class="space-y-2">
          <Label>Type</Label>
          <Select v-model="targetType">
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="server">server</SelectItem>
              <SelectItem value="ip">ip</SelectItem>
              <SelectItem value="label_selector">label_selector</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div v-if="targetType === 'server'" class="space-y-2">
          <Label for="tgt-server">Server ID</Label>
          <Input id="tgt-server" v-model="serverId" type="number" min="1" required />
        </div>
        <div v-else-if="targetType === 'ip'" class="space-y-2">
          <Label for="tgt-ip">IP address</Label>
          <Input id="tgt-ip" v-model="targetIp" placeholder="203.0.113.1" required />
        </div>
        <div v-else class="space-y-2">
          <Label for="tgt-selector">Label selector</Label>
          <Input id="tgt-selector" v-model="selector" placeholder="env=prod" required />
        </div>
        <div v-if="targetType !== 'ip'" class="flex items-center gap-2">
          <Checkbox id="tgt-private" :model-value="usePrivateIp" @update:model-value="usePrivateIp = $event === true" />
          <Label for="tgt-private">Use private IP</Label>
        </div>
        <DialogFooter>
          <Button type="submit" :disabled="saving">Add</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>
