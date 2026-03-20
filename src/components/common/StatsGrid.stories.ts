import type { Meta, StoryObj } from '@storybook/vue3';
import StatsGrid from './StatsGrid.vue';

const meta: Meta<typeof StatsGrid> = {
  title: 'Common/StatsGrid',
  component: StatsGrid,
  tags: ['autodocs'],
  argTypes: {
    stats: { control: 'object' },
  },
};

export default meta;
type Story = StoryObj<typeof StatsGrid>;

export const Default: Story = {
  args: {
    stats: [
      { title: 'Total Notes', value: 124, detail: '+12% from last month' },
      { title: 'Active Tags', value: 42, detail: '5 new this week' },
      { title: 'Storage Used', value: 2.4, detail: 'GB / 5GB limit' },
    ],
  },
};

export const Empty: Story = {
  args: {
    stats: [],
  },
};
