"use server";

import {
  collection,
  addDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
} from "firebase/firestore";
import { initializeFirebase } from "@/firebase";
import type { PredefinedPrompt } from "@/lib/types";
import { revalidatePath } from "next/cache";

let db: any;

async function getDb() {
  if (!db) {
    const { firestore } = initializeFirebase();
    db = firestore;
  }
  return db;
}

const promptsCollection = "predefined-prompts";

export async function getPrompts(): Promise<PredefinedPrompt[]> {
  const db = await getDb();
  const promptsSnapshot = await getDocs(collection(db, promptsCollection));
  const prompts: PredefinedPrompt[] = [];
  promptsSnapshot.forEach((doc) => {
    prompts.push({ id: doc.id, ...doc.data() } as PredefinedPrompt);
  });
  return prompts;
}

export async function addPrompt(prompt: Omit<PredefinedPrompt, "id">) {
  const db = await getDb();
  await addDoc(collection(db, promptsCollection), {
    ...prompt,
    createdAt: serverTimestamp(),
  });
  revalidatePath("/prompts");
}

export async function updatePrompt(id: string, prompt: Partial<PredefinedPrompt>) {
  const db = await getDb();
  const promptRef = doc(db, promptsCollection, id);
  await updateDoc(promptRef, prompt);
  revalidatePath("/prompts");
}

export async function deletePrompt(id: string) {
  const db = await getDb();
  await deleteDoc(doc(db, promptsCollection, id));
  revalidatePath("/prompts");
}
