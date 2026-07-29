import { execFileSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

export function workflowLockDirectory(root, exec = execFileSync) {
  try {
    const commonDirectory = String(
      exec('git', ['rev-parse', '--git-common-dir'], {
        cwd: root,
        encoding: 'utf8',
      }),
    ).trim()
    const absoluteDirectory = path.isAbsolute(commonDirectory)
      ? commonDirectory
      : path.resolve(root, commonDirectory)
    return path.join(absoluteDirectory, 'portflow-workflows')
  } catch {
    return path.join(root, '.specify', 'workflows', 'runs', 'locks')
  }
}

export function acquireWorkflowLock({
  root,
  issueNumber,
  namespace = 'run',
  exec = execFileSync,
  processId = process.pid,
  processAlive = isProcessAlive,
} = {}) {
  if (!root || !Number.isSafeInteger(issueNumber) || issueNumber < 1) {
    throw new Error('A repository root and positive issue number are required for the lock.')
  }

  const directory = workflowLockDirectory(root, exec)
  const lockPath = path.join(directory, `${namespace}-issue-${issueNumber}.lock`)
  const token = randomUUID()
  const record = {
    version: 1,
    namespace,
    issueNumber,
    pid: processId,
    token,
    root: path.resolve(root),
    startedAt: new Date().toISOString(),
  }

  fs.mkdirSync(directory, { recursive: true })
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      fs.writeFileSync(lockPath, `${JSON.stringify(record, null, 2)}\n`, {
        encoding: 'utf8',
        flag: 'wx',
      })
      return {
        path: lockPath,
        release() {
          releaseWorkflowLock(lockPath, token)
        },
      }
    } catch (error) {
      if (error?.code !== 'EEXIST') {
        throw error
      }
      const existing = readLock(lockPath)
      if (existing?.pid && processAlive(existing.pid)) {
        throw new Error(
          `Workflow ${namespace} for issue #${issueNumber} is already active in process ${existing.pid}.`,
        )
      }
      if (attempt === 0) {
        fs.rmSync(lockPath, { force: true })
        continue
      }
      throw new Error(`Workflow ${namespace} for issue #${issueNumber} is already active.`)
    }
  }

  throw new Error(`Unable to acquire workflow ${namespace} lock for issue #${issueNumber}.`)
}

function readLock(lockPath) {
  try {
    return JSON.parse(fs.readFileSync(lockPath, 'utf8'))
  } catch {
    return null
  }
}

function releaseWorkflowLock(lockPath, token) {
  const current = readLock(lockPath)
  if (current?.token === token) {
    fs.rmSync(lockPath, { force: true })
  }
}

function isProcessAlive(processId) {
  try {
    process.kill(processId, 0)
    return true
  } catch (error) {
    return error?.code === 'EPERM'
  }
}
