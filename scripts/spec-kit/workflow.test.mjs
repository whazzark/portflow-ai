import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'

import { resolveInvocation, validateFeatureDirectory } from './workflow.mjs'

test('accepts domain-oriented feature directories', () => {
  assert.equal(
    validateFeatureDirectory('specs/user-administration/invitation-onboarding/invite-user'),
    'specs/user-administration/invitation-onboarding/invite-user',
  )
  assert.equal(
    validateFeatureDirectory('specs/standalone/confirm-email'),
    'specs/standalone/confirm-email',
  )
})

test('rejects paths outside the canonical feature hierarchy', () => {
  for (const value of [
    '/tmp/specs/example',
    '../specs/example',
    'specs/../outside',
    'specs/Feature Name',
    'specs\\standalone\\feature',
    'other/domain/feature',
  ]) {
    assert.throws(() => validateFeatureDirectory(value))
  }
})

test('builds a guarded workflow run invocation', () => {
  assert.deepEqual(
    resolveInvocation([
      '--',
      'run',
      '--feature-dir',
      'specs/standalone/confirm-email',
      '--description',
      'GitHub issue #123',
      '--dry-run',
    ]),
    {
      command: 'specify',
      args: ['workflow', 'run', 'portflow-feature', '--input', 'spec=GitHub issue #123'],
      dryRun: true,
      featureDirectory: 'specs/standalone/confirm-email',
    },
  )
})

test('uses the non-destructive workflow for an existing spec', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'portflow-workflow-'))
  const feature = path.join(root, 'specs', 'standalone', 'existing-feature')
  fs.mkdirSync(feature, { recursive: true })
  fs.writeFileSync(path.join(feature, 'spec.md'), '# Existing spec\n\n**Status**: Draft\n')

  const invocation = resolveInvocation(
    [
      'run',
      '--feature-dir',
      'specs/standalone/existing-feature',
      '--description',
      'Update issue #123',
    ],
    root,
  )

  assert.equal(invocation.args[2], 'portflow-existing-feature')
})

test('refuses to implement a historical spec', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'portflow-workflow-'))
  const feature = path.join(root, 'specs', 'standalone', 'historical-feature')
  fs.mkdirSync(feature, { recursive: true })
  fs.writeFileSync(
    path.join(feature, 'spec.md'),
    // biome-ignore lint/security/noSecrets: This is a literal Spec Kit status fixture.
    '# Historical spec\n\n**Status**: Done (historical)\n',
  )

  assert.throws(
    () =>
      resolveInvocation(
        [
          'run',
          '--feature-dir',
          'specs/standalone/historical-feature',
          '--description',
          'Restart old work',
        ],
        root,
      ),
    /Historical specs cannot start/,
  )
})

test('requires a run ID and feature directory to resume', () => {
  assert.throws(() => resolveInvocation(['resume', '--feature-dir', 'specs/standalone/example']))
  assert.throws(() => resolveInvocation(['resume', 'run-123']))
})

test('requires an explicit feature directory and description to run', () => {
  assert.throws(() => resolveInvocation(['run', '--description', 'intent']), /feature-dir/)
  assert.throws(
    () => resolveInvocation(['run', '--feature-dir', 'specs/standalone/example']),
    /description/,
  )
})

test('builds workflow status invocations without feature state', () => {
  assert.deepEqual(resolveInvocation(['status', 'run-123']), {
    command: 'specify',
    args: ['workflow', 'status', 'run-123'],
    dryRun: false,
    featureDirectory: null,
  })
})
