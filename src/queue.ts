import { db, nowMs } from "./db.js";
import { JOB_TIMEOUT_MS, QUEUE_MAX_SIZE } from "./config.js";
import { logger } from "./logger.js";

export class QueueFullError extends Error {
  constructor() {
    super("queue is full");
  }
}
export class UserBusyError extends Error {
  constructor() {
    super("user already has an active job");
  }
}
export class DuplicateJobError extends Error {
  constructor() {
    super("duplicate job");
  }
}

export interface JobContext {
  userId: number;
  jobKey: string;
  signal: AbortSignal;
}

interface QueuedJob<T> {
  ctx: JobContext;
  run: (ctx: JobContext) => Promise<T>;
  resolve: (v: T) => void;
  reject: (e: unknown) => void;
  controller: AbortController;
}

const activeUsers = new Set<number>();
const pending: QueuedJob<unknown>[] = [];
/** key -> ms epoch when it entered the inflight set; lets us evict stuck jobs. */
const inflight = new Map<string, number>();
let killed = false;
let processing = false;

export interface QueueStats {
  pending: number;
  active: number;
  inflight: string[];
  killed: boolean;
}

export function queueStats(): QueueStats {
  return {
    pending: pending.length,
    active: activeUsers.size,
    inflight: Array.from(inflight.keys()),
    killed,
  };
}

/** True if a job_key is currently being processed (or queued). */
export function isInflight(jobKey: string): boolean {
  return inflight.has(jobKey);
}

/**
 * Periodically evict any inflight entry that has been parked there longer than
 * 3x the per-job timeout. The `finally` block in `runOne` already clears
 * inflight on the happy path; this is a defensive sweep so a thrown timer or
 * crashed handler can't leave a key permanently stuck and block legitimate
 * resubmissions.
 */
const STUCK_TIMEOUT_MS = JOB_TIMEOUT_MS * 3;
setInterval(() => {
  const now = Date.now();
  let evicted = 0;
  for (const [key, started] of inflight.entries()) {
    if (now - started > STUCK_TIMEOUT_MS) {
      inflight.delete(key);
      evicted++;
    }
  }
  if (evicted > 0) {
    logger.warn({ evicted }, "stuck inflight job(s) evicted");
  }
}, 30_000).unref();

export function killQueue(): { dropped: number } {
  killed = true;
  const dropped = pending.length;
  while (pending.length) {
    const job = pending.shift()!;
    job.controller.abort();
    inflight.delete(job.ctx.jobKey);
    db.prepare("DELETE FROM processed_jobs WHERE job_key = ?").run(job.ctx.jobKey);
    job.reject(new Error("queue killed"));
  }
  return { dropped };
}

export function resetQueue(): void {
  killed = false;
  activeUsers.clear();
  inflight.clear();
  while (pending.length) {
    const job = pending.shift()!;
    job.controller.abort();
    db.prepare("DELETE FROM processed_jobs WHERE job_key = ?").run(job.ctx.jobKey);
    job.reject(new Error("queue reset"));
  }
  processing = false;
  db.prepare("DELETE FROM processed_jobs").run();
}

function rememberJob(jobKey: string, userId: number): boolean {
  try {
    db.prepare(
      "INSERT INTO processed_jobs(job_key, user_id, timestamp) VALUES(?, ?, ?)",
    ).run(jobKey, userId, nowMs());
    return true;
  } catch {
    return false;
  }
}

export async function submit<T>(
  ctx: Omit<JobContext, "signal">,
  run: (jc: JobContext) => Promise<T>,
): Promise<T> {
  if (killed) throw new Error("queue is currently killed");

  if (activeUsers.has(ctx.userId)) throw new UserBusyError();
  if (inflight.has(ctx.jobKey)) throw new DuplicateJobError();
  if (pending.length >= QUEUE_MAX_SIZE) throw new QueueFullError();
  if (!rememberJob(ctx.jobKey, ctx.userId)) throw new DuplicateJobError();

  return new Promise<T>((resolve, reject) => {
    const ac = new AbortController();
    const fullCtx: JobContext = { ...ctx, signal: ac.signal };
    inflight.set(ctx.jobKey, Date.now());

    const job: QueuedJob<T> = {
      ctx: fullCtx,
      run,
      resolve,
      reject,
      controller: ac,
    };
    pending.push(job as QueuedJob<unknown>);

    setImmediate(drain);
  });
}

async function drain(): Promise<void> {
  if (processing) return;
  processing = true;
  try {
    while (pending.length) {
      if (killed) return;
      const job = pending.shift()!;
      await runOne(job).catch(() => {});
    }
  } finally {
    processing = false;
  }
}

async function runOne(job: QueuedJob<unknown>): Promise<void> {
  const { ctx, run, resolve, reject } = job;
  if (activeUsers.has(ctx.userId)) {
    inflight.delete(ctx.jobKey);
    reject(new UserBusyError());
    return;
  }
  activeUsers.add(ctx.userId);

  const ac = job.controller;
  const linkedCtx: JobContext = { ...ctx, signal: ac.signal };

  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    ac.abort();
  }, JOB_TIMEOUT_MS);

  try {
    // Do not race the worker against the timeout. Abort the worker at the
    // deadline, then wait for it to actually unwind before releasing the
    // user's active-job lock. This prevents timed-out image work from
    // continuing while the queue accepts another job for the same user.
    const result = await run(linkedCtx);
    if (timedOut) {
      throw new Error("job timeout");
    }
    resolve(result);
  } catch (err) {
    db.prepare("DELETE FROM processed_jobs WHERE job_key = ?").run(ctx.jobKey);
    logger.warn(
      { err, userId: ctx.userId, jobKey: ctx.jobKey, timedOut },
      "job failed",
    );
    reject(err);
  } finally {
    clearTimeout(timer);
    inflight.delete(ctx.jobKey);
    activeUsers.delete(ctx.userId);
  }
}
