import type { Meta, StoryObj } from '@storybook/vue3';
import BaseButton from './BaseButton.vue';

const meta: Meta<typeof BaseButton> = {
  title: 'UI/BaseButton',
  component: BaseButton,
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: ['primary', 'secondary', 'ghost', 'clay'],
    },
    size: {
      control: 'select',
      options: ['sm', 'md', 'lg', 'icon'],
    },
  },
};

export default meta;
type Story = StoryObj<typeof BaseButton>;

export const Primary: Story = {
  args: {
    variant: 'primary',
    default: 'Primary Button',
    size: "icon"
  },
};

export const Clay: Story = {
  args: {
    variant: 'clay',
    default: 'Clay Action',
  },
};

export const Secondary: Story = {
  args: {
    variant: 'secondary',
    default: 'Secondary Button',
  },
};

export const Ghost: Story = {
  args: {
    variant: 'ghost',
    default: 'Ghost Button',
  },
};

export const Icon: Story = {
  args: {
    size: 'icon',
    default: '🏠',
  },
};

export const AllSizes: Story = {
  render: (args) => ({
    components: { BaseButton },
    setup() { return { args } },
    template: `
      <div class="flex items-center gap-6 p-4">
        <BaseButton v-bind="args" size="sm">Small Chip</BaseButton>
        <BaseButton v-bind="args" size="md">Medium Base</BaseButton>
        <BaseButton v-bind="args" size="lg">Large Premium</BaseButton>
        <BaseButton v-bind="args" size="icon">🏠</BaseButton>
      </div>
    `
  }),
  args: {
    variant: 'primary',
  },
};
