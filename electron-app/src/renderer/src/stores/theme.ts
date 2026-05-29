import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

export type ThemeMode = 'dark' | 'light'

const STORAGE_KEY = 'lol-match-data-theme'

function getInitialTheme(): ThemeMode {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved === 'dark' || saved === 'light') return saved
  } catch {}
  return 'dark'
}

export const useThemeStore = defineStore('theme', () => {
  const theme = ref<ThemeMode>(getInitialTheme())

  const isDark = ref(theme.value === 'dark')

  watch(theme, (val) => {
    isDark.value = val === 'dark'
    try { localStorage.setItem(STORAGE_KEY, val) } catch {}
    document.documentElement.setAttribute('data-theme', val)
  }, { immediate: true })

  function toggleTheme() {
    theme.value = theme.value === 'dark' ? 'light' : 'dark'
  }

  function setTheme(mode: ThemeMode) {
    theme.value = mode
  }

  return { theme, isDark, toggleTheme, setTheme }
})
