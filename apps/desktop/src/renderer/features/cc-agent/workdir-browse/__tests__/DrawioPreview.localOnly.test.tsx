// @vitest-environment jsdom
// web-exempt-file: the drawio fixtures carry mxCell style attributes in diagram XML, not page markup.

// Countersign: under the real LOCAL_ONLY, a .drawio preview makes no request to
// a remote host. The test runs the vendored viewer itself (its defaults point at
// viewer.diagrams.net and fonts.googleapis.com), so it fails if the preview
// stops overriding them before the script runs.

import { readFileSync } from 'node:fs';
import path from 'node:path';
import * as vm from 'node:vm';

import { cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { LOCAL_ONLY } from '@cindy/maker-shared/local-only';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('@/lib/logger', () => ({
  createLogger: () => ({ warn: vi.fn(), info: vi.fn(), debug: vi.fn(), error: vi.fn() }),
}));

vi.mock('../UnrenderablePlaceholder', () => ({
  UnrenderablePlaceholder: () => <div data-testid="unrenderable" />,
}));

import { DrawioPreview } from '../DrawioPreview';

const VIEWER_SOURCE = readFileSync(
  path.resolve(__dirname, '../../../../vendor/drawio/viewer-static.min.js'),
  'utf8',
);

const GOOGLE_FONT = 'https://fonts.googleapis.com/css?family=Roboto';
const EXT_FONT = 'https://fonts.googleapis.com/css?family=Lato';
const LABEL_FONT = 'https://fonts.googleapis.com/css?family=Oswald';

function cell(id: string, value: string, style: string, x: number): string {
  return (
    `<mxCell id="${id}" value="${value}" style="${style}" vertex="1" parent="1">` +
    `<mxGeometry x="${x}" y="10" width="60" height="60" as="geometry"/></mxCell>`
  );
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// AWS and Cisco library shapes (stencil XML), an SAP icon (GRAPH_IMAGE_PATH),
// a Google font in the style, one in an HTML label and one in extFonts.
const DIAGRAM_XML =
  `<mxfile><diagram id="d" name="p"><mxGraphModel extFonts="Lato^${EXT_FONT}"><root>` +
  '<mxCell id="0"/><mxCell id="1" parent="0"/>' +
  cell(
    '2',
    'Lambda',
    `shape=mxgraph.aws4.resourceIcon;resIcon=mxgraph.aws4.lambda;fontFamily=Roboto;fontSource=${encodeURIComponent(GOOGLE_FONT)};`,
    10,
  ) +
  cell('3', 'Router', 'shape=mxgraph.cisco.routers.router;', 100) +
  cell('4', '', 'shape=mxgraph.sap.icon;SAPIcon=Accept;', 190) +
  cell(
    '5',
    escapeXml(`<font face="Oswald" data-font-src="${LABEL_FONT}">label</font>`),
    'html=1;fontFamily=Lato;',
    280,
  ) +
  '</root></mxGraphModel></diagram></mxfile>';

const CSS_URL = /url\(\s*['"]?([^'")\s]+)/gi;

// jsdom serves the page from http://localhost:3000, standing in for the app's
// file:// page. A URL counts as remote when it resolves to another web origin.
function isRemote(url: string): boolean {
  let resolved: URL;
  try {
    resolved = new URL(url, document.baseURI);
  } catch {
    return false;
  }
  return /^(?:https?|wss?):$/.test(resolved.protocol) && resolved.origin !== window.location.origin;
}

class RecordingXhr {
  static urls: string[] = [];
  status = 404;
  readyState = 4;
  responseText = '';
  responseXML = null;
  open(_method: string, url: string) {
    RecordingXhr.urls.push(String(url));
  }
  send() {}
  abort() {}
  setRequestHeader() {}
  overrideMimeType() {}
  getAllResponseHeaders() {
    return '';
  }
  addEventListener() {}
  removeEventListener() {}
}

let attributeUrls: string[] = [];
let fetchUrls: string[] = [];

function recordAttribute(name: string, value: unknown) {
  const lower = name.toLowerCase();
  if (lower === 'src' || lower === 'href' || lower === 'xlink:href') {
    attributeUrls.push(String(value));
  }
}

beforeEach(() => {
  RecordingXhr.urls = [];
  attributeUrls = [];
  fetchUrls = [];
  vi.stubGlobal('XMLHttpRequest', RecordingXhr);
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: unknown) => {
      fetchUrls.push(String(input));
      throw new TypeError('network disabled in test');
    }),
  );

  const setAttribute = Element.prototype.setAttribute;
  vi.spyOn(Element.prototype, 'setAttribute').mockImplementation(function (
    this: Element,
    name: string,
    value: string,
  ) {
    recordAttribute(name, value);
    return setAttribute.call(this, name, value);
  });
  const setAttributeNS = Element.prototype.setAttributeNS;
  vi.spyOn(Element.prototype, 'setAttributeNS').mockImplementation(function (
    this: Element,
    ns: string | null,
    name: string,
    value: string,
  ) {
    recordAttribute(name, value);
    return setAttributeNS.call(this, ns, name, value);
  });

  // Run the real viewer when DrawioPreview injects its <script>.
  const appendChild = document.head.appendChild;
  vi.spyOn(document.head, 'appendChild').mockImplementation(function <T extends Node>(
    this: HTMLHeadElement,
    node: T,
  ): T {
    if (node instanceof HTMLScriptElement && /viewer-static/.test(node.src)) {
      // In this environment `window` is the global object, so the viewer's
      // top-level declarations become globals, as in the app's renderer.
      vm.runInContext(VIEWER_SOURCE, vm.createContext(window));
      queueMicrotask(() => node.onload?.(new Event('load')));
      return node;
    }
    return appendChild.call(this, node) as T;
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function remoteUrlsInDocument(): string[] {
  const found: string[] = [];
  for (const element of Array.from(document.querySelectorAll('*'))) {
    for (const attribute of ['src', 'href', 'xlink:href']) {
      const value = element.getAttribute(attribute);
      if (value && isRemote(value)) found.push(`${element.tagName} ${attribute}=${value}`);
    }
  }
  for (const style of Array.from(document.querySelectorAll('style'))) {
    for (const match of (style.textContent ?? '').matchAll(CSS_URL)) {
      if (isRemote(match[1])) found.push(`style url(${match[1]})`);
    }
  }
  return found;
}

describe('DrawioPreview under LOCAL_ONLY', () => {
  it('renders library shapes and web fonts without any remote request', async () => {
    expect(LOCAL_ONLY).toBe(true);

    const { container, queryByTestId } = render(
      <DrawioPreview
        workdir="/workspace"
        relPath="diagram.drawio"
        xmlContent={DIAGRAM_XML}
        size={DIAGRAM_XML.length}
        mtimeMs={1}
      />,
    );

    await waitFor(() => expect(container.querySelector('.mxgraph svg')).not.toBeNull());
    expect(queryByTestId('unrenderable')).toBeNull();

    // The viewer did try to load the stencil libraries, so the redirect is what
    // keeps them local (they fail and the shapes draw as placeholders).
    expect(RecordingXhr.urls.some((url) => /stencils\/aws4\.xml$/.test(url))).toBe(true);
    expect(RecordingXhr.urls.filter(isRemote)).toEqual([]);
    expect(fetchUrls.filter(isRemote)).toEqual([]);
    expect(attributeUrls.filter(isRemote)).toEqual([]);
    expect(remoteUrlsInDocument()).toEqual([]);
  });
});
