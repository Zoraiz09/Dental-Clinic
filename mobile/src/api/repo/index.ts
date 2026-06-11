import { isMock } from '../../lib/supabase';
import { ClinicRepo } from './types';
import { mockRepo } from './mockRepo';
import { supabaseRepo } from './supabaseRepo';

/**
 * The single data backend for the app, chosen ONCE here from the same
 * `isMock` flag (derived from whether Supabase credentials are present).
 *
 * Call sites do `repo.patients.list(…)` etc. and never branch on
 * mock-vs-live themselves — that decision is made exactly once, at module
 * load, in this file.
 */
export const repo: ClinicRepo = isMock ? mockRepo : supabaseRepo;

export type * from './types';
