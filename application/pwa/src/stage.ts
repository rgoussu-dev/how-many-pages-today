/*
 * A staging copy of the app (built with VITE_STAGE=staging, served from …/staging/) shares
 * the production origin, so it keeps its own database: it can never read or overwrite the
 * reading history of the real app.
 */
import { DATABASE_NAME } from '@hmpt/infra-storage-indexeddb';

/** The stage this build was made for, or undefined for production. */
export const stage: string | undefined = import.meta.env.VITE_STAGE || undefined;

export const databaseName = stage ? `${DATABASE_NAME}-${stage}` : DATABASE_NAME;
