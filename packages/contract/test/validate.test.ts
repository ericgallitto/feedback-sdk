import { readFileSync, readdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it, expect } from 'vitest'
import Ajv from 'ajv'
import { feedbackInputSchema, feedbackRecordSchema } from '../src/schema.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const fixturesDir = join(__dirname, 'fixtures')

function loadFixture(name: string): unknown {
  return JSON.parse(readFileSync(join(fixturesDir, name), 'utf8'))
}

const ajv = new Ajv({ allErrors: true })
const validateInput = ajv.compile(feedbackInputSchema)
const validateRecord = ajv.compile(feedbackRecordSchema)

describe('feedbackInputSchema', () => {
  it('accepts a minimal valid input (user_email only)', () => {
    const data = loadFixture('valid-input-minimal.json')
    const valid = validateInput(data)
    expect(valid, JSON.stringify(validateInput.errors)).toBe(true)
  })

  it('accepts a full valid input with all optional fields', () => {
    const data = loadFixture('valid-input-full.json')
    const valid = validateInput(data)
    expect(valid, JSON.stringify(validateInput.errors)).toBe(true)
  })

  it('accepts an anonymous input (user_email, no user_id)', () => {
    const data = loadFixture('valid-input-anon.json')
    const valid = validateInput(data)
    expect(valid, JSON.stringify(validateInput.errors)).toBe(true)
  })

  it('rejects input missing page_url', () => {
    const data = loadFixture('invalid-missing-url.json')
    expect(validateInput(data)).toBe(false)
  })

  it('rejects input with an invalid category enum value', () => {
    const data = loadFixture('invalid-bad-category.json')
    expect(validateInput(data)).toBe(false)
  })

  it('rejects input with neither user_id nor user_email', () => {
    const data = loadFixture('invalid-no-identity.json')
    expect(validateInput(data)).toBe(false)
  })
})

describe('feedbackRecordSchema', () => {
  it('validates the canonical stored record fixture', () => {
    const data = loadFixture('valid-record.json')
    const valid = validateRecord(data)
    expect(valid, JSON.stringify(validateRecord.errors)).toBe(true)
  })
})

describe('fixture corpus — all valid-*.json pass their schema', () => {
  const files = readdirSync(fixturesDir).filter((f) => f.startsWith('valid-'))

  for (const file of files) {
    it(file, () => {
      const data = loadFixture(file)
      const isRecord = file.startsWith('valid-record')
      const validator = isRecord ? validateRecord : validateInput
      const valid = validator(data)
      expect(valid, JSON.stringify(validator.errors)).toBe(true)
    })
  }
})
