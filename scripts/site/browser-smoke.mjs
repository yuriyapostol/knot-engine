import assert from 'node:assert/strict'
import { chromium } from 'playwright-core'
import { existsSync } from 'node:fs'
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || (existsSync('/usr/bin/google-chrome') ? '/usr/bin/google-chrome' : chromium.executablePath()), headless: true, args: ['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-webgl'] })
try {
 const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
 const errors = []
 page.on('pageerror',e=>errors.push(e.message))
 await page.goto((process.env.SITE_TEST_URL || 'http://127.0.0.1:5173')+'/v1/guide/getting-started/')
 assert.equal(await page.locator('html').getAttribute('lang'),'en')
 await page.locator('a[hreflang="uk"]').click()
 assert.match(page.url(),/\/v1\/uk\/guide\/getting-started\//)
 assert.equal(await page.locator('html').getAttribute('lang'),'uk')
 await page.locator('iframe').scrollIntoViewIfNeeded()
 const frame = page.frameLocator('iframe')
 await frame.locator('.knot-viewer[data-state="ready"]').waitFor({timeout:30000})
 assert.equal(await frame.locator('html').getAttribute('lang'),'uk')
 assert.ok(await frame.locator('textarea').count())
 assert.equal(await frame.locator('header').count(),0)
 assert.equal(await page.locator('header .status').count(),0)
 const editedCode = (await frame.locator('textarea').inputValue()) + '\n '
 await frame.locator('textarea').fill(editedCode)
 const initialTheme = await page.locator('html').getAttribute('data-theme')
 await page.locator('.theme-toggle').click()
 const changedTheme = initialTheme === 'dark' ? 'light' : 'dark'
 await frame.locator(`main[data-theme="${changedTheme}"]`).waitFor()
 assert.equal(await frame.locator('textarea').inputValue(),editedCode)
 await page.reload()
 assert.equal(await page.locator('html').getAttribute('data-theme'),changedTheme)
 await page.locator('iframe').scrollIntoViewIfNeeded()
 await frame.locator(`main[data-theme="${changedTheme}"]`).waitFor()
 await page.locator('a[hreflang="en"]').click()
 assert.match(page.url(),/\/v1\/guide\/getting-started\//)
 await page.locator('iframe').scrollIntoViewIfNeeded()
 await frame.locator('html[lang="en"]').waitFor()
 await frame.locator(`main[data-theme="${changedTheme}"]`).waitFor()
 await frame.locator('.knot-viewer[data-state="ready"]').waitFor()
 await page.screenshot({path:'/tmp/knot-site-desktop.png',fullPage:true})
 await page.setViewportSize({width:390,height:844})
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth),true)
 await page.screenshot({path:'/tmp/knot-site-mobile.png',fullPage:true})
 assert.deepEqual(errors,[])
 console.log('Site browser checks passed: topic-preserving language switch, package viewer, JSON editor, mobile layout, no JavaScript errors.')
} finally { await browser.close() }
