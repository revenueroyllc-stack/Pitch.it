import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const repositoryName = process.env.GITHUB_REPOSITORY?.split('/')[1] || '';
const isGitHubPagesBuild = process.env.GITHUB_ACTIONS === 'true' && repositoryName;

export default defineConfig({
  base: isGitHubPagesBuild ? `/${repositoryName}/` : '/',
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173
  }
});
