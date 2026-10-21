import type { Capability, Result, User } from '../domain/types'
import { DomainInputError } from '../domain/calc'
import { UnsupportedStreamError } from '../domain/booking'
import { requestId } from '../lib/ids'
import { AppendConflict } from './eventStore'

/** Authenticated request context. The actor always comes from the session, never from a request field. */
export interface Ctx {
  actor: User | null
}

export class ApiFail extends Error {
  constructor(public code: string, message: string, public status = 422, public fields?: Record<string, string>) {
    super(message)
  }
}

export function requireActor(ctx: Ctx, cap?: Capability): User {
  if (!ctx.actor) throw new ApiFail('UNAUTHENTICATED', 'Sign in to continue.', 401)
  if (cap && !ctx.actor.capabilities.includes(cap)) throw new ApiFail('FORBIDDEN', 'You do not have access to this action.', 403)
  return ctx.actor
}

/** Wraps a service call in the API envelope: { data, request_id } or { error, request_id }. */
export async function handle<T>(fn: () => Promise<T> | T): Promise<Result<T>> {
  const request_id = requestId()
  try {
    return { ok: true, data: await fn(), request_id }
  } catch (e) {
    if (e instanceof ApiFail) return { ok: false, error: { code: e.code, message: e.message, fields: e.fields }, request_id }
    if (e instanceof AppendConflict) return { ok: false, error: { code: e.code, message: e.message }, request_id }
    if (e instanceof DomainInputError) return { ok: false, error: { code: e.code, message: e.message }, request_id }
    if (e instanceof UnsupportedStreamError) return { ok: false, error: { code: 'UNSUPPORTED_STREAM', message: e.message }, request_id }
    console.error(e)
    return { ok: false, error: { code: 'INTERNAL', message: 'Something went wrong. Nothing was committed.' }, request_id }
  }
}
