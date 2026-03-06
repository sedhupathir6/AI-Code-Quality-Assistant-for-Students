const filePath = require('path').join(__dirname, 'output.log');
const { spawn } = require('child_process');
const fs = require('fs');

const out = fs.openSync(filePath, 'a');
const err = fs.openSync(filePath, 'a');

const child = spawn('cmd', ['/c', 'npm', 'run', 'dev'], {
    detached: true,
    stdio: ['ignore', out, err]
});

child.unref();
console.log("Spawned vite process, PID: ", child.pid);
