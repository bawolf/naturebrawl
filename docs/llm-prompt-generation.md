# LLM-Based Image Prompt Generation

## Overview

Nature Brawl now uses an advanced LLM-based system to generate vivid, descriptive prompts for image generation with Flux Kontext. This replaces the previous template-based approach with much more dynamic and contextual image modifications.

## Architecture

### Data Pipeline

```
AttackResult + Characters → OpenAI GPT-4o-mini → Vivid Scene Description → Flux Kontext → Generated Image
```

### Components

1. **`llm/client.ts`** - Shared LLM client service (OpenAI + Instructor)
2. **`llm-prompts.ts`** - LLM-based prompt generation service
3. **`llm/character-generator.ts`** - Uses shared client for character generation
4. **`prompts.ts`** - Legacy template-based system (kept as fallback)
5. **`index.ts`** - Main image generation service (updated to use LLM)

## Prompt Quality Improvement

### Before (Template-based)

```
Change the Lion to be attack like "Power Pounce"Show the Bear dodging the attack. Maintain the same composition, camera angle, lighting, and background.
```

### After (LLM-generated)

```
The lion is now on top of the tiger, jumping onto the tiger aggressively. The tiger is pushed over and fell down and is scared. The lion is on top of him. Maintain the same composition, camera angle, lighting, and background.
```

## Key Features

### Contextual Awareness

- **Attack Type**: Descriptions vary based on the specific attack being used
- **Hit/Miss**: Different descriptions for successful hits vs dodged attacks
- **Critical Hits**: Enhanced effects and drama for critical strikes
- **Health Status**: Characters appear more battle-worn as health decreases
- **Species Traits**: Leverages real-world animal characteristics

### Fallback System

- Automatically falls back to template-based prompts when:
  - No `OPENAI_API_KEY` environment variable
  - OpenAI API is unavailable
  - Running in test environment
  - LLM call fails or times out

### Structured Output

Uses Instructor with Zod schemas for reliable, consistent outputs:

```typescript
const SceneModificationSchema = z.object({
  description: z
    .string()
    .describe(
      'A vivid, detailed description of how the scene should be modified'
    ),
  reasoning: z
    .string()
    .describe('Brief explanation of why this visual representation works well'),
});
```

## Usage

### Attack Scene Generation

```typescript
import { generateAttackSceneModification } from './llm-prompts';

const modification = await generateAttackSceneModification(
  attackResult,
  attacker,
  defender
);
```

### Victory Scene Generation

```typescript
import { generateVictorySceneModification } from './llm-prompts';

const modification = await generateVictorySceneModification(winner, loser);
```

### Using Shared LLM Client

```typescript
import { getInstructorClient, isLLMAvailable } from '../../llm/client';

if (isLLMAvailable()) {
  const instructor = getInstructorClient();
  // Use instructor for LLM calls
}
```

## Configuration

### Required Environment Variables

```env
OPENAI_API_KEY=your_openai_api_key_here
```

### Shared LLM Client

The `llm/client.ts` service provides:

- **Lazy Initialization**: Clients are only created when first used
- **Singleton Pattern**: Same instances reused across the application
- **Test Environment Detection**: Automatically disabled in test mode
- **Graceful Degradation**: Falls back when API key is missing

### Model Settings

- **Model**: `gpt-4o-mini` (cost-effective, fast)
- **Max Retries**: 3
- **Mode**: TOOLS (Instructor structured output)
- **Shared Instance**: Single OpenAI client reused across services

## Error Handling

The system gracefully handles failures:

1. **LLM Unavailable**: Falls back to template-based prompts
2. **Timeout/Network Issues**: Retries up to 3 times, then falls back
3. **Invalid Responses**: Validates output schema, falls back on failure
4. **Rate Limiting**: Respects OpenAI rate limits with exponential backoff

## Testing

Tests verify both LLM and fallback behavior:

```bash
yarn test test/image-generation.test.js
```

## Performance

- **Average Response Time**: ~500-800ms for LLM generation
- **Fallback Time**: ~1-2ms for template generation
- **Cost**: ~$0.001-0.002 per prompt (GPT-4o-mini pricing)

## Future Enhancements

1. **Prompt Caching**: Cache successful prompts for similar scenarios
2. **A/B Testing**: Compare LLM vs template-generated image quality
3. **Fine-tuning**: Train custom model on Nature Brawl-specific scenes
4. **Dynamic Templates**: Use LLM to improve fallback templates over time
