/**
 * Magrit v2 — extension Tailwind v4
 * À merger dans le tailwind.config.ts du repo Magritoff.
 * Les tokens viennent de src/styles/tokens.css (CSS vars) — on les expose
 * comme classes utilitaires pour que shadcn/ui continue de fonctionner.
 */
import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  darkMode: ['class', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        ink:      'var(--ink)',
        'ink-2':  'var(--ink-2)',
        muted:    'var(--muted)',
        'mute-2': 'var(--mute-2)',
        line:     'var(--line)',
        'line-2': 'var(--line-2)',
        bg:       'var(--bg)',
        paper:    'var(--paper)',
        accent: {
          DEFAULT: 'var(--accent)',
          soft:    'var(--accent-soft)',
          ink:     'var(--accent-ink)',
        },
        ok:   { bg: 'var(--ok-bg)',   fg: 'var(--ok-fg)',   line: 'var(--ok-line)' },
        warn: { bg: 'var(--warn-bg)', fg: 'var(--warn-fg)' },
        err:  { bg: 'var(--err-bg)',  fg: 'var(--err-fg)'  },
        info: { bg: 'var(--info-bg)', fg: 'var(--info-fg)' },
      },
      fontFamily: {
        sans:  ['var(--font-ui)'],
        mono:  ['var(--font-mono)'],
        serif: ['var(--font-serif)'],
      },
      fontSize: {
        xs:     ['11px',   { lineHeight: '1.4' }],
        sm:     ['12.5px', { lineHeight: '1.5' }],
        base:   ['13.5px', { lineHeight: '1.5' }],
        md:     ['14.5px', { lineHeight: '1.5' }],
        lg:     ['16px',   { lineHeight: '1.5' }],
        xl:     ['20px',   { lineHeight: '1.3', letterSpacing: '-0.01em' }],
        '2xl':  ['24px',   { lineHeight: '1.25', letterSpacing: '-0.015em' }],
        '3xl':  ['28px',   { lineHeight: '1.2',  letterSpacing: '-0.02em'  }],
        '4xl':  ['34px',   { lineHeight: '1.15', letterSpacing: '-0.025em' }],
        '5xl':  ['48px',   { lineHeight: '1.05', letterSpacing: '-0.03em'  }],
      },
      letterSpacing: {
        tight: '-0.025em',
        snug:  '-0.015em',
        base:  '-0.005em',
        wide:  '0.08em',
      },
      borderRadius: {
        sm:  'var(--radius-sm)',
        DEFAULT: 'var(--radius)',
        md:  'var(--radius-md)',
        lg:  'var(--radius-lg)',
        xl:  'var(--radius-xl)',
        '2xl': 'var(--radius-2xl)',
      },
      boxShadow: {
        xs: 'var(--shadow-xs)',
        sm: 'var(--shadow-sm)',
        DEFAULT: 'var(--shadow-md)',
        md: 'var(--shadow-md)',
        lg: 'var(--shadow-lg)',
        focus: 'var(--shadow-focus)',
      },
      transitionTimingFunction: {
        'out-soft':  'cubic-bezier(0.2, 0.8, 0.2, 1)',
      },
      transitionDuration: {
        fast: '120ms',
        base: '180ms',
        slow: '320ms',
      },
    },
  },
  plugins: [],
};

export default config;
