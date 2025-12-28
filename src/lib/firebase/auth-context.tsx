'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import {
    User,
    onAuthStateChanged,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signInWithPopup,
    GoogleAuthProvider,
    signOut as firebaseSignOut,
    updateProfile,
} from 'firebase/auth';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db, isFirebaseConfigured } from './config';
import { UserProfile } from '@/types/firestore';
import { createDefaultAccounts } from './accounts-service';

interface AuthContextType {
    user: User | null;
    userProfile: UserProfile | null;
    loading: boolean;
    signInWithEmail: (email: string, password: string) => Promise<void>;
    signUpWithEmail: (email: string, password: string, displayName: string) => Promise<void>;
    signInWithGoogle: () => Promise<void>;
    signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const googleProvider = new GoogleAuthProvider();

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
    const [loading, setLoading] = useState(true);

    // Create or update user profile in Firestore
    const ensureUserProfile = async (user: User): Promise<UserProfile | null> => {
        if (!isFirebaseConfigured) return null;

        try {
            const userRef = doc(db, 'users', user.uid);
            const userSnap = await getDoc(userRef);

            if (!userSnap.exists()) {
                const profile: Omit<UserProfile, 'createdAt'> & { createdAt: ReturnType<typeof serverTimestamp> } = {
                    uid: user.uid,
                    email: user.email || '',
                    displayName: user.displayName || 'User',
                    photoURL: user.photoURL || null,
                    defaultCurrency: 'EUR',
                    createdAt: serverTimestamp(),
                };
                await setDoc(userRef, profile);

                // Create default accounts for new user
                try {
                    await createDefaultAccounts(user.uid);
                } catch (e) {
                    console.error('Error creating default accounts:', e);
                }

                return profile as unknown as UserProfile;
            }

            return userSnap.data() as UserProfile;
        } catch (error) {
            console.error('Error ensuring user profile:', error);
            return null;
        }
    };

    useEffect(() => {
        // If Firebase isn't configured, just set loading to false and don't try to listen
        if (!isFirebaseConfigured) {
            setLoading(false);
            return;
        }

        try {
            const unsubscribe = onAuthStateChanged(auth, async (user) => {
                setUser(user);
                if (user) {
                    const profile = await ensureUserProfile(user);
                    setUserProfile(profile);
                } else {
                    setUserProfile(null);
                }
                setLoading(false);
            }, (error) => {
                console.error('Auth state change error:', error);
                setLoading(false);
            });

            return () => unsubscribe();
        } catch (error) {
            console.error('Error setting up auth listener:', error);
            setLoading(false);
        }
    }, []);

    const signInWithEmail = async (email: string, password: string) => {
        await signInWithEmailAndPassword(auth, email, password);
    };

    const signUpWithEmail = async (email: string, password: string, displayName: string) => {
        const credential = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(credential.user, { displayName });
    };

    const signInWithGoogle = async () => {
        await signInWithPopup(auth, googleProvider);
    };

    const signOut = async () => {
        await firebaseSignOut(auth);
        setUserProfile(null);
    };

    return (
        <AuthContext.Provider
            value={{
                user,
                userProfile,
                loading,
                signInWithEmail,
                signUpWithEmail,
                signInWithGoogle,
                signOut,
            }}
        >
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}
