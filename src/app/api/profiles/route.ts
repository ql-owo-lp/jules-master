
import { db } from "@/lib/db";
import { profiles } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import type { Profile } from "@/lib/types";

export async function GET() {
  try {
    const allProfiles = await db.select().from(profiles);
    return NextResponse.json(allProfiles);
  } catch (error) {
    console.error("Failed to fetch profiles:", error);
    return NextResponse.json({ error: "Failed to fetch profiles" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { name, settings } = await request.json();
    const newProfile: Profile = {
      id: crypto.randomUUID(),
      name,
      settings,
      isActive: false,
    };
    await db.insert(profiles).values(newProfile);
    return NextResponse.json(newProfile, { status: 201 });
  } catch (error) {
    console.error("Failed to create profile:", error);
    return NextResponse.json({ error: "Failed to create profile" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const { id, ...data } = await request.json();
    await db.update(profiles).set(data).where(eq(profiles.id, id));
    return NextResponse.json({ message: "Profile updated" });
  } catch (error) {
    console.error("Failed to update profile:", error);
    return NextResponse.json({ error: "Failed to update profile" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { id } = await request.json();
    await db.delete(profiles).where(eq(profiles.id, id));
    return NextResponse.json({ message: "Profile deleted" });
  } catch (error) {
    console.error("Failed to delete profile:", error);
    return NextResponse.json({ error: "Failed to delete profile" }, { status: 500 });
  }
}
