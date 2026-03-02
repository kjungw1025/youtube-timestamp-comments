// Background Service Worker
// API 키를 chrome.storage.local에서 읽어 YouTube API 호출을 대리 처리한다.
// SidePanel 모드 전환 메시지도 여기서 처리한다.

import { fetchCommentThreads, fetchReplies, YouTubeApiError } from '../services/youtube.service';
import { getStorage } from '../utils/storage.util';
import { setViewMode } from '../utils/sidepanel.util';
import { STORAGE_KEY_API_KEY, VIEW_MODE_POPUP, VIEW_MODE_SIDEPANEL } from '../constants';
import { MessageType, ErrorCode } from '../types/message.types';
import type {
  RequestMessage,
  FetchCommentsRequest,
  FetchRepliesRequest,
  ResponseMessage,
} from '../types/message.types';

// ── 초기화 ────────────────────────────────────────────────

// 최초 설치 시 viewMode를 'popup'으로 초기화하고 popup을 action에 연결
chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === 'install') {
    await setViewMode(VIEW_MODE_POPUP);
    await applyPopupMode();
  }
});



// ── 메시지 핸들러 ──────────────────────────────────────────

chrome.runtime.onMessage.addListener(
  (
    message: RequestMessage,
    _sender: chrome.runtime.MessageSender,
    sendResponse: (response: ResponseMessage) => void,
  ) => {
    void handleMessage(message, sendResponse);
    // 비동기 응답을 위해 true 반환
    return true;
  },
);

async function handleMessage(
  message: RequestMessage,
  sendResponse: (response: ResponseMessage) => void,
): Promise<void> {
  switch (message.type) {
    case MessageType.FETCH_COMMENTS:
      await handleFetchComments(message, sendResponse);
      break;

    case MessageType.FETCH_REPLIES:
      await handleFetchReplies(message, sendResponse);
      break;

    case MessageType.GET_VIDEO_ID:
      // Popup → Content Script 직접 쿼리 방식으로 처리하므로
      // Background에서는 포트 에러 방지를 위해 빈 응답만 반환
      sendResponse({
        type: MessageType.GET_VIDEO_ID,
        payload: { videoId: null },
      });
      break;

    case MessageType.SAVE_SIDEPANEL_MODE:
      // Popup에서 sidePanel.open() 직접 호출 후 모드 저장만 위임받음
      // (sidePanel.open()은 user gesture 컨텍스트인 popup에서 직접 호출해야 하므로)
      await handleSaveSidePanelMode(sendResponse);
      break;

    case MessageType.SWITCH_TO_POPUP:
      await handleSwitchToPopup(sendResponse);
      break;

    default:
      sendResponse({
        type: MessageType.ERROR,
        error: 'Unknown message type.',
      });
  }
}

// ── API 키 조회 헬퍼 ───────────────────────────────────────

/**
 * chrome.storage.local에서 API 키를 읽어 반환
 * API 키가 없으면 null 반환
 */
async function getApiKey(): Promise<string | null> {
  const apiKey = await getStorage(STORAGE_KEY_API_KEY);
  return apiKey ?? null;
}

// ── 공통 에러 응답 상수 ────────────────────────────────────

const NO_API_KEY_ERROR: ResponseMessage = {
  type: MessageType.ERROR,
  error: 'API Key is not set. Please go to Settings.',
  code: 401,
  errorCode: ErrorCode.NO_API_KEY,
};

// ── FETCH_COMMENTS 처리 ────────────────────────────────────

async function handleFetchComments(
  message: FetchCommentsRequest,
  sendResponse: (response: ResponseMessage) => void,
): Promise<void> {
  try {
    const apiKey = await getApiKey();

    if (!apiKey) {
      sendResponse(NO_API_KEY_ERROR);
      return;
    }

    const { videoId, order, pageToken } = message.payload;
    const result = await fetchCommentThreads(videoId, apiKey, order, pageToken);

    sendResponse({
      type: MessageType.FETCH_COMMENTS,
      payload: {
        items: result.items,
        nextPageToken: result.nextPageToken,
      },
    });
  } catch (err) {
    sendResponse(buildErrorResponse(err));
  }
}

// ── FETCH_REPLIES 처리 ─────────────────────────────────────

async function handleFetchReplies(
  message: FetchRepliesRequest,
  sendResponse: (response: ResponseMessage) => void,
): Promise<void> {
  try {
    const apiKey = await getApiKey();

    if (!apiKey) {
      sendResponse(NO_API_KEY_ERROR);
      return;
    }

    const { parentId } = message.payload;
    const result = await fetchReplies(parentId, apiKey);

    sendResponse({
      type: MessageType.FETCH_REPLIES,
      payload: {
        items: result.items,
      },
    });
  } catch (err) {
    sendResponse(buildErrorResponse(err));
  }
}

// ── SAVE_SIDEPANEL_MODE 처리 ───────────────────────────────

async function handleSaveSidePanelMode(
  sendResponse: (response: ResponseMessage) => void,
): Promise<void> {
  try {
    await applySidePanelMode();
    sendResponse({
      type: MessageType.SAVE_SIDEPANEL_MODE,
      payload: { success: true },
    });
  } catch (e) {
    console.error('[background] SAVE_SIDEPANEL_MODE 실패:', e);
    sendResponse({ type: MessageType.ERROR, error: 'Failed to save sidepanel mode.' });
  }
}

// ── SWITCH_TO_POPUP 처리 ───────────────────────────────────

async function handleSwitchToPopup(
  sendResponse: (response: ResponseMessage) => void,
): Promise<void> {
  try {
    await applyPopupMode();
    sendResponse({
      type: MessageType.SWITCH_TO_POPUP,
      payload: { success: true },
    });
  } catch (e) {
    console.error('[background] SWITCH_TO_POPUP 실패:', e);
    sendResponse({ type: MessageType.ERROR, error: 'Failed to switch to popup mode.' });
  }
}

// ── 모드 적용 함수 ─────────────────────────────────────────

/** popup 모드: action에 popup 연결, sidePanel 동작 비활성화 */
async function applyPopupMode(): Promise<void> {
  await setViewMode(VIEW_MODE_POPUP);
  await chrome.action.setPopup({ popup: 'popup/popup.html' });
  if (chrome.sidePanel?.setPanelBehavior) {
    await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false });
  }
}

/** sidepanel 모드: action의 popup 제거 → openPanelOnActionClick으로 자동 열기 */
async function applySidePanelMode(): Promise<void> {
  await setViewMode(VIEW_MODE_SIDEPANEL);
  await chrome.action.setPopup({ popup: '' });
  if (chrome.sidePanel?.setPanelBehavior) {
    // openPanelOnActionClick: true → 아이콘 클릭 시 Chrome이 자동으로 SidePanel을 열어줌
    // background에서 sidePanel.open()을 직접 호출하면 user gesture 오류 발생하므로 이 방식을 사용
    await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
  }
}

// ── 에러 응답 빌더 ─────────────────────────────────────────

function buildErrorResponse(err: unknown): ResponseMessage {
  if (err instanceof YouTubeApiError) {
    return {
      type: MessageType.ERROR,
      error: err.message,
      code: err.code,
    };
  }
  return {
    type: MessageType.ERROR,
    error: err instanceof Error ? err.message : 'An unexpected error occurred.',
  };
}
