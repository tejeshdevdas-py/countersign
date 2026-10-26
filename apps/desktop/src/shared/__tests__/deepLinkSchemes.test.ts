/**
 * deepLinkSchemes:双 scheme(cindy 主 + 历史 xdt-maker)收敛单点的行为契约。
 * 生成一律主 scheme;解析两种 scheme 都认;切片按实际命中前缀长度。
 */

import { describe, expect, it } from 'vitest';

import {
  DEEP_LINK_PRIMARY_SCHEME,
  DEEP_LINK_PROVIDER_CONNECT_ID_MAX_LENGTH,
  DEEP_LINK_SCHEMES,
  DEEP_LINK_SCHEME_RE_GROUP,
  DEEP_LINK_URL_PREFIX,
  DEEP_LINK_URL_PREFIXES,
  buildDeepLink,
  hasDeepLinkPathPrefix,
  isDeepLinkProtocol,
  isDeepLinkProviderConnectId,
  isDeepLinkUrl,
  matchDeepLinkPrefix,
  stripDeepLinkPathPrefix,
  textContainsDeepLink,
} from '../deepLinkSchemes';

describe('deepLinkSchemes constants', () => {
  it('primary scheme is countersign and no legacy scheme is recognized', () => {
    expect(DEEP_LINK_PRIMARY_SCHEME).toBe('countersign');
    expect(DEEP_LINK_SCHEMES).toEqual(['countersign']);
    expect(DEEP_LINK_URL_PREFIX).toBe('countersign://');
    expect(DEEP_LINK_URL_PREFIXES).toContain('countersign://');
  });

  it('regex scheme group matches every registered scheme', () => {
    const re = new RegExp(`^${DEEP_LINK_SCHEME_RE_GROUP}$`);
    for (const scheme of DEEP_LINK_SCHEMES) {
      expect(re.test(scheme)).toBe(true);
    }
    expect(re.test('http')).toBe(false);
  });
});

describe('matchDeepLinkPrefix / isDeepLinkUrl', () => {
  it('matches both primary and legacy prefixes', () => {
    expect(matchDeepLinkPrefix('countersign://session/a')).toBe('countersign://');
    expect(matchDeepLinkPrefix('countersign://session/a')).toBe('countersign://');
    expect(isDeepLinkUrl('countersign://project/x')).toBe(true);
    expect(isDeepLinkUrl('countersign://project/x')).toBe(true);
  });

  it('rejects other schemes, including in-process resource schemes', () => {
    expect(matchDeepLinkPrefix('https://example.com')).toBeNull();
    expect(matchDeepLinkPrefix('xdt-image://blobs/x.png')).toBeNull();
    expect(matchDeepLinkPrefix('cindy-media://blobs/x.png')).toBeNull();
    expect(isDeepLinkUrl('')).toBe(false);
  });
});

describe('isDeepLinkProtocol', () => {
  it('accepts WHATWG URL.protocol values for both schemes only', () => {
    expect(isDeepLinkProtocol('countersign:')).toBe(true);
    expect(isDeepLinkProtocol('cindy:')).toBe(false);
    expect(isDeepLinkProtocol('xdt-maker:')).toBe(false);
    expect(isDeepLinkProtocol('https:')).toBe(false);
    expect(isDeepLinkProtocol('countersign')).toBe(false); // 必须带冒号
  });
});

describe('textContainsDeepLink', () => {
  it('detects either scheme anywhere in free text', () => {
    expect(textContainsDeepLink('见 countersign://session/abc 这个任务')).toBe(true);
    expect(textContainsDeepLink('老链接 countersign://session/abc 仍可点')).toBe(true);
    expect(textContainsDeepLink('普通文本 https://example.com')).toBe(false);
  });
});

describe('stripDeepLinkPathPrefix / hasDeepLinkPathPrefix', () => {
  it('slices by the actually matched prefix length (schemes differ in length)', () => {
    expect(stripDeepLinkPathPrefix('countersign://session/abc?m=1', 'session/')).toBe('abc?m=1');
    expect(stripDeepLinkPathPrefix('countersign://session/abc?m=1', 'session/')).toBe('abc?m=1');
  });

  it('returns null on path-type mismatch and empty string on empty rest', () => {
    expect(stripDeepLinkPathPrefix('countersign://project/x', 'session/')).toBeNull();
    expect(stripDeepLinkPathPrefix('https://x/session/a', 'session/')).toBeNull();
    expect(stripDeepLinkPathPrefix('countersign://session/', 'session/')).toBe('');
    expect(hasDeepLinkPathPrefix('countersign://session-card/a?wake=created', 'session-card/')).toBe(
      true,
    );
    expect(hasDeepLinkPathPrefix('countersign://session/a', 'session-card/')).toBe(false);
  });
});

describe('isDeepLinkProviderConnectId', () => {
  it('accepts provider and preset ids while bounding untrusted URL input', () => {
    expect(isDeepLinkProviderConnectId('openrouter')).toBe(true);
    expect(isDeepLinkProviderConnectId('Vendor_2')).toBe(true);
    expect(
      isDeepLinkProviderConnectId('a'.repeat(DEEP_LINK_PROVIDER_CONNECT_ID_MAX_LENGTH)),
    ).toBe(true);
    expect(isDeepLinkProviderConnectId('')).toBe(false);
    expect(isDeepLinkProviderConnectId('a.b')).toBe(false);
    expect(isDeepLinkProviderConnectId('a b')).toBe(false);
    expect(
      isDeepLinkProviderConnectId('a'.repeat(DEEP_LINK_PROVIDER_CONNECT_ID_MAX_LENGTH + 1)),
    ).toBe(false);
  });
});

describe('buildDeepLink', () => {
  it('always generates with the primary scheme', () => {
    expect(buildDeepLink('session/abc')).toBe('countersign://session/abc');
  });
});
