import { JobStatus } from '@/types';

export const MAX_GENERATION_ATTEMPTS = 3;

/**
 * Formal transition map enforcing strict finite state machine rules.
 * Disallows arbitrary state jumps from UI components or malicious requests.
 */
export const ALLOWED_JOB_TRANSITIONS: Record<JobStatus, readonly JobStatus[]> = {
  QUEUED: ['GENERATING', 'PROCESSING', 'FAILED', 'CANCELLED'],
  PENDING: ['QUEUED', 'GENERATING', 'PROCESSING', 'FAILED', 'CANCELLED'],
  PROCESSING: ['VALIDATING', 'FAILED', 'CANCELLED'],
  GENERATING: ['VALIDATING', 'FAILED', 'CANCELLED'],
  VALIDATING: ['APPROVED', 'COMPLETED', 'REVIEW_REQUIRED', 'REJECTED', 'PARTIAL', 'FAILED'],
  APPROVED: ['FAILED', 'COMPLETED'], // Post-approval errors must reach FAILED
  COMPLETED: [], // Terminal
  PARTIAL: ['QUEUED', 'GENERATING', 'PROCESSING', 'FAILED'],
  REVIEW_REQUIRED: ['APPROVED', 'COMPLETED', 'GENERATING', 'PROCESSING', 'REJECTED', 'FAILED'],
  REJECTED: ['QUEUED', 'GENERATING', 'PROCESSING', 'FAILED'],
  FAILED: [], // Terminal! No outgoing transitions allowed
  CANCELLED: [], // Terminal! No outgoing transitions allowed
};

export const TERMINAL_JOB_STATUSES: readonly JobStatus[] = ['COMPLETED', 'FAILED', 'CANCELLED'] as const;

export function isTerminalJobStatus(status: JobStatus): boolean {
  return TERMINAL_JOB_STATUSES.includes(status);
}

export class JobStateTransitionError extends Error {
  constructor(current: JobStatus, target: JobStatus) {
    super(`Transición inválida de estado en GenerationJob: de '${current}' a '${target}'.`);
    this.name = 'JobStateTransitionError';
  }
}

/**
 * Validates and applies a state transition to a GenerationJob status.
 * Throws JobStateTransitionError if the requested transition is illegal.
 */
export function transitionJobState(current: JobStatus, target: JobStatus): JobStatus {
  const allowed = ALLOWED_JOB_TRANSITIONS[current];
  if (!allowed || !allowed.includes(target)) {
    throw new JobStateTransitionError(current, target);
  }
  return target;
}

/**
 * Checks if a job has exceeded the maximum permitted regeneration attempts.
 */
export function canAttemptRegeneration(attempts: number): boolean {
  return attempts < MAX_GENERATION_ATTEMPTS;
}
