
import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '@/lib/db';
import { profiles, settings } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { GET, POST } from '@/app/api/profiles/route';
import { PUT, DELETE } from '@/app/api/profiles/[id]/route';
import { NextRequest } from 'next/server';

describe('Profiles API', () => {
    beforeEach(async () => {
        // Reset the database
        await db.delete(settings).run();
        await db.delete(profiles).run();
    });

  it('should create a default profile if none exist', async () => {
    const response = await GET();
    const data = await response.json();
    expect(response.status).toBe(200);
    expect(data).toHaveLength(1);
    expect(data[0].name).toBe('Default');
    expect(data[0].isActive).toBe(true);
  });

  it('should create a new profile', async () => {
    await GET(); // Ensure default profile exists
    const req = new NextRequest('http://localhost/api/profiles', {
        method: 'POST',
        body: JSON.stringify({ name: 'Test Profile' }),
    });
    const response = await POST(req);
    const data = await response.json();
    expect(response.status).toBe(200);
    expect(data.name).toBe('Test Profile');

    const allProfiles = await db.select().from(profiles).all();
    expect(allProfiles).toHaveLength(2);
  });

  it('should rename a profile', async () => {
    await GET(); // Ensure default profile exists
    const createReq = new NextRequest('http://localhost/api/profiles', {
        method: 'POST',
        body: JSON.stringify({ name: 'Test Profile' }),
    });
    await POST(createReq);

    const allProfiles = await db.select().from(profiles).all();
    const profileToUpdate = allProfiles.find(p => p.name === 'Test Profile');

    const req = new NextRequest(`http://localhost/api/profiles/${profileToUpdate.id}`, {
        method: 'PUT',
        body: JSON.stringify({ name: 'Renamed Profile' }),
    });

    const response = await PUT(req, { params: { id: profileToUpdate.id.toString() } });
    const data = await response.json();
    expect(response.status).toBe(200);
    expect(data.name).toBe('Renamed Profile');
  });

  it('should set a profile as active', async () => {
    await GET(); // Ensure default profile exists
    const createReq = new NextRequest('http://localhost/api/profiles', {
        method: 'POST',
        body: JSON.stringify({ name: 'Test Profile' }),
    });
    await POST(createReq);

    const allProfiles = await db.select().from(profiles).all();
    const profileToActivate = allProfiles.find(p => p.name === 'Test Profile');

    const req = new NextRequest(`http://localhost/api/profiles/${profileToActivate.id}`, {
        method: 'PUT',
        body: JSON.stringify({ isActive: true }),
    });

    await PUT(req, { params: { id: profileToActivate.id.toString() } });

    const updatedProfiles = await db.select().from(profiles).all();
    const activeProfile = updatedProfiles.find(p => p.isActive);
    expect(activeProfile.id).toBe(profileToActivate.id);
  });


  it('should not delete the last profile', async () => {
    await GET(); // Ensure default profile exists
    const lastProfile = await db.select().from(profiles).limit(1).all();
    const lastDeleteReq = new NextRequest(`http://localhost/api/profiles/${lastProfile[0].id}`, {
        method: 'DELETE',
    });
    const response = await DELETE(lastDeleteReq, { params: { id: lastProfile[0].id.toString() } });
    expect(response.status).toBe(400);
  });
});
