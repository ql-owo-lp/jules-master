
import { execSync } from 'child_process';

async function globalSetup() {
  execSync('npm run db:migrate');
}

export default globalSetup;
