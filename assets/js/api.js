// ===== 앱스 스크립트 백엔드 호출 공통 모듈 =====
// 구글 앱스 스크립트 웹앱은 application/json 요청 시 브라우저가 사전 확인(preflight) 요청을
// 보내면서 CORS 오류가 나는 경우가 많아, text/plain으로 보내고 서버에서 JSON.parse 한다.

async function callApi(action, payload) {
  const res = await fetch(APPS_SCRIPT_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({ action, ...payload })
  });
  if (!res.ok) {
    throw new Error("서버 응답 오류: " + res.status);
  }
  return res.json();
}

// 학생이 문제를 제출했을 때
function submitAnswer({ stageId, questionId, optionIds, student }) {
  return callApi("submit", { stageId, questionId, optionIds, student });
}

// 허브 공개 여부 등 공개 설정 조회 (누구나 조회 가능)
function getPublicSettings() {
  return callApi("getSettings", {});
}

// 교사 PIN 확인
function verifyTeacherPin(pin) {
  return callApi("verifyPin", { pin });
}

// 허브 공개 여부 토글 (PIN 필요)
function setHubPublic(pin, isPublic) {
  return callApi("setHubPublic", { pin, isPublic });
}

// 교사 대시보드 데이터 조회 (PIN 필요)
function getDashboardData(pin) {
  return callApi("getDashboard", { pin });
}
