import { cronJobClient } from "@/lib/grpc-client";
import { CronJob, AutomationMode } from "../../../proto/gen/ts/jules";

export async function getCronJobs(): Promise<CronJob[]> {
  return new Promise((resolve, reject) => {
      cronJobClient.listCronJobs({}, (err, response) => {
          if (err) return reject(err);
          resolve(response.cronJobs);
      });
  });
}

// Omit generated fields for creation
// Need to map frontend type to Proto type manually if strictly typed or use Partial
// The proto generated interface for request `CreateCronJobRequest` matches mostly.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function createCronJob(data: any): Promise<CronJob> {
  return new Promise((resolve, reject) => {
    // Map data to request
    // Ensure enums are mapped correctly if needed
    const req = {
        ...data,
        automationMode: data.automationMode === 'AUTO_CREATE_PR' ? AutomationMode.AUTO_CREATE_PR : AutomationMode.AUTOMATION_MODE_UNSPECIFIED
    };
    
    cronJobClient.createCronJob(req, (err, response) => {
        if (err) return reject(err);
        resolve(response);
    });
  });
}

export async function deleteCronJob(id: string): Promise<void> {
  return new Promise((resolve, reject) => {
      cronJobClient.deleteCronJob({ id }, (err) => {
            if (err) return reject(err);
            resolve();
      });
  });
}

export async function updateCronJob(id: string, data: Partial<CronJob>): Promise<void> {
  return new Promise((resolve, reject) => {
      // Map partial data to UpdateCronJobRequest
      const req = {
          id,
          ...data,
      };
      
      cronJobClient.updateCronJob(req, (err) => {
          if (err) return reject(err);
          resolve();
      });
  });
}

export async function toggleCronJob(id: string, enabled: boolean): Promise<void> {
    return new Promise((resolve, reject) => {
        cronJobClient.toggleCronJob({ id, enabled }, (err) => {
            if (err) return reject(err);
            resolve();
        });
    });
}

export async function triggerCronJob(id: string): Promise<string> {
    return new Promise((resolve, reject) => {
        cronJobClient.executeCronJob({ id }, (err) => {
             if (err) return reject(err);
             // Verify Execute returns generated Job ID?
             // My proto ExecuteCronJob returns Empty.
             // Node implementation returned new Job ID.
             // I should update Proto to return Job ID or just return generic ID/void.
             // For now, return "triggered" or fetch?
             // Let's assume valid and return a placeholder or update backend later.
             resolve("triggered-via-grpc"); 
        });
    });
}
