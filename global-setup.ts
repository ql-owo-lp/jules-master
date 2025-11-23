
import { resetMockJobs } from './src/app/config/actions';

async function globalSetup() {
  await resetMockJobs();
}

export default globalSetup;
