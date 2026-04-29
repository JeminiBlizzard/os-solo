/**
 * Inbox Status Transitions
 *
 * Validates status transitions for inbox items.
 * Flow: new → triaged → in_progress → responded/resolved → archived
 * Any status can transition to 'archived'.
 */

export type InboxStatus = 'new' | 'triaged' | 'in_progress' | 'responded' | 'resolved' | 'archived';

/**
 * Valid transitions from each status.
 * Note: 'archived' can be reached from any status.
 */
const VALID_TRANSITIONS: Record<InboxStatus, InboxStatus[]> = {
  new: ['triaged', 'archived'],
  triaged: ['in_progress', 'archived'],
  in_progress: ['responded', 'resolved', 'archived'],
  responded: ['resolved', 'archived'],
  resolved: ['archived'],
  archived: [], // No transitions out of archived
};

/**
 * Check if a status transition is valid.
 *
 * @param from - Current status
 * @param to - Target status
 * @returns true if the transition is valid
 */
export function isValidTransition(from: string, to: string): boolean {
  // Any status can transition to 'archived'
  if (to === 'archived') {
    return true;
  }

  // Check if 'from' is a valid status
  if (!(from in VALID_TRANSITIONS)) {
    return false;
  }

  const validTargets = VALID_TRANSITIONS[from as InboxStatus];
  return validTargets.includes(to as InboxStatus);
}

/**
 * Get valid next statuses for a given status.
 *
 * @param current - Current status
 * @returns Array of valid next statuses
 */
export function getValidNextStatuses(current: string): InboxStatus[] {
  if (!(current in VALID_TRANSITIONS)) {
    return ['archived'];
  }

  return VALID_TRANSITIONS[current as InboxStatus];
}

/**
 * Validate a status transition and return an error message if invalid.
 *
 * @param from - Current status
 * @param to - Target status
 * @returns Error message if invalid, null if valid
 */
export function validateTransition(from: string, to: string): string | null {
  if (isValidTransition(from, to)) {
    return null;
  }

  if (from === 'archived') {
    return `Cannot transition from 'archived' to '${to}'. Items in 'archived' cannot be moved.`;
  }

  const validTargets = getValidNextStatuses(from);
  return `Invalid status transition from '${from}' to '${to}'. Valid targets: ${validTargets.join(', ')}`;
}
