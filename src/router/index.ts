import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', redirect: '/servers' },
    { path: '/projects', component: () => import('@/pages/ProjectsPage.vue') },
    { path: '/servers', component: () => import('@/pages/servers/ServersPage.vue') },
    { path: '/servers/:id', component: () => import('@/pages/servers/ServerDetailPage.vue'), props: true },
    { path: '/images', component: () => import('@/pages/images/ImagesPage.vue') },
    { path: '/server-types', component: () => import('@/pages/server-types/ServerTypesPage.vue') },
    { path: '/ssh-keys', component: () => import('@/pages/ssh-keys/SshKeysPage.vue') },
    { path: '/placement-groups', component: () => import('@/pages/placement-groups/PlacementGroupsPage.vue') },
    { path: '/isos', component: () => import('@/pages/isos/IsosPage.vue') },
    { path: '/volumes', component: () => import('@/pages/volumes/VolumesPage.vue') },
    { path: '/networks', component: () => import('@/pages/networks/NetworksPage.vue') },
    { path: '/firewalls', component: () => import('@/pages/firewalls/FirewallsPage.vue') },
    { path: '/floating-ips', component: () => import('@/pages/floating-ips/FloatingIpsPage.vue') },
    { path: '/primary-ips', component: () => import('@/pages/primary-ips/PrimaryIpsPage.vue') },
    { path: '/load-balancers', component: () => import('@/pages/load-balancers/LoadBalancersPage.vue') },
    { path: '/load-balancer-types', component: () => import('@/pages/load-balancers/LoadBalancerTypesPage.vue') },
    { path: '/certificates', component: () => import('@/pages/certificates/CertificatesPage.vue') },
    { path: '/zones', component: () => import('@/pages/zones/ZonesPage.vue') },
    { path: '/zones/:id', component: () => import('@/pages/zones/ZoneDetailPage.vue'), props: true },
    { path: '/locations', component: () => import('@/pages/locations/LocationsPage.vue') },
    { path: '/datacenters', redirect: '/locations' },
    { path: '/pricing', component: () => import('@/pages/pricing/PricingPage.vue') },
    { path: '/actions', component: () => import('@/pages/actions/ActionsPage.vue') },
  ],
})

export default router
