export default async function globalTeardown() {
  if (process.env.WAILS_EXTERNAL === 'true') {
    console.log('Using external Wails server, skipping teardown');
    return;
  }

  const pid = process.env.WAILS_PID;
  if (pid) {
    console.log('Stopping Wails dev server...');
    try {
      // Kill process group (negative PID kills the group)
      process.kill(-Number(pid), 'SIGTERM');
    } catch {
      // Process may already be dead
    }
  }
}
