import DefaultTheme from 'vitepress/theme'
import Layout from './Layout.vue'
import './styles/dark-overrides.css'
import './styles/landing.css'

export default {
  extends: DefaultTheme,
  Layout,
}
