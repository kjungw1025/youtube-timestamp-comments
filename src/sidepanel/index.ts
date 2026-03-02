// SidePanel Entry Point
// popup/index.ts와 동일한 진입점 구조.
// ResizeObserver로 패널 너비를 감지하여 반응형 CSS 클래스를 토글한다.

import './sidepanel.css';

import { initI18n } from '../i18n';
import { getStorageMultiple } from '../utils/storage.util';
import { STORAGE_KEY_THEME, STORAGE_KEY_LANGUAGE, STORAGE_KEY_API_KEY, THEME_DARK } from '../constants';
import { router } from '../popup/router';
import { mountMainPage } from '../popup/pages/MainPage';
import { mountSettingsPage } from '../popup/pages/SettingsPage';

// ── 반응형: 패널 너비 감지 ────────────────────────────────

const BREAKPOINT_NARROW = 400; // < 400px: 사이드바 숨김
const BREAKPOINT_MEDIUM = 600; // 400~599px: 사이드바 축소, ≥600px: 전체 표시

function applyPanelClass(width: number): void {
  const body = document.body;
  body.classList.remove('panel-narrow', 'panel-medium', 'panel-wide');

  if (width < BREAKPOINT_NARROW) {
    body.classList.add('panel-narrow');
  } else if (width < BREAKPOINT_MEDIUM) {
    body.classList.add('panel-medium');
  } else {
    body.classList.add('panel-wide');
  }
}

function initResizeObserver(): void {
  // 초기 적용
  applyPanelClass(window.innerWidth);

  const observer = new ResizeObserver(() => {
    applyPanelClass(window.innerWidth);
  });
  observer.observe(document.body);

  // 호환성을 위해 resize 이벤트도 병행
  window.addEventListener('resize', () => applyPanelClass(window.innerWidth));
}

// ── videoId / tabId 추출 ──────────────────────────────────

async function getTabInfo(): Promise<{ videoId: string | null; tabId: number | null }> {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const tab = tabs[0];
  const url = tab?.url ?? '';
  const match = url.match(/[?&]v=([^&]+)/);
  return {
    videoId: match?.[1] ?? null,
    tabId: tab?.id ?? null,
  };
}

// ── 진입점 ────────────────────────────────────────────────

async function main(): Promise<void> {
  // 반응형 클래스 초기화
  initResizeObserver();

  // 저장된 테마 적용
  const stored = await getStorageMultiple([STORAGE_KEY_THEME, STORAGE_KEY_LANGUAGE, STORAGE_KEY_API_KEY]);
  if (stored.theme === THEME_DARK) document.documentElement.classList.add('dark');

  // i18n 초기화
  await initI18n();

  // videoId / tabId 사전 추출
  const { videoId, tabId } = await getTabInfo();

  const root = document.getElementById('root')!;

  // 라우트 변경 시 페이지 전환
  router.onRouteChange((route) => {
    if (route === '/') {
      void mountMainPage(root, videoId, tabId);
    } else if (route === '/settings') {
      mountSettingsPage(root);
    }
  });

  // 초기 라우트 — API Key 없으면 SettingsPage, 있으면 MainPage
  if (!stored[STORAGE_KEY_API_KEY]) {
    router.navigate('/settings');
  } else {
    void mountMainPage(root, videoId, tabId);
  }
}

document.addEventListener('DOMContentLoaded', () => { void main(); });
