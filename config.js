// Prompt Genius — Configuration
// Replace these values after setting up Firebase

const FWAI_CONFIG = {
  // Firebase project config (from Firebase Console > Project Settings > Your apps)
  firebase: {
    apiKey: 'AIzaSyCkqhiQsQmincdiKDl78p7VUW1f4pbFv4s',
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
    version: '2.0.0',
    defaultStyle: 'balanced',
  }
};
