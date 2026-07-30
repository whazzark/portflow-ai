import fs from 'node:fs'
import path from 'node:path'

const eventPath = process.env.GITHUB_EVENT_PATH

if (!eventPath || !fs.existsSync(eventPath)) {
  process.exit(0)
}

const event = JSON.parse(fs.readFileSync(eventPath, 'utf8'))
const pullRequest = event.pull_request

if (!pullRequest) {
  process.exit(0)
}

const body = pullRequest.body ?? ''
const errors = []
const summary = section(body, '## Summary')
  .replace(/<!--[\s\S]*?-->/g, '')
  .trim()
if (!summary) {
  errors.push('## Summary section must not be empty.')
}

const changeTypeSection = section(body, '## Change type')
const selectedTypes = [...changeTypeSection.matchAll(/^- \[[xX]\] (.+)$/gm)].map((match) =>
  match[1].trim(),
)

if (selectedTypes.length !== 1) {
  errors.push('Select exactly one item in ## Change type.')
}

const reviewGateSection = section(body, '### Current review gate')
const selectedGates = checkedItems(reviewGateSection)
const deliveryProfile = body.match(/^Profile:\s*`(lite|standard|high-assurance)`\s*$/m)?.[1]
const leanWorkflow = body.includes('<!-- portflow:delivery-workflow:start -->')
const currentDeliveryStep = body.match(/^\*\*Current step\*\*:\s*\*\*(.+)\*\*\s*$/m)?.[1]
if (!deliveryProfile && selectedGates.length !== 1) {
  errors.push('Select exactly one item in ### Current review gate.')
}
if (deliveryProfile && !leanWorkflow) {
  errors.push('Delivery PRs must include the managed workflow progress block.')
}

const issueSection = section(body, '## Issue')
if (!/^Issue:\s*#\d+\s*$/m.test(issueSection)) {
  errors.push('## Issue must contain an issue reference such as `Issue: #123`.')
}

const databaseChoices = checkedItems(section(body, '## Database'))
if (databaseChoices.length !== 1) {
  errors.push('## Database section must have exactly one choice selected.')
}

if (!pullRequest.draft) {
  const checklistSection = section(body, '## Ready-for-delivery checklist')
  const checklistItems = [...checklistSection.matchAll(/^- \[([ xX])\] (.+)$/gm)]
  if (checklistItems.length === 0) {
    errors.push('Ready PR must include the ## Ready-for-delivery checklist items.')
  } else if (checklistItems.some((match) => match[1] === ' ')) {
    errors.push(
      'All items in ## Ready-for-delivery checklist must be checked before marking the PR ready.',
    )
  }

  if (databaseChoices.some((choice) => choice.startsWith('Not assessed yet'))) {
    errors.push('Ready PR must state whether it includes a database migration.')
  }
}

