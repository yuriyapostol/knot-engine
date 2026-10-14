(() => {
  let saved
  try { saved = localStorage.getItem('knot-engine-theme') } catch {}
  const root = document.documentElement
  root.dataset.theme = saved === 'dark' || saved === 'light' ? saved : (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
  window.toggleSiteTheme = () => {
    root.dataset.theme = root.dataset.theme === 'dark' ? 'light' : 'dark'
    try { localStorage.setItem('knot-engine-theme', root.dataset.theme) } catch {}
  }
})()
