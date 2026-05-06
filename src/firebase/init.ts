
'use client';

import { firebaseConfig } from '@/firebase/config';
import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, initializeFirestore } from 'firebase/firestore';
import { getFunctions } from 'firebase/functions';
import { getStorage } from 'firebase/storage';

/**
 * Initializes the Firebase app and core SDKs.
 * This function handles idempotent initialization and configures Firestore for compatibility.
 */
export function initializeFirebase() {
  const apps = getApps();
  if (!apps.length) {
    // Important! initializeApp() is called without any arguments because Firebase App Hosting
    // integrates with the initializeApp() function to provide the environment variables needed to
    // populate the FirebaseOptions in production. It is critical that we attempt to call initializeApp()
    // without arguments.
    let firebaseApp;
    try {
      // Attempt to initialize via Firebase App Hosting environment variables
      firebaseApp = initializeApp();
    } catch (e) {
      // Only warn in production because it's normal to use the firebaseConfig to initialize
      // during development
      if (process.env.NODE_ENV === "production") {
        console.warn('Automatic initialization failed. Falling back to firebase config object.', e);
      }
      firebaseApp = initializeApp(firebaseConfig);
    }

    // Force long-polling to resolve connectivity issues in certain network environments (like cloud workstations or behind proxies).
    // This must be called before any other Firestore operations.
    initializeFirestore(firebaseApp, {
      experimentalForceLongPolling: true,
    });

    return getSdks(firebaseApp);
  }

  // If already initialized, return the SDKs with the existing App instance.
  return getSdks(apps[0]);
}

/**
 * Provides access to initialized Firebase service instances.
 */
export function getSdks(firebaseApp: FirebaseApp) {
  return {
    firebaseApp,
    auth: getAuth(firebaseApp),
    firestore: getFirestore(firebaseApp),
    functions: getFunctions(firebaseApp, 'us-central1'),
    storage: getStorage(firebaseApp),
  };
}