const isSpecDriven = selectedTypes.some(
  (type) => type.startsWith('Spec-driven') || type.startsWith('Bug fix'),
)
const selectedGate = selectedGates[0] ?? ''
const specMatch = body.match(/^Spec:\s*`([^`]+)`/m)

if (isSpecDriven) {
  if (deliveryProfile === 'lite') {
    errors.push('Spec-driven behavior changes cannot use the lite delivery profile.')
  }
  if (!deliveryProfile && selectedGate.startsWith('Not applicable')) {
    errors.push('Spec-driven PRs must select a Spec Kit review gate.')
  }
  if (
    !pullRequest.draft &&
    !(
      currentDeliveryStep === 'Delivery review' ||
      (!deliveryProfile && selectedGate === 'Delivery Review')
    )
  ) {
    errors.push('Ready spec-driven PRs must select Delivery Review.')
  }

  if (!specMatch) {
    errors.push('Spec-driven PRs must provide a Spec path in the ## Spec Kit section.')
  } else {
    const specPath = specMatch[1]

    if (
      !specPath.startsWith('specs/') ||
      specPath.includes('..') ||
      !specPath.endsWith('/spec.md')
    ) {
      errors.push(`Invalid Spec path: ${specPath}`)
    } else {
      const specFile = path.resolve(process.cwd(), specPath)

      const specExists = fs.existsSync(specFile)
      if (!specExists) {
        errors.push(`Spec file does not exist: ${specPath}`)
      }

      const requiresPlan =
        (Boolean(deliveryProfile) &&
          !['Specification and plan', 'Spec review'].includes(currentDeliveryStep)) ||
        selectedGate === 'Plan Review' ||
        selectedGate === 'Delivery Review'
      const requiresCompletedDelivery =
        currentDeliveryStep === 'Delivery review' ||
        selectedGate === 'Delivery Review' ||
        !pullRequest.draft

      if ((requiresPlan || requiresCompletedDelivery) && specExists) {
        const featureDir = path.dirname(specFile)
        const planFile = path.join(featureDir, 'plan.md')
        const tasksFile = path.join(featureDir, 'tasks.md')

        if (!fs.existsSync(planFile)) {
          errors.push(
            `${selectedGate || 'Ready PR'} is missing ${path.relative(process.cwd(), planFile)}.`,
          )
        }
        if (!deliveryProfile && requiresCompletedDelivery && !fs.existsSync(tasksFile)) {
          errors.push(
            `${selectedGate || 'Ready PR'} is missing ${path.relative(process.cwd(), tasksFile)}.`,
          )
        }

        const spec = fs.readFileSync(specFile, 'utf8')
        const tasks = fs.existsSync(tasksFile) ? fs.readFileSync(tasksFile, 'utf8') : ''
        const plan = fs.existsSync(planFile) ? fs.readFileSync(planFile, 'utf8') : ''

        if (deliveryProfile && plan) {
          const slices = implementationSlices(plan)
          if (slices.length < 5 || slices.length > 15) {
            errors.push(
              `${selectedGate || 'Delivery'} plan must contain 5–15 implementation slices.`,
            )
          }
        }

        if (/\[NEEDS CLARIFICATION:/i.test(spec)) {
          errors.push(`${selectedGate || 'Ready PR'} spec still contains [NEEDS CLARIFICATION].`)
        }

        if (
          requiresCompletedDelivery &&
          (deliveryProfile ? implementationSlicesIncomplete(plan) : /^- \[ \]/m.test(tasks))
        ) {
          errors.push(`${selectedGate || 'Ready PR'} tasks.md still contains unchecked tasks.`)
        }
      }
    }
  }
} else {
  if (deliveryProfile && deliveryProfile !== 'lite') {
    errors.push('Workflow, documentation, and tooling PRs must use the lite delivery profile.')
  }
  if (!deliveryProfile && !selectedGate.startsWith('Not applicable')) {
    errors.push('Non-spec PRs must select the not-applicable review gate.')
  }
  if (specMatch?.[1] !== 'N/A') {
    errors.push('Non-spec PRs must use `Spec: `N/A``.')
  }
}

if (errors.length > 0) {
  for (const error of errors) {
    process.stderr.write(`::error::${error}\n`)
  }
  process.exit(1)
}

process.stdout.write(
  `Spec Kit PR metadata is valid (${pullRequest.draft ? 'draft' : 'ready'} PR).\n`,
)

function section(markdown, heading) {
  const start = markdown.indexOf(heading)
  if (start === -1) {
    return ''
  }

  const content = markdown.slice(start + heading.length)
  const nextHeading = content.search(/^## /m)

  return nextHeading === -1 ? content : content.slice(0, nextHeading)
}

function checkedItems(markdown) {
  return [...markdown.matchAll(/^- \[[xX]\] (.+)$/gm)].map((match) => match[1].trim())
}

function implementationSlicesIncomplete(plan) {
  return implementationSlices(plan).some((slice) => !slice.completed)
}

function implementationSlices(plan) {
  const match = plan.match(/^##\s+Implementation Slices\s*$([\s\S]*?)(?=^##\s|(?![\s\S]))/im)
  if (!match) {
    return []
  }
  return [...match[1].matchAll(/^- \[([ xX])\]\s+.+$/gm)].map((item) => ({
    completed: item[1].toLowerCase() === 'x',
  }))
}
