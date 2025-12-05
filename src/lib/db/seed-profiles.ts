
import { db } from './index';
import { profiles, settings, jobs, sessions, cronJobs, predefinedPrompts, historyPrompts, quickReplies, globalPrompt, repoPrompts } from './schema';
import { eq, isNull } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

export async function seedProfiles() {
  console.log('Checking for default profile...');
  // Check if any profile exists
  const existingProfiles = await db.select().from(profiles).limit(1);

  let defaultProfileId: string;

  if (existingProfiles.length === 0) {
    console.log('No profiles found. Creating default profile...');
    defaultProfileId = uuidv4();
    await db.insert(profiles).values({
      id: defaultProfileId,
      name: 'Default',
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    console.log(`Created default profile with ID: ${defaultProfileId}`);
  } else {
    // Check if there is an active profile
    const activeProfiles = await db.select().from(profiles).where(eq(profiles.isActive, true)).limit(1);
    if (activeProfiles.length === 0) {
       console.log('No active profile found. Setting first profile as active...');
       await db.update(profiles).set({ isActive: true }).where(eq(profiles.id, existingProfiles[0].id));
       defaultProfileId = existingProfiles[0].id;
    } else {
       defaultProfileId = activeProfiles[0].id;
       console.log(`Default profile already exists: ${defaultProfileId}`);
    }
  }

  // Now, update all rows with null profileId to the default profile ID
  console.log('Updating orphan records...');

  const tablesWithProfileId = [
    settings,
    jobs,
    cronJobs,
    predefinedPrompts,
    historyPrompts,
    quickReplies,
    globalPrompt,
    repoPrompts,
    sessions
  ];

  for (const table of tablesWithProfileId) {
    // This is a bit tricky because table definitions are different, but we know they all have profileId
    // and we want to update where profileId is null.
    // Drizzle update query builder is strongly typed so iterating like this might be hard if types mismatch.
    // But let's try to do it individually to be safe.
  }

  await db.update(settings).set({ profileId: defaultProfileId }).where(isNull(settings.profileId));
  await db.update(jobs).set({ profileId: defaultProfileId }).where(isNull(jobs.profileId));
  await db.update(cronJobs).set({ profileId: defaultProfileId }).where(isNull(cronJobs.profileId));
  await db.update(predefinedPrompts).set({ profileId: defaultProfileId }).where(isNull(predefinedPrompts.profileId));
  await db.update(historyPrompts).set({ profileId: defaultProfileId }).where(isNull(historyPrompts.profileId));
  await db.update(quickReplies).set({ profileId: defaultProfileId }).where(isNull(quickReplies.profileId));
  await db.update(globalPrompt).set({ profileId: defaultProfileId }).where(isNull(globalPrompt.profileId));
  await db.update(repoPrompts).set({ profileId: defaultProfileId }).where(isNull(repoPrompts.profileId));
  await db.update(sessions).set({ profileId: defaultProfileId }).where(isNull(sessions.profileId));

  console.log('Orphan records updated.');
}

if (require.main === module) {
    seedProfiles().then(() => {
        console.log('Seeding complete.');
        process.exit(0);
    }).catch((err) => {
        console.error('Seeding failed:', err);
        process.exit(1);
    });
}
