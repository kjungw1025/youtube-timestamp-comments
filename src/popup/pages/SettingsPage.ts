// SettingsPage — 설정 뷰
// options/index.ts 의 로직을 이관하여 라우터 기반으로 동작한다.
// mode: 'popup' | 'sidepanel' 파라미터로 전환 버튼 분기 처리

import { t, setLanguage, getCurrentLanguage, getSupportedLanguages } from '../../i18n';
import { getStorage, setStorage } from '../../utils/storage.util';
import { checkSidePanelSupport } from '../../utils/sidepanel.util';
import { STORAGE_KEY_API_KEY, STORAGE_KEY_THEME, THEME_DARK, THEME_LIGHT } from '../../constants';
import { MessageType } from '../../types/message.types';
import type { Language, ViewMode } from '../../types/storage.types';
import { router } from '../router';

// ── HTML 템플릿 ───────────────────────────────────────────

export function getSettingsPageHTML(mode: ViewMode = 'popup'): string {
  // mode에 따라 전환 버튼 렌더링 분기
  const switchBtnHTML = mode === 'popup'
    ? `<!-- SidePanel 전환 버튼 (Popup → SidePanel) -->
          <button class="header-btn header-btn-icon" id="switch-mode-btn" aria-label="Open as Side Panel" title="${t('settings', 'switchToSidePanel')}">
            <span class="material-symbols-outlined" style="font-size:20px">side_navigation</span>
          </button>`
    : `<!-- Popup 전환 버튼 (SidePanel → Popup) -->
          <button class="settings-theme-btn" id="switch-mode-btn" aria-label="Switch to Popup" title="${t('settings', 'switchToPopup')}">
            <span class="material-icons" style="font-size:18px">picture_in_picture</span>
          </button>`;

  return `
    <div class="settings-page">

      <!-- 헤더 -->
      <div class="settings-header">
        <button id="settings-back-btn" class="settings-back-btn" title="Back">
          <span class="material-icons">arrow_back</span>
        </button>
        <span class="settings-title" id="settings-title-label">Settings</span>

        <div class="settings-header-right">
          <!-- 언어 드롭다운 -->
          <div class="lang-dropdown-wrapper">
            <button class="lang-btn" id="lang-btn" aria-haspopup="true" aria-expanded="false">
              <span class="material-icons icon-sm">language</span>
              <span id="lang-label">Language</span>
              <span class="material-icons icon-xs">expand_more</span>
            </button>
            <div class="lang-menu" id="lang-menu" role="menu">
              <ul>
                <li><a href="#" class="lang-item" data-lang="en" role="menuitem">English</a></li>
                <li><a href="#" class="lang-item" data-lang="ko" role="menuitem">한국어</a></li>
                <li><a href="#" class="lang-item" data-lang="ja" role="menuitem">日本語</a></li>
                <li><a href="#" class="lang-item" data-lang="zh" role="menuitem">中文</a></li>
              </ul>
            </div>
          </div>

          ${switchBtnHTML}

          <!-- 다크모드 토글 -->
          <button class="settings-theme-btn" id="settings-theme-btn" aria-label="Toggle dark mode">
            <span class="material-icons settings-theme-icon-light">dark_mode</span>
            <span class="material-icons settings-theme-icon-dark">light_mode</span>
          </button>
        </div>
      </div>

      <!-- 본문 -->
      <div class="settings-body">
        <div class="settings-title-wrap">
          <h1 class="settings-main-title" id="settings-main-title">YouTube Timestamp Comments</h1>
          <p class="settings-subtitle" id="settings-subtitle">Enhance your viewing experience with timestamped notes.</p>
        </div>

        <div class="settings-form-group">
          <label class="settings-label" id="settings-api-label" for="settings-api-key">API Key</label>
          <div class="settings-input-wrapper">
            <input
              class="settings-input"
              id="settings-api-key"
              type="password"
              placeholder="Enter your API Key here"
              autocomplete="off"
            />
            <button class="settings-visibility-btn" id="settings-visibility-btn" type="button">
              <span class="material-icons" id="settings-eye-icon">visibility</span>
            </button>
          </div>
        </div>

        <!-- SidePanel 에러 메시지 (Chrome 버전 미지원 시) -->
        <p class="settings-save-message hidden" id="sidepanel-error-message"></p>

        <p class="settings-save-message hidden" id="settings-save-message"></p>

        <button class="settings-save-btn" id="settings-save-btn" type="button">Set up</button>

        <div class="settings-footer">
          <p class="settings-footer-text">
            <span id="settings-guide-text">Need help finding your API Key?</span>
            <a
              class="settings-footer-link"
              id="settings-guide-link"
              href="https://developers.google.com/youtube/v3/getting-started"
              target="_blank"
              rel="noopener noreferrer"
            >
              Read the guide
              <span class="material-icons icon-xs">open_in_new</span>
            </a>
          </p>
        </div>
      </div>

    </div>
  `;
}

// ── 헬퍼 ──────────────────────────────────────────────────

function getEl<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id) as T | null;
  if (!el) throw new Error(`SettingsPage: #${id} not found`);
  return el;
}

