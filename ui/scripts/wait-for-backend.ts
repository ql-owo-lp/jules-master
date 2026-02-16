import net from 'net';
import fs from 'fs';
import { execSync } from 'child_process';

const port = 50051;
const host = '127.0.0.1';
const maxRetries = 300;
const logPath = '/tmp/backend.log';
let attempts = 0;

function printLogs() {
    if (fs.existsSync(logPath)) {
        console.log(`\n--- Last 20 lines of ${logPath} ---`);
        try {
            const logs = execSync(`tail -n 20 ${logPath}`).toString();
            console.log(logs);
        } catch (e) {
            console.error(`Failed to read logs: ${e}`);
        }
        console.log('--- End of Logs ---\n');
    } else {
        console.log(`${logPath} not found.`);
    }
}

function checkPort() {
    attempts++;
    const socket = new net.Socket();
    
    socket.setTimeout(1000);
    
    socket.on('connect', () => {
        console.log(`[Wait] Backend is up on ${host}:${port} after ${attempts} attempts.`);
        socket.destroy();
        process.exit(0);
    });
    
    socket.on('error', (err) => {
        if (attempts >= maxRetries) {
            console.error(`[Wait] Backend failed to start on ${host}:${port} after ${attempts} attempts:`, err.message);
            printLogs();
            process.exit(1);
        }
        // console.log(`[Wait] Waiting for backend on ${host}:${port}... (Attempt ${attempts}/${maxRetries})`);
        socket.destroy();
        setTimeout(checkPort, 1000);
    });
    
    socket.on('timeout', () => {
        if (attempts >= maxRetries) {
            console.error(`[Wait] Backend connection timed out on ${host}:${port} after ${attempts} attempts.`);
            printLogs();
            process.exit(1);
        }
        socket.destroy();
        setTimeout(checkPort, 1000);
    });
    
    socket.connect(port, host);
}

console.log(`[Wait] Starting wait for backend on ${host}:${port}...`);
checkPort();
