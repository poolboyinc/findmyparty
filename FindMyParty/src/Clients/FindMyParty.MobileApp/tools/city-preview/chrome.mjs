// A tiny driver for headless Chrome over its debugging protocol. No dependencies: Node 22+ has WebSocket.
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const CHROME = process.env.CHROME ?? 'google-chrome';

async function waitFor(fn, ms = 15000, step = 100) {
  const end = Date.now() + ms;
  for (;;) {
    try {
      const value = await fn();
      if (value) return value;
    } catch {
      // Not up yet.
    }
    if (Date.now() > end) throw new Error('Timed out waiting for Chrome');
    await new Promise((resolve) => setTimeout(resolve, step));
  }
}

/** Starts Chrome with a phone-sized window and returns a page you can drive. */
export async function openPage({ width = 393, height = 852, scale = 2, port = 9333 } = {}) {
  const profile = mkdtempSync(join(tmpdir(), 'city-preview-'));
  const chrome = spawn(
    CHROME,
    [
      '--headless=new',
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${profile}`,
      `--window-size=${width},${height}`,
      `--force-device-scale-factor=${scale}`,
      '--use-angle=swiftshader',
      '--enable-unsafe-swiftshader',
      '--ignore-gpu-blocklist',
      '--hide-scrollbars',
      '--no-first-run',
      'about:blank',
    ],
    { stdio: 'ignore' },
  );

  const target = await waitFor(async () => {
    const list = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
    return list.find((entry) => entry.type === 'page');
  });
  const socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true });
    socket.addEventListener('error', reject, { once: true });
  });

  let nextId = 1;
  const waiting = new Map();
  const logs = [];
  socket.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);
    if (message.id && waiting.has(message.id)) {
      const { resolve, reject } = waiting.get(message.id);
      waiting.delete(message.id);
      if (message.error) reject(new Error(message.error.message));
      else resolve(message.result);
    } else if (message.method === 'Runtime.consoleAPICalled') {
      logs.push(`[${message.params.type}] ${message.params.args.map((a) => a.value ?? a.description ?? '').join(' ')}`);
    } else if (message.method === 'Runtime.exceptionThrown') {
      logs.push(`[exception] ${message.params.exceptionDetails.exception?.description ?? message.params.exceptionDetails.text}`);
    }
  });
  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const id = nextId++;
      waiting.set(id, { resolve, reject });
      socket.send(JSON.stringify({ id, method, params }));
    });

  await send('Runtime.enable');
  await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: scale, mobile: true });

  return {
    logs,
    async goto(url) {
      await send('Page.navigate', { url });
    },
    /** Runs an expression in the page (awaits promises) and returns its JSON value. */
    async run(expression) {
      const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
      if (result.exceptionDetails) {
        throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text);
      }
      return result.result.value;
    },
    async screenshot(file) {
      const { data } = await send('Page.captureScreenshot', { format: 'png' });
      writeFileSync(file, Buffer.from(data, 'base64'));
    },
    async close() {
      try {
        socket.close();
      } catch {
        // Already closed.
      }
      chrome.kill();
      await new Promise((resolve) => setTimeout(resolve, 300));
      rmSync(profile, { recursive: true, force: true });
    },
  };
}
