import type { Meta, StoryObj } from '@storybook/vue3';
import TokensViewer from './TokensViewer.vue';

const meta = {
  title: 'System/Tokens',
  component: TokensViewer,
  parameters: {
    layout: 'fullscreen',
  },
} satisfies Meta<typeof TokensViewer>;

export default meta;
type Story = StoryObj<typeof TokensViewer>;

export const Documentation: Story = {};
