/**
 * deepLinkSchemes: behaviour contract of the single-scheme (countersign) hub.
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
  it('matches the countersign:// prefix and rejects the upstream cindy:// and xdt-maker:// schemes', () => {
    expect(matchDeepLinkPrefix('countersign://session/a')).toBe('countersign://');
    expect(isDeepLinkUrl('countersign://project/x')).toBe(true);
    expect(matchDeepLinkPrefix('cindy://session/a')).toBeNull();
    expect(matchDeepLinkPrefix('xdt-maker://session/a')).toBeNull();
    expect(isDeepLinkUrl('cindy://project/x')).toBe(false);
  });

  it('rejects other schemes, including in-process resource schemes', () => {
    expect(matchDeepLinkPrefix('https://example.com')).toBeNull();
    expect(matchDeepLinkPrefix('xdt-image://blobs/x.png')).toBeNull();
    expect(matchDeepLinkPrefix('cindy-media://blobs/x.png')).toBeNull();
    expect(isDeepLinkUrl('')).toBe(false);
  });
});

describe('isDeepLinkProtocol', () => {
  it('accepts the WHATWG URL.protocol value of the countersign scheme only', () => {
    expect(isDeepLinkProtocol('countersign:')).toBe(true);
    expect(isDeepLinkProtocol('cindy:')).toBe(false);
    expect(isDeepLinkProtocol('xdt-maker:')).toBe(false);
    expect(isDeepLinkProtocol('https:')).toBe(false);
    expect(isDeepLinkProtocol('countersign')).toBe(false); // 必须带冒号
  });
});

describe('textContainsDeepLink', () => {
  it('detects the countersign scheme anywhere in free text, not the upstream schemes', () => {
    expect(textContainsDeepLink('见 countersign://session/abc 这个任务')).toBe(true);
    expect(textContainsDeepLink('old link cindy://session/abc')).toBe(false);
    expect(textContainsDeepLink('普通文本 https://example.com')).toBe(false);
  });
});

describe('stripDeepLinkPathPrefix / hasDeepLinkPathPrefix', () => {
  it('slices by the matched prefix length', () => {
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
