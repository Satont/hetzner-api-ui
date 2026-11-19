<script setup lang="ts">
import {
  Activity,
  Award,
  Globe,
  HardDrive,
  KeyRound,
  Layers,
  MapPin,
  Network,
  Router,
  Server,
  ServerCog,
  Shield,
  Tag,
  Disc3,
  Boxes,
  Scale,
  Images,
  DatabaseZap,
} from 'lucide-vue-next'
import type { FunctionalComponent } from 'vue'
import ProjectSwitcher from '@/components/ProjectSwitcher.vue'
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar'

interface NavItem {
  title: string
  to: string
  icon: FunctionalComponent
}

interface NavGroup {
  label: string
  items: NavItem[]
}

const groups: NavGroup[] = [
  {
    label: 'Compute',
    items: [
      { title: 'Servers', to: '/servers', icon: Server },
      { title: 'Images', to: '/images', icon: Images },
      { title: 'Server Types', to: '/server-types', icon: ServerCog },
      { title: 'SSH Keys', to: '/ssh-keys', icon: KeyRound },
      { title: 'Placement Groups', to: '/placement-groups', icon: Boxes },
      { title: 'ISOs', to: '/isos', icon: Disc3 },
    ],
  },
  {
    label: 'Storage',
    items: [{ title: 'Volumes', to: '/volumes', icon: HardDrive }],
  },
  {
    label: 'Network',
    items: [
      { title: 'Networks', to: '/networks', icon: Network },
      { title: 'Firewalls', to: '/firewalls', icon: Shield },
      { title: 'Floating IPs', to: '/floating-ips', icon: Router },
      { title: 'Primary IPs', to: '/primary-ips', icon: Layers },
      { title: 'Load Balancers', to: '/load-balancers', icon: Scale },
      { title: 'LB Types', to: '/load-balancer-types', icon: DatabaseZap },
      { title: 'Certificates', to: '/certificates', icon: Award },
      { title: 'DNS Zones', to: '/zones', icon: Globe },
    ],
  },
  {
    label: 'Meta',
    items: [
      { title: 'Locations', to: '/locations', icon: MapPin },
      { title: 'Pricing', to: '/pricing', icon: Tag },
      { title: 'Actions', to: '/actions', icon: Activity },
    ],
  },
]
</script>

<template>
  <Sidebar>
    <SidebarHeader class="gap-3 p-3">
      <div class="flex items-center gap-2 px-1">
        <Server class="size-5 text-primary" />
        <span class="text-sm font-semibold">Hetzner Cloud UI</span>
      </div>
      <ProjectSwitcher />
    </SidebarHeader>
    <SidebarContent>
      <SidebarGroup v-for="group in groups" :key="group.label">
        <SidebarGroupLabel>{{ group.label }}</SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu>
            <SidebarMenuItem v-for="item in group.items" :key="item.to">
              <SidebarMenuButton as-child>
                <RouterLink :to="item.to" active-class="bg-sidebar-accent text-sidebar-accent-foreground font-medium">
                  <component :is="item.icon" />
                  <span>{{ item.title }}</span>
                </RouterLink>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    </SidebarContent>
  </Sidebar>
</template>
