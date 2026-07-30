import { DELIVERY_PROFILES, DELIVERY_STAGE_LABELS } from './delivery-model.mjs'

const START = '<!-- portflow:delivery-workflow:start -->'
const END = '<!-- portflow:delivery-workflow:end -->'

export function renderDeliveryProgress(state) {
  const stages = visibleStages(state.profile)
  const currentIndex = stages.indexOf(state.stage)
  const rows = stages.map((stage, index) => {
    const status = stageStatus({ stage, index, currentIndex, state })
    return `| ${DELIVERY_STAGE_LABELS[stage]} | ${status.label} | ${status.evidence} |`
  })

  return `${START}

## Delivery workflow

**Profile**: \`${state.profile}\`  
**Current step**: **${state.stageLabel}**

| Step | Status | Evidence |
|---|---|---|
${rows.join('\n')}

${renderSlices(state)}
${renderBlockers(state)}
${END}`
}

export function updateDeliveryProgress(body, state) {
  const block = renderDeliveryProgress(state)
  const value = String(body ?? '')
  const pattern = new RegExp(`${escapeRegExp(START)}[\\s\\S]*?${escapeRegExp(END)}`)
  if (pattern.test(value)) {
    return value.replace(pattern, () => block)
  }
  const insertionPoint = value.search(/^##\s+(Verification|Screenshots|Ready-for-delivery)/m)
  if (insertionPoint >= 0) {
    return `${value.slice(0, insertionPoint).trimEnd()}\n\n${block}\n\n${value.slice(insertionPoint)}`
  }
  return `${value.trimEnd()}\n\n${block}\n`
}

export function renderDeliveryPullRequestBody({ issue, featureDirectory, state, summary = null }) {
  const spec = state.profile === 'lite' || !featureDirectory ? 'N/A' : `${featureDirectory}/spec.md`
  const specDriven = state.profile !== 'lite'
  return `## Summary

${summary ?? `Delivers #${issue.number}: ${issue.title}.`}

## Change type

- [${specDriven ? 'x' : ' '}] Spec-driven behavior change
- [${specDriven ? ' ' : 'x'}] Bug fix, refactor, workflow, documentation, or tooling

## Delivery

Profile: \`${state.profile}\`

Spec: \`${spec}\`

${renderDeliveryProgress(state)}

## Issue

Issue: #${issue.number}

## Reviewer focus

Review the current workflow step and its evidence. Product decisions, risk acceptance, final approval, and merge remain human responsibilities.

## Delivered changes

- Delivery in progress

## Verification

- Automated checks: Pending
- Browser journeys: Pending when applicable
- Independent review: Pending

## Database

- [x] Not assessed yet (Draft PR only)
- [ ] No migration
- [ ] Reversible migration included

## Screenshots

Add before/after screenshots or a short recording for user-interface changes.

## Ready-for-delivery checklist

- [ ] Exactly one change type is selected
- [ ] Current Ready-to-build or high-assurance approvals are recorded, when applicable
- [ ] Spec, plan slices, and implementation are aligned, when applicable
- [ ] Acceptance criteria verified one by one against the delivered result
- [ ] \`pnpm check && pnpm typecheck && pnpm test && pnpm test:spec-kit\` run locally and green
- [ ] For \`apps/web\` changes: golden path and edge cases exercised in the browser
- [ ] Fresh Codex session reviewed spec fidelity, architecture, security, and tests
- [ ] Every confirmed finding from the fresh-session review resolved or explicitly justified
- [ ] New or changed domain terms reflected in \`CONTEXT.md\`, and relevant ADR added or updated
`
}

export function readyMetadataErrors(body) {
  const errors = []
  const database = checkedItems(section(body, '## Database'))
  if (database.length !== 1 || database[0].startsWith('Not assessed yet')) {
    errors.push('Select exactly one assessed database option in the PR.')
  }
  const checklist = section(body, '## Ready-for-delivery checklist')
  const items = [...checklist.matchAll(/^- \[([ xX])\] (.+)$/gm)]
  if (items.length === 0 || items.some((item) => item[1] === ' ')) {
    errors.push('Complete every item in the PR Ready-for-delivery checklist.')
  }
  return errors
}

function visibleStages(profileName) {
  const profile = DELIVERY_PROFILES[profileName] ?? DELIVERY_PROFILES.standard
  return profile.stages.filter((stage) => stage !== 'done')
}

function stageStatus({ stage, index, currentIndex, state }) {
  if (stage === state.stage) {
    return {
      label: state.blockers.length > 0 ? '⛔ Blocked' : '🔄 In progress',
      evidence: currentEvidence(stage, state),
    }
  }
  if (currentIndex >= 0 && index < currentIndex) {
    return { label: '✅ Done', evidence: completedEvidence(stage, state) }
  }
  if (state.stage === 'done') {
    return { label: '✅ Done', evidence: completedEvidence(stage, state) }
  }
  if (
    [
      'waiting-for-build-approval',
      'waiting-for-spec-approval',
      'waiting-for-plan-approval',
    ].includes(stage)
  ) {
    const gate = gateForStage(stage)
    const approval = state.approvals.find((candidate) => candidate.gate === gate)
    if (approval) {
      return {
        label: '✅ Approved',
        evidence: `@${approval.approvedBy ?? 'reviewer'} on \`${shortSha(approval.commit)}\``,
      }
    }
  }
  return { label: '⏳ Pending', evidence: '—' }
}

function currentEvidence(stage, state) {
  if (stage === 'implementing') {
    return state.progress.total === 0
      ? 'Focused checkpoint'
      : `${state.progress.completed}/${state.progress.total} slices`
  }
  if (stage === 'independent-review') {
    return 'Fresh read-only review required'
  }
  if (stage === 'final-verification') {
    return 'Required checks pending'
  }
  if (stage.startsWith('waiting-for-')) {
    return 'Human approval required'
  }
  return 'Active'
}

function completedEvidence(stage, state) {
  if (stage === 'implementing') {
    return state.progress.total === 0
      ? 'Focused checkpoint'
      : `${state.progress.completed}/${state.progress.total} slices`
  }
  if (stage === 'independent-review') {
    const findings = state.review?.findings ?? []
    return `${findings.length} finding${findings.length === 1 ? '' : 's'}, 0 open`
  }
  if (stage === 'final-verification') {
    return state.checks.evidence?.length
      ? state.checks.evidence.join(', ')
      : 'Required checks passed'
  }
  const gate = gateForStage(stage)
  const approval = state.approvals.find((candidate) => candidate.gate === gate)
  if (approval) {
    return `@${approval.approvedBy ?? 'reviewer'} on \`${shortSha(approval.commit)}\``
  }
  return 'Completed'
}

function renderSlices(state) {
  if (state.progress.slices.length === 0) {
    return ''
  }
  return `
<details>
<summary>Implementation slices (${state.progress.completed}/${state.progress.total})</summary>

${state.progress.slices.map((slice) => `- [${slice.completed ? 'x' : ' '}] \`${slice.id}\` — ${slice.title}`).join('\n')}

</details>
`
}

function renderBlockers(state) {
  if (state.blockers.length === 0) {
    return ''
  }
  return `
### Blockers

${state.blockers.map((blocker) => `- ${blocker.message}`).join('\n')}
`
}

function gateForStage(stage) {
  return {
    'waiting-for-build-approval': 'ready-to-build',
    'waiting-for-spec-approval': 'spec-review',
    'waiting-for-plan-approval': 'plan-review',
  }[stage]
}

function shortSha(value) {
  return value ? String(value).slice(0, 7) : 'unknown'
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function section(markdown, heading) {
  const start = String(markdown).indexOf(heading)
  if (start < 0) {
    return ''
  }
  const content = String(markdown).slice(start + heading.length)
  const nextHeading = content.search(/^## /m)
  return nextHeading < 0 ? content : content.slice(0, nextHeading)
}

function checkedItems(markdown) {
  return [...markdown.matchAll(/^- \[[xX]\] (.+)$/gm)].map((match) => match[1].trim())
}
