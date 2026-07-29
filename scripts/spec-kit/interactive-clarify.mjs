#!/usr/bin/env node

import { spawnSync } from 'node:child_process'
import fs from 'node:fs'

export function codexClarifyArgs() {
  return ['--no-alt-screen', '/speckit-clarify']
}

export function runInteractiveClarify({ executable = 'codex' } = {}) {
  let input
  let output
  try {
    input = fs.openSync('/dev/tty', 'r+')
    output = fs.openSync('/dev/tty', 'r+')
  } catch {
    throw new Error(
      'Interactive clarification requires a terminal. Run pnpm spec:workflow from an interactive shell.',
    )
  }

  // Spec Kit's shell step captures its own stdio. `script` creates a real PTY
  // for Codex, while the outer workflow can continue capturing the step.
  const result = spawnSync('script', ['-q', '/dev/null', executable, ...codexClarifyArgs()], {
    cwd: process.cwd(),
    env: process.env,
    stdio: [input, output, output],
  })

  fs.closeSync(input)
  fs.closeSync(output)

  if (result.error) {
    throw result.error
  }
  return result.status ?? 1
}

if (process.argv[1]?.endsWith('interactive-clarify.mjs')) {
  try {
    process.exitCode = runInteractiveClarify()
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
    process.exitCode = 1
  }
}
