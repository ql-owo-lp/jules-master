
import { Profile } from "@/lib/types";

export async function getProfiles(): Promise<Profile[]> {
  const res = await fetch('/api/profiles');
  if (!res.ok) {
    throw new Error('Failed to fetch profiles');
  }
  return res.json();
}

export async function createProfile(name: string): Promise<Profile> {
  const res = await fetch('/api/profiles', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || 'Failed to create profile');
  }
  return res.json();
}

export async function updateProfile(id: string, name: string): Promise<void> {
    const res = await fetch(`/api/profiles/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
    });
    if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to update profile');
    }
}

export async function deleteProfile(id: string): Promise<void> {
    const res = await fetch(`/api/profiles/${id}`, {
        method: 'DELETE',
    });
    if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to delete profile');
    }
}

export async function selectProfile(id: string): Promise<void> {
    const res = await fetch('/api/profiles/select', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
    });
    if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to select profile');
    }
}
