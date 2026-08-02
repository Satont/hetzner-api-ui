<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { Check, ChevronsUpDown, Plus, Settings2 } from 'lucide-vue-next'
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const store = useProjectsStore()
const router = useRouter()

const activeName = computed(() => store.activeProject?.name ?? 'Select project')

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
  <DropdownMenu>
    <DropdownMenuTrigger as-child>
      <Button variant="outline" class="w-full justify-between">
        <span class="truncate">{{ activeName }}</span>
        <ChevronsUpDown class="ml-2 size-4 shrink-0 opacity-50" />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent class="w-56" align="start">
      <DropdownMenuLabel>Projects</DropdownMenuLabel>
      <DropdownMenuItem v-for="project in store.projects" :key="project.id" @click="store.setActive(project.id)">
        <Check class="mr-2 size-4" :class="project.id === store.activeId ? 'opacity-100' : 'opacity-0'" />
        <span class="truncate">{{ project.name }}</span>
      </DropdownMenuItem>
      <DropdownMenuSeparator v-if="store.projects.length" />
      <DropdownMenuItem @click="dialogOpen = true">
        <Plus class="mr-2 size-4" />
        Add project
      </DropdownMenuItem>
      <DropdownMenuItem @click="router.push('/projects')">
        <Settings2 class="mr-2 size-4" />
        Manage projects
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>

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
          <Label for="project-name">Name</Label>
          <Input id="project-name" v-model="name" placeholder="production" required />
        </div>
        <div class="space-y-2">
          <Label for="project-token">API token</Label>
          <Input id="project-token" v-model="token" type="password" placeholder="…" required />
        </div>
        <DialogFooter>
          <Button type="submit">Add</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>
