import { JobStatus } from '@/types';

export const MAX_GENERATION_ATTEMPTS = 3;

/**
 * Formal transition map enforcing strict finite state machine rules.
 * Disallows arbitrary state jumps from UI components or malicious requests.
 */
export const ALLOWED_JOB_TRANSITIONS: Record<JobStatus, readonly JobStatus[]> = {
  QUEUED: ['GENERATING', 'FAILED'],
  GENERATING: ['VALIDATING', 'FAILED'],
  VALIDATING: ['APPROVED', 'REVIEW_REQUIRED', 'REJECTED', 'FAILED'],
  APPROVED: ['GENERATING'], // Allows explicit user regeneration
  REVIEW_REQUIRED: ['APPROVED', 'GENERATING', 'REJECTED'],
  REJECTED: ['GENERATING'], // Allows retry
  FAILED: ['QUEUED', 'GENERATING'], // Allows retry
};

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
