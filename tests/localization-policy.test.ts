import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, it } from 'vitest'
import { Knot, LocalizedTexts, type RawKnot } from '../src/core'
import { messages } from '../src/locales'
import raw from '../v1/examples/knots/open-rope.json'

it('uses English for initial model localization and fallback regardless of data order', () => {
  const names = [{ language: 'uk', value: 'Українська' }, { language: 'en', value: 'English' }]
  const texts = new LocalizedTexts(...names)
  expect(texts.get()).toBe('English')
  expect(texts.get('fr')).toBe('English')
  const input = structuredClone(raw) as unknown as RawKnot
  input.subject.names = names
  expect(Knot.from(input).subject.getName()).toBe('English')
  expect(Knot.from(input, { locale: 'uk' }).subject.getName()).toBe('Українська')
})

it('lists English first in viewer translations', () => {
  expect(Object.keys(messages)).toEqual(['en', 'uk'])
})

it('documents the English viewer default in both editions', () => {
  for (const [file, defaultText] of [
    ['v1/specifications/components.md', 'default en'],
    ['v1/specifications/components.uk.md', 'типово en'],
  ]) {
    const row = readFileSync(file, 'utf8').split('\n').find(line => line.startsWith('| `locale?:'))
    expect(row, file).toContain("'en' \\| 'uk'")
    expect(row, file).toContain(defaultText)
  }
  for (const file of ['site/runtime/index.html', 'site/runtime/preview.html']) {
    expect(readFileSync(file, 'utf8'), file).toContain('<html lang="en">')
  }
})

it('authors English first in multilingual resource and example arrays', () => {
  function check(value: unknown, location: string) {
    if (!value || typeof value !== 'object') return
    if (Array.isArray(value)) {
      const languages = value.filter(item => item && typeof item === 'object' && 'language' in item).map(item => item.language)
      if (languages.includes('en')) expect(languages[0], location).toBe('en')
    }
    for (const [key, child] of Object.entries(value)) check(child, `${location}.${key}`)
  }
  function scan(directory: string) {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const file = join(directory, entry.name)
      if (entry.isDirectory()) scan(file)
      else if (file.endsWith('.json')) check(JSON.parse(readFileSync(file, 'utf8')), file)
    }
  }
  for (const entry of readdirSync('.', { withFileTypes: true })) {
    if (entry.isDirectory() && /^v\d+$/.test(entry.name)) scan(entry.name)
  }
})
