import { z } from 'zod';

export const githubConfigSchema = z.object({
  repo: z
    .string()
    .regex(/^[\w.-]+\/[\w.-]+$/, 'Use the owner/repository form, for example acme/web')
    .describe('Repository'),
  environments: z
    .array(z.string())
    .default([])
    .describe('Environments to track. Leave empty to track every environment.'),
});

export type GithubConfig = z.infer<typeof githubConfigSchema>;
