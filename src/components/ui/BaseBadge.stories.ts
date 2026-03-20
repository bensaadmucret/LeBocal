import type { Meta, StoryObj } from '@storybook/vue3';
import BaseBadge from './BaseBadge.vue';

const meta: Meta<typeof BaseBadge> = {
  title: 'UI/BaseBadge',
  component: BaseBadge,
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: ['default', 'sage', 'clay', 'outline'],
    },
  },
};

export default meta;
type Story = StoryObj<typeof BaseBadge>;

export const Default: Story = {
  args: {
    variant: 'default',
    default: 'Default Badge',
  },
};

export const Sage: Story = {
  args: {
    variant: 'sage',
    default: 'Active Tag',
  },
};

export const Clay: Story = {
  args: {
    variant: 'clay',
    default: 'Important',
  },
};

export const Outline: Story = {
  args: {
    variant: 'outline',
    default: 'Outline Badge',
  },
};
