<script setup lang="ts">
import AppSidebar from '@/components/AppSidebar.vue'
import NoProjectState from '@/components/NoProjectState.vue'
import { SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar'
import { Toaster } from '@/components/ui/sonner'
import { useProjectsStore } from '@/stores/projects'

const store = useProjectsStore()
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
      </header>
      <main class="flex-1 p-6">
        <NoProjectState v-if="!store.activeProject" />
        <RouterView v-else />
      </main>
    </SidebarInset>
    <Toaster rich-colors position="top-right" />
  </SidebarProvider>
</template>
