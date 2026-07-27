export const IPC_CHANNELS = {
  app: {
    getEnvironment: 'app:get-environment',
  },
  storyboard: {
    getStoryboard: 'storyboard:get-storyboard',
    createScene: 'storyboard:create-scene',
    deleteScene: 'storyboard:delete-scene',
    updatePrompt: 'storyboard:update-prompt',
  },
  settings: {
    get: 'settings:get',
    update: 'settings:update',
  },
} as const