import type { Meta, StoryObj } from '@storybook/vue3';
import BaseCard from './BaseCard.vue';

const meta: Meta<typeof BaseCard> = {
  title: 'UI/BaseCard',
  component: BaseCard,
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: ['glass', 'pastel'],
    },
    padding: {
      control: 'select',
      options: ['none', 'sm', 'md', 'lg'],
    },
    halo: {
      control: 'select',
      options: ['peach', 'mint', 'lilac', 'none'],
    },
    haloPosition: {
      control: 'select',
      options: ['top-left', 'top-right', 'bottom-left', 'bottom-right'],
    },
  },
};

export default meta;
type Story = StoryObj<typeof BaseCard>;

export const Glass: Story = {
  render: (args) => ({
    components: { BaseCard },
    setup() { return { args } },
    template: `
      <div class="zen-atmosphere min-h-[400px] p-12 flex items-center justify-center">
        <BaseCard v-bind="args" class="w-full max-w-md">
          <h3 class="font-display text-xl mb-2 text-anthracite">Glass Card</h3>
          <p class="text-sm text-slate-500">This is the signature glass-morphism card. It uses backdrop-blur and a semi-transparent white background.</p>
        </BaseCard>
      </div>
    `
  }),
  args: {
    variant: 'glass',
    padding: 'md',
    hoverable: false,
  },
};

export const Pastel: Story = {
  render: (args) => ({
    components: { BaseCard },
    setup() { return { args } },
    template: `
      <div class="zen-atmosphere min-h-[400px] p-12 flex items-center justify-center">
        <BaseCard v-bind="args" class="w-full max-w-md">
          <p class="text-xs uppercase tracking-[0.35em] text-slate-500 font-bold mb-4">Checklist</p>
          <div class="space-y-3 text-sm">
            <p class="font-semibold text-anthracite">3 tâches</p>
            <p class="text-slate-500">Fond blanc pur · halo pêche (#FFCDBC) dans le coin.</p>
            <p class="text-slate-500">Bordures douces 32px + shadow subtile.</p>
          </div>
        </BaseCard>
      </div>
    `
  }),
  args: {
    variant: 'pastel',
    halo: 'peach',
    haloPosition: 'top-left',
    padding: 'md',
  },
};

export const PastelMint: Story = {
  args: {
    variant: 'pastel',
    halo: 'mint',
    haloPosition: 'top-right',
    padding: 'md',
  },
};
