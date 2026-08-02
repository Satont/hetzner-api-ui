<script setup lang="ts">
import { ref } from 'vue'
import { KeyRound } from 'lucide-vue-next'
import { useProjectsStore } from '@/stores/projects'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const store = useProjectsStore()

const dialogOpen = ref(false)
const name = ref('')
const token = ref('')

function submit() {
  if (!name.value.trim() || !token.value.trim()) return
  store.addProject(name.value, token.value)
  dialogOpen.value = false
  name.value = ''
  token.value = ''
}
</script>

<template>
  <div class="flex h-full items-center justify-center">
    <Empty class="border">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <KeyRound />
        </EmptyMedia>
        <EmptyTitle>No project selected</EmptyTitle>
        <EmptyDescription>
          Add a Hetzner Cloud project with its API token to start managing resources.
        </EmptyDescription>
      </EmptyHeader>
      <Button @click="dialogOpen = true">Add project</Button>
    </Empty>
  </div>

  <Dialog v-model:open="dialogOpen">
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Add project</DialogTitle>
        <DialogDescription>
          A project is a name plus a Hetzner Cloud API token. Stored only in your browser's localStorage.
        </DialogDescription>
      </DialogHeader>
      <form class="space-y-4" @submit.prevent="submit">
        <div class="space-y-2">
          <Label for="np-name">Name</Label>
          <Input id="np-name" v-model="name" placeholder="production" required />
        </div>
        <div class="space-y-2">
          <Label for="np-token">API token</Label>
          <Input id="np-token" v-model="token" type="password" required />
        </div>
        <DialogFooter>
          <Button type="submit">Add</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>
