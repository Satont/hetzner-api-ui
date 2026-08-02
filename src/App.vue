<script setup lang="ts">
import { Moon, Sun } from 'lucide-vue-next'
import AppSidebar from '@/components/AppSidebar.vue'
import NoProjectState from '@/components/NoProjectState.vue'
import { Button } from '@/components/ui/button'
import { SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar'
import { Toaster } from '@/components/ui/sonner'
import { useProjectsStore } from '@/stores/projects'
import { useTheme } from '@/composables/useTheme'

const store = useProjectsStore()
const { theme, toggleTheme } = useTheme()
</script>

<template>
  <SidebarProvider>
    <AppSidebar />
    <SidebarInset>
      <header class="flex h-12 items-center gap-2 border-b px-4">
        <SidebarTrigger />
        <span v-if="store.activeProject" class="text-sm text-muted-foreground">
          {{ store.activeProject.name }}
        </span>
        <Button variant="ghost" size="icon" class="ml-auto" :title="theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'" @click="toggleTheme">
          <Sun v-if="theme === 'dark'" class="size-4" />
          <Moon v-else class="size-4" />
        </Button>
      </header>
      <main class="flex-1 p-6">
        <NoProjectState v-if="!store.activeProject" />
        <RouterView v-else />
      </main>
    </SidebarInset>
    <Toaster rich-colors position="top-right" />
  </SidebarProvider>
</template>
