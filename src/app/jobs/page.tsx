
import { Suspense } from 'react';
import { getJobs } from "@/app/config/actions";
import { JobList } from "@/components/job-list";

async function JobsPageContent() {
  const jobs = await getJobs();

  return (
    <div className="flex flex-col flex-1 bg-background">
      <main className="flex-1 overflow-auto p-4 sm:p-6 md:p-8">
        <div className="space-y-8 px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold">Jobs</h1>
          </div>
          <JobList jobs={jobs} />
        </div>
      </main>
    </div>
  );
}

export default function JobsPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <JobsPageContent />
    </Suspense>
  )
}
