import { spawn } from 'node:child_process';

function appendBounded(chunks, chunk, state, maximum) {
  const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
  const remaining = Math.max(0, maximum - state.bytes);
  if (remaining > 0) chunks.push(buffer.subarray(0, remaining));
  state.bytes += buffer.length;
  if (state.bytes > maximum) state.truncated = true;
}

function terminate(child) {
  if (!child.pid) return;
  try {
    if (process.platform !== 'win32') {
      process.kill(-child.pid, 'SIGTERM');
    } else {
      const killer = spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], {
        windowsHide: true,
        stdio: 'ignore'
      });
      killer.on('error', () => child.kill('SIGTERM'));
      killer.unref();
    }
  } catch {
    // The process may already have exited.
  }
}

export function runCommand(command, options) {
  const started = Date.now();
  const maximum = options.maxOutputBytes;

  return new Promise((resolve) => {
    const stdout = [];
    const stderr = [];
    const stdoutState = { bytes: 0, truncated: false };
    const stderrState = { bytes: 0, truncated: false };
    let timedOut = false;
    let spawnError = null;

    const child = spawn(command, {
      cwd: options.cwd,
      env: { ...process.env, CI: 'true', RULETRIP: '1', ...options.env },
      shell: true,
      windowsHide: true,
      detached: process.platform !== 'win32',
      stdio: ['ignore', 'pipe', 'pipe']
    });

    child.stdout.on('data', (chunk) => appendBounded(stdout, chunk, stdoutState, maximum));
    child.stderr.on('data', (chunk) => appendBounded(stderr, chunk, stderrState, maximum));
    child.on('error', (error) => {
      spawnError = error;
    });

    const timer = setTimeout(() => {
      timedOut = true;
      terminate(child);
      setTimeout(() => {
        try {
          if (process.platform !== 'win32' && child.pid) process.kill(-child.pid, 'SIGKILL');
          else child.kill('SIGKILL');
        } catch {
          // The process exited after SIGTERM.
        }
      }, 1_000).unref();
    }, options.timeoutMs);

    child.on('close', (code, signal) => {
      clearTimeout(timer);
      resolve({
        code,
        signal,
        timedOut,
        spawnError: spawnError?.message ?? null,
        durationMs: Date.now() - started,
        stdout: Buffer.concat(stdout).toString('utf8'),
        stderr: Buffer.concat(stderr).toString('utf8'),
        stdoutTruncated: stdoutState.truncated,
        stderrTruncated: stderrState.truncated
      });
    });
  });
}
