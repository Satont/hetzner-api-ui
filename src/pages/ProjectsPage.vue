<script setup lang="ts">
import { ref } from 'vue'
import { Plus, Trash2 } from 'lucide-vue-next'
import { useProjectsStore, type Project } from '@/stores/projects'
import PageHeader from '@/components/shared/PageHeader.vue'
import ConfirmDialog from '@/components/shared/ConfirmDialog.vue'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
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

const store = useProjectsStore()

const createOpen = ref(false)
const name = ref('')
const token = ref('')

function submit() {
  if (!name.value.trim() || !token.value.trim()) return
  store.addProject(name.value, token.value)
  createOpen.value = false
  name.value = ''
  token.value = ''
}

const deleteTarget = ref<Project | null>(null)
const deleteOpen = ref(false)

function askDelete(project: Project) {
  deleteTarget.value = project
  deleteOpen.value = true
}

function confirmDelete() {
  if (deleteTarget.value) store.removeProject(deleteTarget.value.id)
  deleteOpen.value = false
}

function masked(tokenValue: string): string {
  if (tokenValue.length <= 8) return '••••••••'
  return `${tokenValue.slice(0, 4)}…${tokenValue.slice(-4)}`
}
</script>

<template>
  <div class="space-y-4">
    <PageHeader title="Projects" description="Named Hetzner Cloud API tokens, stored in localStorage only.">
      <Button size="sm" @click="createOpen = true">
        <Plus class="mr-2 size-4" />
        Add project
      </Button>
    </PageHeader>

    <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <Card v-for="project in store.projects" :key="project.id">
        <CardHeader>
          <CardTitle class="flex items-center justify-between gap-2">
            <span class="truncate">{{ project.name }}</span>
            <Badge v-if="project.id === store.activeId">active</Badge>
          </CardTitle>
          <CardDescription class="font-mono text-xs">{{ masked(project.token) }}</CardDescription>
        </CardHeader>
        <CardContent class="flex items-center justify-between">
          <Button v-if="project.id !== store.activeId" variant="outline" size="sm" @click="store.setActive(project.id)">
            Set active
          </Button>
          <span v-else />
          <Button variant="ghost" size="icon" @click="askDelete(project)">
            <Trash2 class="size-4 text-destructive" />
          </Button>
        </CardContent>
      </Card>
      <p v-if="!store.projects.length" class="text-sm text-muted-foreground">No projects yet.</p>
    </div>

    <Dialog v-model:open="createOpen">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add project</DialogTitle>
          <DialogDescription>Name plus a Hetzner Cloud API token.</DialogDescription>
        </DialogHeader>
        <form class="space-y-4" @submit.prevent="submit">
          <div class="space-y-2">
            <Label for="p-name">Name</Label>
            <Input id="p-name" v-model="name" required />
          </div>
          <div class="space-y-2">
            <Label for="p-token">API token</Label>
            <Input id="p-token" v-model="token" type="password" required />
          </div>
          <DialogFooter>
            <Button type="submit">Add</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>

    <ConfirmDialog
      v-model:open="deleteOpen"
      title="Remove project?"
      :description="`Remove '${deleteTarget?.name}' and its token from this browser?`"
      confirm-label="Remove"
      destructive
      @confirm="confirmDelete"
    />
  </div>
</template>
