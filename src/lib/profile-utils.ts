
import { db } from '@/lib/db';
import { profiles, settings } from '@/lib/db/schema';
import { eq, isNull } from 'drizzle-orm';

export async function ensureDefaultProfile() {
    // Check if any profile exists
    const existingProfiles = await db.select().from(profiles).limit(1);

    if (existingProfiles.length > 0) {
        // Check if any profile is selected
        const selectedProfile = await db.select().from(profiles).where(eq(profiles.isSelected, true)).limit(1);
        if (selectedProfile.length === 0) {
             // If no profile is selected (shouldn't happen in normal flow but possible), select the first one (usually Default)
             // or the one named 'Default'
             const defaultNamed = await db.select().from(profiles).where(eq(profiles.name, 'Default')).limit(1);
             if (defaultNamed.length > 0) {
                 await db.update(profiles).set({ isSelected: true }).where(eq(profiles.id, defaultNamed[0].id));
                 return defaultNamed[0];
             } else {
                 // Select the first one found
                 await db.update(profiles).set({ isSelected: true }).where(eq(profiles.id, existingProfiles[0].id));
                 return existingProfiles[0];
             }
        }
        return selectedProfile[0];
    }

    // No profiles exist. Create "Default" profile.
    console.log("Initializing Default Profile...");
    const defaultProfileId = crypto.randomUUID();
    const newProfile = {
        id: defaultProfileId,
        name: 'Default',
        isSelected: true,
        createdAt: new Date().toISOString(),
    };

    await db.insert(profiles).values(newProfile);

    // Check for existing settings (legacy rows with NULL profileId)
    const existingSettings = await db.select().from(settings).where(isNull(settings.profileId)).limit(1);

    if (existingSettings.length > 0) {
        console.log("Migrating existing settings to Default Profile...");
        // Link existing settings to the new profile
        await db.update(settings)
            .set({ profileId: defaultProfileId })
            .where(eq(settings.id, existingSettings[0].id));
    } else {
        // No settings exist, create default settings for this profile
        // Wait, if no settings exist, the app usually returns defaults in GET.
        // We should explicitly create the row so subsequent updates work fine.
        console.log("Creating default settings for Default Profile...");
        await db.insert(settings).values({
            profileId: defaultProfileId,
            idlePollInterval: 120,
            activePollInterval: 30,
            titleTruncateLength: 50,
            lineClamp: 1,
            sessionItemsPerPage: 10,
            jobsPerPage: 5,
            defaultSessionCount: 10,
            prStatusPollInterval: 60,
            theme: 'system',
            historyPromptsCount: 10,
            autoApprovalInterval: 60,
            autoRetryEnabled: true,
            autoRetryMessage: "You have been doing a great job. Let’s try another approach to see if we can achieve the same goal. Do not stop until you find a solution",
            autoContinueEnabled: true,
            autoContinueMessage: "Sounds good. Now go ahead finish the work",
            sessionCacheInProgressInterval: 60,
            sessionCacheCompletedNoPrInterval: 1800,
            sessionCachePendingApprovalInterval: 300,
            sessionCacheMaxAgeDays: 3,
            autoDeleteStaleBranches: false,
            autoDeleteStaleBranchesAfterDays: 3,
        });
    }

    return newProfile;
}
