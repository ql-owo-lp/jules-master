import net from 'net';
import fs from 'fs';
import { execSync } from 'child_process';

const args = process.argv.slice(2);
const port = args[0] ? parseInt(args[0]) : 3000;
const hosts = ['127.0.0.1', 'localhost'];
const maxRetries = 600; // 10 minutes
const logPath = '/app/frontend.log';
let attempts = 0;

function printLogs() {
    if (fs.existsSync(logPath)) {
        console.log(`\n--- Last 100 lines of ${logPath} ---`);
        try {
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
        console.log(`[Wait] Frontend is up on ${host}:${port} after ${attempts} attempts.`);
        socket.destroy();
        process.exit(0);
    });

    socket.on('error', (err) => {
        socket.destroy();
        if (hostIndex < hosts.length - 1) {
            checkPort(hostIndex + 1);
            return;
        }

        attempts++;
        if (attempts >= maxRetries) {
            console.error(`[Wait] Frontend failed to start on ${port} (tried ${hosts.join(', ')}) after ${attempts} attempts:`, err.message);
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
            console.error(`[Wait] Frontend connection timed out on ${port} after ${attempts} attempts.`);
            printLogs();
            process.exit(1);
        }
        setTimeout(() => checkPort(0), 1000);
    });

    socket.connect(port, host);
}

console.log(`[Wait] Starting wait for frontend on ${port} (trying ${hosts.join(', ')})...`);
checkPort();
