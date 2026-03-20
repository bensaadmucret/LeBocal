import type { Preview } from '@storybook/vue3-vite';
import '../src/style.css';

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
       color: /(background|color)$/i,
       date: /Date$/i,
      },
    },
    backgrounds: {
      disable: true, // Disable Storybook backgrounds as we use our decorator
    },
    a11y: {
      test: 'todo'
    }
  },
  globalTypes: {
    theme: {
      name: 'Theme',
      description: 'Global theme for components',
      defaultValue: 'light',
      toolbar: {
        icon: 'circlehollow',
        items: [
          { value: 'light', icon: 'circlehollow', title: 'Light Mode' },
          { value: 'dark', icon: 'circle', title: 'Night Mode' },
        ],
      },
    },
  },
  decorators: [
    (story, context) => {
      const theme = context?.globals?.theme || 'light';
      const html = document.documentElement;
      
      if (theme === 'dark') {
        html.classList.add('dark');
      } else {
        html.classList.remove('dark');
      }
      
      return {
        components: { story },
        template: `
          <div class="zen-atmosphere min-h-screen p-10 flex items-center justify-center transition-all duration-500" style="position: fixed; inset: 0; overflow: auto;">
            <div class="w-full max-w-4xl flex justify-center">
              <story />
            </div>
          </div>
        `,
      };
    },
  ],
};

export default preview;