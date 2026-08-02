import { computed, ref, watch } from 'vue'
import { defineStore } from 'pinia'

export interface Project {
  id: string
  name: string
  token: string
}

const PROJECTS_KEY = 'hetzner-ui:projects'
const ACTIVE_KEY = 'hetzner-ui:active-project'

function loadProjects(): Project[] {
  try {
    const raw = localStorage.getItem(PROJECTS_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as Project[]
    return parsed.filter((p) => p && typeof p.id === 'string' && typeof p.token === 'string')
  } catch {
    return []
  }
}

export const useProjectsStore = defineStore('projects', () => {
  const projects = ref<Project[]>(loadProjects())
  const activeId = ref<string | null>(localStorage.getItem(ACTIVE_KEY))

  const activeProject = computed<Project | null>(
    () => projects.value.find((p) => p.id === activeId.value) ?? null,
  )

  watch(
    projects,
    (value) => {
      localStorage.setItem(PROJECTS_KEY, JSON.stringify(value))
    },
    { deep: true },
  )

  watch(activeId, (value) => {
    if (value === null) localStorage.removeItem(ACTIVE_KEY)
    else localStorage.setItem(ACTIVE_KEY, value)
  })

  function addProject(name: string, token: string): Project {
    const project: Project = { id: crypto.randomUUID(), name: name.trim(), token: token.trim() }
    projects.value.push(project)
    activeId.value = project.id
    return project
  }

  function updateProject(id: string, patch: Partial<Omit<Project, 'id'>>) {
    const project = projects.value.find((p) => p.id === id)
    if (!project) return
    if (patch.name !== undefined) project.name = patch.name
    if (patch.token !== undefined) project.token = patch.token
  }

  function removeProject(id: string) {
    projects.value = projects.value.filter((p) => p.id !== id)
    if (activeId.value === id) activeId.value = projects.value[0]?.id ?? null
  }

  function setActive(id: string | null) {
    activeId.value = id
  }

  return { projects, activeId, activeProject, addProject, updateProject, removeProject, setActive }
})
