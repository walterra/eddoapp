/**
 * Port availability checker for test setup
 */
import net from 'net';

export async function checkPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();
    
    server.once('error', (err: any) => {
      if (err.code === 'EADDRINUSE') {
        resolve(false);
      } else {
        resolve(false);
      }
    });
    
    server.once('listening', () => {
      server.close();
      resolve(true);
    });
    
    server.listen(port);
  });
}

export async function ensurePortAvailable(port: number): Promise<void> {
  const isAvailable = await checkPortAvailable(port);
  
  if (!isAvailable) {
    throw new Error(
      `Port ${port} is already in use. ` +
      `Please stop any running MCP servers before running tests.\n` +
      `You can check what's using the port with: lsof -i :${port}\n` +
      `If you have a lingering test server, you can stop it manually.`
    );
  }
}