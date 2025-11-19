
import fs from 'fs/promises';
import path from 'path';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import * as schema from '../src/lib/db/schema';
import type { Job, PredefinedPrompt } from '../src/lib/types';

type UserConfig = {
    jobs: Job[];
    predefinedPrompts: PredefinedPrompt[];
    quickReplies: PredefinedPrompt[];
    globalPrompt: string;
};

const configPath = process.env.JULES_MASTER_CONFIG_PATH || path.join(process.cwd(), 'data', 'user-config.json');
const sqlite = new Database('sqlite.db');
const db = drizzle(sqlite, { schema });

async function readConfig(): Promise<UserConfig> {
    try {
        const fileContent = await fs.readFile(configPath, 'utf-8');
        return JSON.parse(fileContent);
    } catch (error) {
        console.error("Error reading config, returning default:", error);
        return {
            jobs: [],
            predefinedPrompts: [],
            quickReplies: [],
            globalPrompt: ''
        };
    }
}

async function migrate() {
    console.log('Starting migration...');
    const config = await readConfig();

    if (config.jobs.length > 0) {
        await db.insert(schema.jobs).values(config.jobs);
        console.log('Migrated jobs.');
    }

    if (config.predefinedPrompts.length > 0) {
        await db.insert(schema.predefinedPrompts).values(config.predefinedPrompts);
        console.log('Migrated predefined prompts.');
    }

    if (config.quickReplies.length > 0) {
        await db.insert(schema.quickReplies).values(config.quickReplies);
        console.log('Migrated quick replies.');
    }

    if (config.globalPrompt) {
        await db.insert(schema.globalPrompt).values({ id: 1, prompt: config.globalPrompt });
        console.log('Migrated global prompt.');
    }

    console.log('Migration complete.');
}

migrate().catch(console.error);
