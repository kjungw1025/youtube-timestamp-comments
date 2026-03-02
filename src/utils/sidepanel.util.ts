// SidePanel 유틸리티
// Chrome 버전 체크, SidePanel 지원 여부 확인, viewMode 관리

import { MIN_CHROME_VERSION_SIDEPANEL, STORAGE_KEY_VIEW_MODE, VIEW_MODE_POPUP } from '../constants';
import type { ViewMode } from '../types/storage.types';

// ── Chrome 버전 파싱 ───────────────────────────────────────

/**
 * User-Agent에서 Chrome 버전 번호를 파싱합니다.
 * Chrome 브라우저가 아니거나 파싱 실패 시 null 반환.
 */
export function parseChromeVersion(): number | null {
  const match = navigator.userAgent.match(/Chrome\/(\d+)/);
  if (match?.[1]) return parseInt(match[1], 10);
  return null;
}

// ── SidePanel 지원 여부 확인 ──────────────────────────────

export interface SidePanelSupportInfo {
  isSupported: boolean;
  version: number | null;
  message?: string;
}

/**
 * chrome.sidePanel API 존재 여부 + Chrome 버전(114 이상)을 함께 확인합니다.
 */
export function checkSidePanelSupport(): SidePanelSupportInfo {
  const version = parseChromeVersion();

  // sidePanel API 자체가 없는 경우
  if (!chrome.sidePanel) {
    return {
      isSupported: false,
      version,
      message: version
        ? `Side Panel requires Chrome ${MIN_CHROME_VERSION_SIDEPANEL} or later. Current: Chrome ${version}`
        : `Side Panel requires Chrome ${MIN_CHROME_VERSION_SIDEPANEL} or later.`,
    };
  }

  // 버전이 파싱되었고 최소 버전 미만인 경우
  if (version !== null && version < MIN_CHROME_VERSION_SIDEPANEL) {
    return {
      isSupported: false,
      version,
      message: `Side Panel requires Chrome ${MIN_CHROME_VERSION_SIDEPANEL} or later. Current: Chrome ${version}`,
    };
  }

  return { isSupported: true, version };
}

// ── viewMode get/set ───────────────────────────────────────

/**
 * chrome.storage.local에서 현재 viewMode를 가져옵니다.
 * 저장된 값이 없으면 기본값 'popup'을 반환합니다.
 */
export async function getViewMode(): Promise<ViewMode> {
  return new Promise((resolve) => {
    chrome.storage.local.get([STORAGE_KEY_VIEW_MODE], (result) => {
      resolve((result[STORAGE_KEY_VIEW_MODE] as ViewMode) ?? VIEW_MODE_POPUP);
    });
  });
}

/**
 * chrome.storage.local에 viewMode를 저장합니다.
 */
export async function setViewMode(mode: ViewMode): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.local.set({ [STORAGE_KEY_VIEW_MODE]: mode }, resolve);
  });
}
