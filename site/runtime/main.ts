import { createApp } from 'vue'
import App from '../components/InteractiveExample.vue'
import '../../src/styles.css'
import './style.css'

const hosts = document.querySelectorAll('[data-knot-engine-demo="v1"]')
if (hosts.length) {
  for (const host of hosts) createApp(App).mount(host)
} else if (document.querySelector('#app')) {
  // The standalone example uses the same component; documentation owns its own locale/theme.
  document.documentElement.lang = new URLSearchParams(location.search).get('lang') === 'uk' ? 'uk' : 'en'
  createApp(App).mount('#app')
}
