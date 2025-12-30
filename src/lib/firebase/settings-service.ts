import { doc, updateDoc } from 'firebase/firestore';
import { db } from './config';

export async function updateUserSettings(userId: string, settings: { autoSuggestGoals?: boolean }) {
    if (!userId) return;

    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, settings);
}
