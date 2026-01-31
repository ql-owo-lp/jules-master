
import { db } from '../src/lib/db';
import { jobs, cronJobs, settings, profiles } from '../src/lib/db/schema';
import { listOpenPullRequests, getPullRequest, getPullRequestChecks, getPullRequestCheckStatus } from '../src/lib/github-service';
import { getSettings } from '../src/lib/session-service';
import { eq } from 'drizzle-orm';
import { config } from 'dotenv';
config();

async function verifyPrMonitor() {
    console.log('--- Verifying PR Monitor Logic ---');
    
    // 0. Ensure default profile exists
    try {
        const existingProfile = await db.select().from(profiles).where(eq(profiles.id, 'default')).limit(1);
        if (existingProfile.length === 0) {
            console.log('Seeding default profile...');
            await db.insert(profiles).values({
                id: 'default',
                name: 'Default',
                createdAt: new Date().toISOString()
            });
        }
    } catch (e) {
        console.error('Error seeding profile:', e);
        // Might fail if table doesn't exist, but migration should have fixed that.
    }

    // 1. Check Settings
    const appSettings = await getSettings('default');
    console.log('Settings:', {
        checkFailingActionsEnabled: appSettings.checkFailingActionsEnabled,
        checkFailingActionsInterval: appSettings.checkFailingActionsInterval,
        closePrOnConflictEnabled: appSettings.closePrOnConflictEnabled,
        autoMergeEnabled: appSettings.autoMergeEnabled,
        autoMergeMethod: appSettings.autoMergeMethod,
    });

    if (!process.env.GITHUB_TOKEN) {
        console.error('❌ GITHUB_TOKEN is not set in .env');
        process.exit(1);
    }

    // 2. mocked active repos (or fetch real ones if any)
    const activeJobs = await db.selectDistinct({ repo: jobs.repo }).from(jobs);
    const activeCronJobs = await db.selectDistinct({ repo: cronJobs.repo }).from(cronJobs);
    
    // Allow manual override for testing
    const manualRepo = process.argv[2];
    const uniqueRepos = new Set([
        ...activeJobs.map(j => j.repo),
        ...activeCronJobs.map(j => j.repo),
        manualRepo
    ].filter(Boolean));

    console.log(`Monitoring Repos:`, [...uniqueRepos]);

    if (uniqueRepos.size === 0) {
        console.log('⚠️ No active repositories found in DB. Pass a repo as argument to test: npx tsx scripts/verify-pr-monitor.ts owner/repo');
        process.exit(0);
    }

    for (const repo of uniqueRepos) {
        if (!repo) continue;
        console.log(`\nChecking Repo: ${repo}`);
        
        try {
            const prs = await listOpenPullRequests(repo);
            console.log(`Found ${prs.length} OPEN PRs.`);

            for (const pr of prs) {
                console.log(`  - PR #${pr.number}: ${pr.title}`);
                
                const fullPr = await getPullRequest(repo, pr.number);
                if (!fullPr) {
                    console.log('    ❌ Failed to fetch full PR details');
                    continue;
                }

                console.log(`    Mergeable: ${fullPr.mergeable}, State: ${fullPr.mergeable_state}`);
                
                if (fullPr.mergeable === false) {
                    console.log('    ⚠️ CONFLICT DETECTED! (Would close if enabled)');
                } else {
                    console.log('    ✅ No Conflicts (Mergeable)');
                    if (appSettings.autoMergeEnabled) {
                        const checkStatus = await getPullRequestCheckStatus(repo, fullPr.head.sha);
                        console.log(`    Checks Status: ${checkStatus.status} (Total: ${checkStatus.total})`);
                        if (checkStatus.status === 'success' || (checkStatus.status === 'unknown' && checkStatus.total === 0)) {
                             console.log('    ✅ Eligible for Auto Merge! (Would merge)');
                        } else {
                             console.log('    ℹ️ Not eligible for Auto Merge (Checks not passing)');
                        }
                    } else {
                         console.log('    ℹ️ Auto Merge DISABLED in settings');
                    }
                }

                const checks = await getPullRequestChecks(repo, fullPr.head.sha);
                if (checks.length > 0) {
                    console.log(`    ❌ Failing Checks: ${checks.join(', ')}`);
                } else {
                    console.log('    ✅ Checks Passing (or none)');
                }
            }
        } catch (e) {
            console.error(`Error checking repo ${repo}:`, e);
        }
    }
}

verifyPrMonitor().catch(console.error);