// ── 언어별 가이드 링크 ────────────────────────────────────

const GUIDE_LINKS: Record<string, string> = {
  en: 'https://github.com/kjungw1025/youtube-timestamp-comments/blob/main/README.md#api-key-setup',
  ko: 'https://github.com/kjungw1025/youtube-timestamp-comments/blob/main/README-ko_kr.md#api-key-setup',
  ja: 'https://github.com/kjungw1025/youtube-timestamp-comments/blob/main/README-ja_jp.md#api-key-setup',
  zh: 'https://github.com/kjungw1025/youtube-timestamp-comments/blob/main/README-zh_hans.md#api-key-setup',
};

// ── i18n 적용 ─────────────────────────────────────────────

function applyI18n(apiKeyInput: HTMLInputElement): void {
  const mainTitle = document.getElementById('settings-main-title');
  const subtitle  = document.getElementById('settings-subtitle');
  const apiLabel  = document.getElementById('settings-api-label');
  const saveBtn   = document.getElementById('settings-save-btn');
  const guideText = document.getElementById('settings-guide-text');
  const guideLink = document.getElementById('settings-guide-link') as HTMLAnchorElement | null;
  const switchBtn = document.getElementById('switch-mode-btn');

  if (mainTitle)  mainTitle.textContent  = t('options', 'title');
  if (subtitle)   subtitle.textContent   = t('options', 'subtitle');
  if (apiLabel)   apiLabel.textContent   = t('options', 'apiKeyLabel');
  if (saveBtn)    saveBtn.textContent    = t('options', 'setupButton');
  if (guideText)  guideText.textContent  = t('options', 'guideText');
  if (switchBtn) {
    // mode에 따라 title 속성 갱신
    const isPopup = switchBtn.getAttribute('aria-label') === 'Open as Side Panel';
    switchBtn.title = isPopup
      ? t('settings', 'switchToSidePanel')
      : t('settings', 'switchToPopup');
  }
  if (guideLink) {
    const textNode = Array.from(guideLink.childNodes).find((n) => n.nodeType === Node.TEXT_NODE);
    if (textNode) textNode.textContent = t('options', 'guideLink') + ' ';
    const lang = getCurrentLanguage();
    guideLink.href = GUIDE_LINKS[lang] ?? GUIDE_LINKS['en'];
  }

  apiKeyInput.placeholder = t('options', 'apiKeyPlaceholder');
}

function updateActiveLangItem(langLabel: HTMLElement): void {
  const current = getCurrentLanguage();
  document.querySelectorAll<HTMLAnchorElement>('.lang-item').forEach((el) => {
    el.classList.toggle('active', el.dataset.lang === current);
  });
  const found = getSupportedLanguages().find((l) => l.code === current);
  if (found) langLabel.textContent = found.label;
}

// ── SidePanel 전환 안내 화면 ──────────────────────────────

function showSwitchToPopupMessage(root: HTMLElement): void {
  root.innerHTML = `
    <div style="
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100vh;
      gap: 16px;
      text-align: center;
      padding: 24px;
      background: var(--bg-surface);
      color: var(--text-primary);
    ">
      <span class="material-icons" style="font-size:48px; color: var(--color-primary);">check_circle</span>
      <div>
        <p style="font-size:15px; font-weight:600; margin-bottom:8px;" id="switched-title"></p>
        <p style="font-size:13px; color: var(--text-secondary); line-height:1.6;" id="switched-guide"></p>
      </div>
      <p style="font-size:11px; color: var(--text-muted); margin-top:8px;" id="switched-hint"></p>
    </div>
  `;
  const titleEl = document.getElementById('switched-title');
  const guideEl = document.getElementById('switched-guide');
  const hintEl  = document.getElementById('switched-hint');
  if (titleEl) titleEl.textContent = t('settings', 'switchedToPopup');
  if (guideEl) guideEl.textContent = t('settings', 'switchedToPopupGuide');
  if (hintEl)  hintEl.textContent  = 'Please close this panel manually.';
}

// ── 마운트 ────────────────────────────────────────────────

