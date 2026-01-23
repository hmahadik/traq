import { describe, it, expect } from 'vitest';
import {
  EVENT_TYPE_COLORS,
  CATEGORY_HEX_COLORS,
  APP_HEX_COLORS,
  DEFAULT_APP_COLOR,
  getAppHexColor,
} from './timelineTypes';

describe('timelineTypes', () => {
  describe('EVENT_TYPE_COLORS', () => {
    it('has colors for all event types', () => {
      expect(EVENT_TYPE_COLORS.activity).toBe('#3b82f6');
      expect(EVENT_TYPE_COLORS.git).toBe('#22c55e');
      expect(EVENT_TYPE_COLORS.shell).toBe('#64748b');
      expect(EVENT_TYPE_COLORS.browser).toBe('#10b981');
      expect(EVENT_TYPE_COLORS.file).toBe('#f59e0b');
      expect(EVENT_TYPE_COLORS.afk).toBe('#f97316');
      expect(EVENT_TYPE_COLORS.screenshot).toBe('#ec4899');
    });

    it('all colors are valid hex colors', () => {
      const hexRegex = /^#[0-9a-fA-F]{6}$/;
      Object.values(EVENT_TYPE_COLORS).forEach((color) => {
        expect(color).toMatch(hexRegex);
      });
    });
  });

  describe('CATEGORY_HEX_COLORS', () => {
    it('has colors for all categories', () => {
      expect(CATEGORY_HEX_COLORS.focus).toBe('#22c55e');
      expect(CATEGORY_HEX_COLORS.meetings).toBe('#ef4444');
      expect(CATEGORY_HEX_COLORS.comms).toBe('#a855f7');
      expect(CATEGORY_HEX_COLORS.other).toBe('#6b7280');
      expect(CATEGORY_HEX_COLORS.breaks).toBe('#f97316');
    });

    it('all colors are valid hex colors', () => {
      const hexRegex = /^#[0-9a-fA-F]{6}$/;
      Object.values(CATEGORY_HEX_COLORS).forEach((color) => {
        expect(color).toMatch(hexRegex);
      });
    });
  });

  describe('APP_HEX_COLORS', () => {
    it('has colors for browsers', () => {
      expect(APP_HEX_COLORS.chrome).toBeDefined();
      expect(APP_HEX_COLORS.firefox).toBeDefined();
      expect(APP_HEX_COLORS.safari).toBeDefined();
    });

    it('has colors for development tools', () => {
      expect(APP_HEX_COLORS.code).toBeDefined();
      expect(APP_HEX_COLORS.vscode).toBeDefined();
      expect(APP_HEX_COLORS.terminal).toBeDefined();
    });

    it('has colors for communication apps', () => {
      expect(APP_HEX_COLORS.slack).toBeDefined();
      expect(APP_HEX_COLORS.discord).toBeDefined();
      expect(APP_HEX_COLORS.teams).toBeDefined();
    });

    it('all colors are valid hex colors', () => {
      const hexRegex = /^#[0-9a-fA-F]{6}$/;
      Object.values(APP_HEX_COLORS).forEach((color) => {
        expect(color).toMatch(hexRegex);
      });
    });
  });

  describe('DEFAULT_APP_COLOR', () => {
    it('is a valid hex color', () => {
      expect(DEFAULT_APP_COLOR).toMatch(/^#[0-9a-fA-F]{6}$/);
    });

    it('is gray-500', () => {
      expect(DEFAULT_APP_COLOR).toBe('#6b7280');
    });
  });

  describe('getAppHexColor', () => {
    it('returns exact match color for known apps', () => {
      expect(getAppHexColor('chrome')).toBe('#10b981');
      expect(getAppHexColor('vscode')).toBe('#3b82f6');
      expect(getAppHexColor('slack')).toBe('#9333ea');
      expect(getAppHexColor('terminal')).toBe('#475569');
    });

    it('is case-insensitive', () => {
      expect(getAppHexColor('Chrome')).toBe('#10b981');
      expect(getAppHexColor('CHROME')).toBe('#10b981');
      expect(getAppHexColor('VSCode')).toBe('#3b82f6');
      expect(getAppHexColor('SLACK')).toBe('#9333ea');
    });

    it('returns color for partial matches', () => {
      // "google-chrome" should match "chrome"
      expect(getAppHexColor('google-chrome')).toBe('#10b981');
      // "tilix-terminal" should match "tilix"
      expect(getAppHexColor('tilix-terminal')).toBe('#475569');
      // "slack-desktop" should match "slack"
      expect(getAppHexColor('slack-desktop')).toBe('#9333ea');
    });

    it('returns default color for unknown apps', () => {
      expect(getAppHexColor('unknown-app')).toBe(DEFAULT_APP_COLOR);
      expect(getAppHexColor('random-software')).toBe(DEFAULT_APP_COLOR);
      expect(getAppHexColor('')).toBe(DEFAULT_APP_COLOR);
    });

    it('prioritizes exact matches over partial matches', () => {
      // "code" is an exact match, should not match "vscode"
      expect(getAppHexColor('code')).toBe('#3b82f6');
    });

    it('handles edge cases', () => {
      // Empty string
      expect(getAppHexColor('')).toBe(DEFAULT_APP_COLOR);
      // Whitespace
      expect(getAppHexColor('   ')).toBe(DEFAULT_APP_COLOR);
      // Numbers in name
      expect(getAppHexColor('chrome123')).toBe('#10b981');
    });
  });
});
