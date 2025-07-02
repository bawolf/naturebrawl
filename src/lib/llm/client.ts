import OpenAI from 'openai';
import Instructor from '@instructor-ai/instructor';
import { getEnvVar } from '../env';

// Check if we're in test environment
const isTestEnvironment =
  typeof process !== 'undefined' &&
  (process.env.NODE_ENV === 'test' || process.env.VITEST === 'true');

// Shared OpenAI client instance
let openai: OpenAI | null = null;
let instructor: any = null;
let isInitialized = false;

/**
 * Initialize OpenAI client and Instructor if not already initialized
 */
function initializeClients(): void {
  if (isInitialized) return;

  const openaiApiKey = getEnvVar('OPENAI_API_KEY');

  if (openaiApiKey && !isTestEnvironment) {
    openai = new OpenAI({
      apiKey: openaiApiKey,
    });

    instructor = Instructor({
      client: openai,
      mode: 'TOOLS', // Using TOOLS mode as it's more reliable than FUNCTIONS
    });

    console.log('OpenAI client and Instructor initialized successfully');
  } else {
    if (isTestEnvironment) {
      console.log('Test environment detected, skipping OpenAI initialization');
    } else {
      console.log(
        'No OPENAI_API_KEY found, LLM features will use fallback behavior'
      );
    }
  }

  isInitialized = true;
}

/**
 * Get the OpenAI client instance (lazy initialization)
 */
export function getOpenAIClient(): OpenAI | null {
  if (!isInitialized) {
    initializeClients();
  }
  return openai;
}

/**
 * Get the Instructor client instance (lazy initialization)
 */
export function getInstructorClient(): any {
  if (!isInitialized) {
    initializeClients();
  }
  return instructor;
}

/**
 * Check if LLM services are available
 */
export function isLLMAvailable(): boolean {
  if (!isInitialized) {
    initializeClients();
  }
  return openai !== null && instructor !== null;
}

/**
 * Check if we're in test environment
 */
export function isTestEnv(): boolean {
  return isTestEnvironment;
}

/**
 * Get the OpenAI API key if available
 */
export function getOpenAIApiKey(): string | undefined {
  return getEnvVar('OPENAI_API_KEY');
}

/**
 * Force re-initialization (useful for testing)
 */
export function reinitializeLLMClients(): void {
  isInitialized = false;
  openai = null;
  instructor = null;
  initializeClients();
}
