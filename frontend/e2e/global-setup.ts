import { spawn, ChildProcess } from 'child_process';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitForServer(url: string, maxAttempts = 30): Promise<boolean> {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const response = await fetch(url);
      if (response.ok || response.status === 200) return true;
    } catch {
      // Server not ready yet
    }
    await sleep(1000);
  }
  return false;
}

let wailsProcess: ChildProcess | null = null;

export default async function globalSetup() {
  // Check if server is already running (developer may have it running)
  const serverRunning = await waitForServer('http://localhost:34115', 2);

  if (serverRunning) {
    console.log('Wails dev server already running, using external server');
    process.env.WAILS_EXTERNAL = 'true';
    return;
  }

  console.log('Starting Wails dev server...');

  wailsProcess = spawn('wails', ['dev', '-tags', 'webkit2_41'], {
    cwd: '/home/harshad/projects/traq',
    stdio: 'pipe',
    detached: true,
  });

  // Store PID for teardown
  if (wailsProcess.pid) {
    process.env.WAILS_PID = String(wailsProcess.pid);
  }

  wailsProcess.stdout?.on('data', (data) => {
    const output = data.toString();
    if (process.env.DEBUG) console.log('[wails]', output);
  });

  wailsProcess.stderr?.on('data', (data) => {
    const output = data.toString();
    if (process.env.DEBUG) console.error('[wails:err]', output);
  });

  // Wait for server to be ready (up to 60 seconds for compilation)
  const ready = await waitForServer('http://localhost:34115', 60);

  if (!ready) {
    if (wailsProcess) {
      wailsProcess.kill();
    }
    throw new Error('Wails dev server failed to start within 60 seconds');
  }

  console.log('Wails dev server ready');
}
