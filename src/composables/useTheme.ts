import { ref, watch } from 'vue'

export type Theme = 'light' | 'dark'

const THEME_KEY = 'hetzner-ui:theme'

function initialTheme(): Theme {
  const stored = localStorage.getItem(THEME_KEY)
  if (stored === 'light' || stored === 'dark') return stored
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

const theme = ref<Theme>(initialTheme())

function apply(value: Theme) {
  document.documentElement.classList.toggle('dark', value === 'dark')
}

watch(theme, (value) => {
  apply(value)
  localStorage.setItem(THEME_KEY, value)
})

apply(theme.value)

export function useTheme() {
  function toggleTheme() {
    theme.value = theme.value === 'dark' ? 'light' : 'dark'
  }

  return { theme, toggleTheme }
}
