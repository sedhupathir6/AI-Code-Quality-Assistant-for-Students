const { execSync } = require('child_process');
try {
    const result = execSync('npm config list', { encoding: 'utf8', stdio: 'pipe' });
    console.log("SUCCESS:");
    console.log(result);
} catch (e) {
    console.error("ERROR:");
    console.error(e.stdout);
    console.error(e.stderr);
}
