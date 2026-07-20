import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const messagesRoot = path.resolve(__dirname, '..');

const localizedProductFiles = [
  'common.json',
  'landing.json',
  'activity/code-reviews.json',
  'activity/sidebar.json',
  'settings/billing.json',
  'settings/credits.json',
  'settings/payments.json',
  'settings/sidebar.json',
  'pages/index.json',
  'pages/pricing.json',
];

const forbiddenTemplateCopy = [
  'ShipAny Boilerplate',
  'ShipAny Pricing',
  'NextJS boilerplate',
  'Build unlimited projects',
  'Ship AI Startups',
];

const mojibakeMarkers = [
  '�',
  '锟',
  '閳',
  '閿',
  '娑',
  '鐎',
  '缁',
  '妤',
  '鐨',
  '鍧',
  '瀹',
  '浠',
  '绉',
  '骞',
  '鏄',
  '璇',
  '褰',
  '璐',
  '鏌',
  '鎸',
  '鍙',
  '銆',
  '锛',
];

describe('productized locale copy', () => {
  it('keeps productized copy free of scaffold phrases and mojibake', () => {
    for (const locale of ['en', 'zh']) {
      for (const file of localizedProductFiles) {
        const content = readFileSync(
          path.join(messagesRoot, locale, file),
          'utf8'
        );

        expect(() => JSON.parse(content)).not.toThrow();

        for (const phrase of forbiddenTemplateCopy) {
          expect(content).not.toContain(phrase);
        }

        for (const marker of mojibakeMarkers) {
          expect(content).not.toContain(marker);
        }
      }
    }
  });

  it('defines the subscription-first pricing catalog in both locales', () => {
    const expectedProductIds = [
      'starter-monthly',
      'team-monthly',
      'pro-monthly',
      'starter-yearly',
      'team-yearly',
      'pro-yearly',
      'credits-100',
      'credits-300',
      'credits-1000',
    ];
    const expectedGroups = ['monthly', 'yearly', 'credits'];

    for (const locale of ['en', 'zh']) {
      const pricing = JSON.parse(
        readFileSync(
          path.join(messagesRoot, locale, 'pages/pricing.json'),
          'utf8'
        )
      );
      const section = pricing.page.sections.pricing;

      expect(
        section.groups.map((group: { name: string }) => group.name)
      ).toEqual(expectedGroups);
      expect(
        section.items.map((item: { product_id: string }) => item.product_id)
      ).toEqual(expectedProductIds);
      expect(
        section.items.map((item: { group: string }) => item.group)
      ).toEqual([
        'monthly',
        'monthly',
        'monthly',
        'yearly',
        'yearly',
        'yearly',
        'credits',
        'credits',
        'credits',
      ]);
    }
  });
});
