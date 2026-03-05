'use client';

import { useState, useEffect } from 'react';
import {
  Query,
  onSnapshot,
  DocumentData,
  FirestoreError,
  QuerySnapshot,
  CollectionReference,
} from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

export type WithId<T> = T & { id: string };

export interface UseCollectionResult<T> {
  data: WithId<T>[] | null;
  isLoading: boolean;
  error: FirestoreError | Error | null;
}

export interface InternalQuery extends Query<DocumentData> {
  _query: {
    path: {
      canonicalString(): string;
      toString(): string;
    }
  }
}

export function useCollection<T = any>(
    memoizedTargetRefOrQuery: ((CollectionReference<DocumentData> | Query<DocumentData>) & {__memo?: boolean}) | null | undefined,
): UseCollectionResult<T> {
  type ResultItemType = WithId<T>;
  type StateDataType = ResultItemType[] | null;

  const [data, setData] = useState<StateDataType>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<FirestoreError | Error | null>(null);

  useEffect(() => {
    // Guard 1: Null/Undefined check
    if (!memoizedTargetRefOrQuery) {
      setData(null);
      setIsLoading(false);
      setError(null);
      return;
    }
    
    const isCollectionGroupQuery = !!(memoizedTargetRefOrQuery as any)._query?.collectionGroup;

    // Helper to extract path for validation and error reporting
    const getPath = () => {
      try {
        if ('path' in memoizedTargetRefOrQuery && (memoizedTargetRefOrQuery as any).path) {
          return (memoizedTargetRefOrQuery as CollectionReference).path;
        }
        const internalQuery = memoizedTargetRefOrQuery as any;
        if (internalQuery._query?.path) {
          return internalQuery._query.path.canonicalString();
        }
        if (isCollectionGroupQuery) {
          return `collectionGroup<${(memoizedTargetRefOrQuery as any)._query.collectionGroup}>`;
        }
        return 'unknown_path';
      } catch {
        return 'path_resolution_failed';
      }
    };

    // Guard 2: Prevent accidental root-level listening, but allow collection group queries through.
    if (!isCollectionGroupQuery) {
        const currentPath = getPath();
        // This check is to prevent expensive root-level queries.
        if (!currentPath || currentPath === "" || currentPath.endsWith('/documents')) {
          return; 
        }
    }


    setIsLoading(true);
    setError(null);

    const unsubscribe = onSnapshot(
      memoizedTargetRefOrQuery,
      (snapshot: QuerySnapshot<DocumentData>) => {
        const results: ResultItemType[] = snapshot.docs.map(doc => ({
          ...(doc.data() as T),
          id: doc.id
        }));
        setData(results);
        setError(null);
        setIsLoading(false);
      },
      (err: FirestoreError) => {
        const contextualError = new FirestorePermissionError({
          operation: 'list',
          path: getPath(),
        });

        setError(contextualError);
        setData(null);
        setIsLoading(false);

        errorEmitter.emit('permission-error', contextualError);
      }
    );

    return () => unsubscribe();
  }, [memoizedTargetRefOrQuery]);

  if(memoizedTargetRefOrQuery && !memoizedTargetRefOrQuery.__memo) {
    throw new Error('Target was not properly memoized using useMemoFirebase');
  }

  return { data, isLoading, error };
}
