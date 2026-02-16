import net from 'net';
import fs from 'fs';
import { execSync } from 'child_process';

const port = 50051;
const hosts = ['127.0.0.1', 'localhost'];
const maxRetries = 300;
const logPath = '/app/backend.log';
let attempts = 0;

function printLogs() {
    if (fs.existsSync(logPath)) {
        console.log(`\n--- Last 100 lines of ${logPath} ---`);
        try {
            // Try to read the whole file if small, or tail 100
            const logs = execSync(`tail -n 100 ${logPath}`).toString();
            console.log(logs);
        } catch (e) {
            console.error(`Failed to read logs: ${e}`);
        }
        console.log('--- End of Logs ---\n');
    } else {
        console.log(`${logPath} not found.`);
    }
}

function checkPort(hostIndex = 0) {
    const host = hosts[hostIndex];
    const socket = new net.Socket();
    
    socket.setTimeout(1000);
    
    socket.on('connect', () => {
        console.log(`[Wait] Backend is up on ${host}:${port} after ${attempts} attempts.`);
        socket.destroy();
        process.exit(0);
    });
    
    socket.on('error', (err) => {
        socket.destroy();
        if (hostIndex < hosts.length - 1) {
            // Try next host immediately
            checkPort(hostIndex + 1);
            return;
        }

        attempts++;
        if (attempts >= maxRetries) {
            console.error(`[Wait] Backend failed to start on ${port} (tried ${hosts.join(', ')}) after ${attempts} attempts:`, err.message);
            printLogs();
            process.exit(1);
        }
        setTimeout(() => checkPort(0), 1000);
    });
    
    socket.on('timeout', () => {
        socket.destroy();
        if (hostIndex < hosts.length - 1) {
            checkPort(hostIndex + 1);
            return;
        }

        attempts++;
        if (attempts >= maxRetries) {
            console.error(`[Wait] Backend connection timed out on ${port} after ${attempts} attempts.`);
            printLogs();
            process.exit(1);
        }
        setTimeout(() => checkPort(0), 1000);
    });
    
    socket.connect(port, host);
}

console.log(`[Wait] Starting wait for backend on ${port} (trying ${hosts.join(', ')})...`);
checkPort();
