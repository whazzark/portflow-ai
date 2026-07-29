import assert from 'node:assert/strict'
import { test } from 'node:test'

import { codexClarifyArgs } from './interactive-clarify.mjs'

test('starts Codex in interactive mode with the clarification skill', () => {
  assert.deepEqual(codexClarifyArgs(), ['--no-alt-screen', '/speckit-clarify'])
})
