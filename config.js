// Prompt Genius — Configuration

const FWAI_CONFIG = {
  // Firebase project config (from Firebase Console > Project Settings > Your apps)
  firebase: {
    apiKey: 'AIzaSyAr90MlWteOiu07bQ-AJlpfwRYlYaPGoIc',
    projectId: 'ai-prompt-enhancer-f6b21',
  },

  // Cloud Function URLs (from: firebase deploy --only functions)
  // Each function gets its own URL after deployment
  functions: {
    enhance: 'https://us-central1-ai-prompt-enhancer-f6b21.cloudfunctions.net/enhance',
    history: 'https://us-central1-ai-prompt-enhancer-f6b21.cloudfunctions.net/history',
    user: 'https://us-central1-ai-prompt-enhancer-f6b21.cloudfunctions.net/user',
  },

  // App settings
  app: {
    name: 'Prompt Genius',
    version: '2.1.0',
    defaultStyle: 'balanced',
  }
};