export function mountSettingsPage(root: HTMLElement, mode: ViewMode = 'popup'): void {
  root.innerHTML = getSettingsPageHTML(mode);

  const backBtn        = getEl('settings-back-btn');
  const apiKeyInput    = getEl<HTMLInputElement>('settings-api-key');
  const visibilityBtn  = getEl('settings-visibility-btn');
  const eyeIcon        = getEl('settings-eye-icon');
  const saveBtn        = getEl('settings-save-btn');
  const saveMsg        = getEl('settings-save-message');
  const sidepanelErrEl = getEl('sidepanel-error-message');
  const langBtn        = getEl('lang-btn');
  const langMenu       = getEl('lang-menu');
  const langLabel      = getEl('lang-label');
  const themeBtn       = getEl('settings-theme-btn');
  const switchModeBtn  = getEl('switch-mode-btn');

  // 저장된 API Key 로드
  void getStorage(STORAGE_KEY_API_KEY).then((key) => {
    if (key) apiKeyInput.value = key;
  });

  // i18n 초기 적용
  applyI18n(apiKeyInput);
  updateActiveLangItem(langLabel);

  // ── API Key 저장 ────────────────────────────────────────

  let saveTimeout: number;

  function showSaveMsg(text: string, type: 'success' | 'error'): void {
    clearTimeout(saveTimeout);
    saveMsg.textContent = text;
    saveMsg.className = `settings-save-message ${type}`;
    saveTimeout = window.setTimeout(() => {
      saveMsg.className = 'settings-save-message hidden';
    }, 3000);
  }

  async function saveApiKey(): Promise<void> {
    const key = apiKeyInput.value.trim();
    if (!key) { showSaveMsg(t('options', 'errorEmptyKey'), 'error'); return; }
    await setStorage({ [STORAGE_KEY_API_KEY]: key });
    showSaveMsg(t('options', 'savedMessage'), 'success');
  }

  saveBtn.addEventListener('click', () => { void saveApiKey(); });
  apiKeyInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') void saveApiKey(); });

  // ── 비밀번호 토글 ───────────────────────────────────────

  visibilityBtn.addEventListener('click', () => {
    const isPass = apiKeyInput.type === 'password';
    apiKeyInput.type = isPass ? 'text' : 'password';
    eyeIcon.textContent = isPass ? 'visibility_off' : 'visibility';
  });

  // ── 다크모드 토글 ───────────────────────────────────────

  themeBtn.addEventListener('click', () => {
    const isDark = document.documentElement.classList.toggle('dark');
    void setStorage({ [STORAGE_KEY_THEME]: isDark ? THEME_DARK : THEME_LIGHT });
  });

  // ── 언어 드롭다운 ───────────────────────────────────────

  function openLangMenu(): void  { langMenu.classList.add('open');    langBtn.setAttribute('aria-expanded', 'true');  }
  function closeLangMenu(): void { langMenu.classList.remove('open'); langBtn.setAttribute('aria-expanded', 'false'); }

  langBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    langMenu.classList.contains('open') ? closeLangMenu() : openLangMenu();
  });

  document.querySelectorAll<HTMLAnchorElement>('.lang-item').forEach((el) => {
    el.addEventListener('click', (e) => {
      e.preventDefault();
      const lang = el.dataset.lang as Language;
      if (!lang) return;
      void setLanguage(lang).then(() => {
        closeLangMenu();
        updateActiveLangItem(langLabel);
        applyI18n(apiKeyInput);
      });
    });
  });

  function onDocumentClick(e: MouseEvent): void {
    if (!langBtn.contains(e.target as Node) && !langMenu.contains(e.target as Node)) {
      closeLangMenu();
    }
  }
  document.addEventListener('click', onDocumentClick);

  // ── 모드 전환 버튼 ──────────────────────────────────────

  if (mode === 'popup') {
    // Popup → SidePanel 전환
    switchModeBtn.addEventListener('click', async () => {
      // Chrome 버전 및 sidePanel API 지원 확인
      const support = checkSidePanelSupport();
      if (!support.isSupported) {
        const msg = (support.message ?? t('settings', 'errorSidePanelNotSupported'))
          .replace('{version}', String(support.version ?? ''));
        sidepanelErrEl.textContent = msg;
        sidepanelErrEl.className = 'settings-save-message error';
        return;
      }

      try {
        // ✅ sidePanel.open()은 반드시 user gesture 컨텍스트(popup)에서 직접 호출해야 함
        // sendMessage를 거치면 user gesture로 인정되지 않아 오류 발생
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab?.id === undefined) {
          sidepanelErrEl.textContent = 'Could not get current tab.';
          sidepanelErrEl.className = 'settings-save-message error';
          return;
        }

        await chrome.sidePanel.open({ tabId: tab.id });

        // 모드 저장은 background에 위임 (sidePanel.open() 이후이므로 순서 무관)
        void chrome.runtime.sendMessage({ type: MessageType.SAVE_SIDEPANEL_MODE });

        window.close();
      } catch (e) {
        console.error('[SettingsPage] Failed to open Side Panel:', e);
        sidepanelErrEl.textContent = 'Failed to open Side Panel. Please try again.';
        sidepanelErrEl.className = 'settings-save-message error';
      }
    });
  } else {
    // SidePanel → Popup 전환
    switchModeBtn.addEventListener('click', async () => {
      switchModeBtn.setAttribute('disabled', 'true');
      try {
        const response = await chrome.runtime.sendMessage({ type: MessageType.SWITCH_TO_POPUP });
        if (response?.payload?.success) {
          document.removeEventListener('click', onDocumentClick);
          showSwitchToPopupMessage(root);
        } else {
          switchModeBtn.removeAttribute('disabled');
        }
      } catch (e) {
        console.error('[SettingsPage] Failed to switch to Popup:', e);
        switchModeBtn.removeAttribute('disabled');
      }
    });
  }

  // ── 뒤로가기 ────────────────────────────────────────────

  backBtn.addEventListener('click', () => {
    document.removeEventListener('click', onDocumentClick);
    router.navigate('/');
  }, { once: true });
}
