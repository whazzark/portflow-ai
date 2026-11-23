import { toast } from 'sonner'

/**
 * Copies `text` and says so — or says it could not, since a browser may refuse or lack a clipboard
 * and claiming a copy that did not happen would leave the user pasting something else. `label`
 * names what was copied, e.g. `Coordinates`.
 */
export async function copyText(text: string, label: string) {
  try {
    if (!navigator.clipboard) {
      throw new Error('Clipboard unavailable')
    }
    await navigator.clipboard.writeText(text)
    toast.success(`${label} copied`)
    return true
  } catch {
    toast.error(`${label} could not be copied`)
    return false
  }
}
