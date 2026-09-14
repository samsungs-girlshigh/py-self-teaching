/**
 * ===== 코드 대륙 모험기 - 백엔드 (Google Apps Script) =====
 *
 * 이 스크립트는 구글 시트에 "바인딩(연결)"해서 사용합니다.
 * 설치 방법은 appsscript/README.md 를 참고하세요.
 *
 * 제공 기능
 *  - submit        : 학생의 문제 제출을 채점하고 시트에 기록
 *  - getSettings   : 허브 페이지 공개 여부 등 공개 설정 조회 (누구나 가능)
 *  - verifyPin     : 교사 PIN 확인
 *  - setHubPublic  : 허브 공개 여부 토글 (PIN 필요)
 *  - getDashboard  : 교사 대시보드 데이터 조회 (PIN 필요)
 */

// ---------- 설정 ----------

// 정답 목록: 각 스테이지 > 각 문항 > 정답으로 인정할 보기 id 배열 (복수 정답 허용)
const ANSWER_KEY = {
  stage1_variables: {
    q1: ["opt_eq"],
    q2: ["opt_mul", "opt_add"]
  },
  stage2_datatypes: {
    q1: ["opt_double", "opt_single"],
    q2: ["opt_var"]
  },
  stage3_operators: {
    q1: ["opt_a", "opt_d"],
    q2: ["opt_a", "opt_d"]
  },
  stage4_io: {
    q1: ["opt_input"],
    q2: ["opt_int_input", "opt_float_input"]
  },
  stage5_fileio: {
    q1: ["opt_append"],
    q2: ["opt_correct"]
  },
  stage6_list1d: {
    q1: ["opt_append"],
    q2: ["opt_remove"],
    q3: ["opt_sort"]
  },
  stage7_list2d: {
    q1: ["opt_correct"],
    q2: ["opt_correct"]
  },
  stage8_conditional1: {
    q1: ["opt_correct"],
    q2: ["opt_correct"]
  },
  stage9_conditional2: {
    q1: ["opt_correct"],
    q2: ["opt_correct"]
  },
  stage10_loops: {
    q1: ["opt_correct"],
    q2: ["opt_correct"]
  },
  stage11_breakcontinue: {
    q1: ["opt_correct"],
    q2: ["opt_correct"]
  },
  stage12_sorting: {
    q1: ["opt_correct"],
    q2: ["opt_correct"]
  },
  stage13_functions: {
    q1: ["opt_correct"],
    q2: ["opt_correct"]
  },
  stage14_scope: {
    q1: ["opt_correct"],
    q2: ["opt_correct"]
  },
  stage15_search: {
    q1: ["opt_correct"],
    q2: ["opt_correct"]
  },
  stage16_modules: {
    q1: ["opt_correct"],
    q2: ["opt_correct"]
  },
  stage18_oop: {
    q1: ["opt_correct"],
    q2: ["opt_correct"]
  }
};

const STUDENT_LIST_SHEET = "학생명단";
const SETTINGS_SHEET = "설정";
const STAGE_HEADERS = [
  "학년", "반", "번호", "이름", "문항ID",
  "제출횟수", "정답여부", "최초제출시각", "최종제출시각", "소요시간(초)"
];

// ---------- 진입점 ----------

function doGet(e) {
  // 배포 URL을 브라우저로 직접 열어 상태를 확인할 때를 위한 안내용 응답.
  // 실제 프론트엔드(api.js)는 이 함수가 아니라 doPost만 사용한다.
  return ContentService
    .createTextOutput(JSON.stringify({ ok: true, message: "코드 대륙 모험기 백엔드가 정상적으로 배포되어 있습니다. (이 주소는 POST 요청 전용입니다)" }))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  let result;
  try {
    const body = JSON.parse(e.postData.contents);
    switch (body.action) {
      case "submit":
        result = handleSubmit(body);
        break;
      case "getSettings":
        result = handleGetSettings();
        break;
      case "verifyPin":
        result = handleVerifyPin(body);
        break;
      case "setHubPublic":
        result = handleSetHubPublic(body);
        break;
      case "setStageOpen":
        result = handleSetStageOpen(body);
        break;
      case "getDashboard":
        result = handleGetDashboard(body);
        break;
      default:
        result = { error: "알 수 없는 요청입니다: " + body.action };
    }
  } catch (err) {
    result = { error: String(err) };
  }
  return ContentService
    .createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

// ---------- 학생 제출 처리 ----------

function handleSubmit(body) {
  const { stageId, questionId, optionIds, student } = body;

  if (!ANSWER_KEY[stageId] || !ANSWER_KEY[stageId][questionId]) {
    return { error: "존재하지 않는 문항입니다." };
  }
  if (!student || !student.grade || !student.classNo || !student.number || !student.name) {
    return { error: "학생 정보가 올바르지 않습니다." };
  }

  const settingsSheet = getOrCreateSheet(SETTINGS_SHEET, ["key", "value"]);
  if (!isStageOpen(stageId, settingsSheet)) {
    return { error: "아직 열리지 않은 스테이지입니다.", locked: true };
  }

  const correctSet = ANSWER_KEY[stageId][questionId];
  const isCorrect = optionIds.some(id => correctSet.indexOf(id) !== -1);

  // 동시 제출로 인한 데이터 꼬임을 막기 위해 잠금을 건다.
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const sheet = getOrCreateSheet(stageId, STAGE_HEADERS);
    const data = sheet.getDataRange().getValues();
    const now = new Date();

    let rowIndex = -1;
    for (let i = 1; i < data.length; i++) {
      const r = data[i];
      if (
        String(r[0]) === String(student.grade) &&
        String(r[1]) === String(student.classNo) &&
        String(r[2]) === String(student.number) &&
        String(r[3]) === String(student.name) &&
        String(r[4]) === String(questionId)
      ) {
        rowIndex = i;
        break;
      }
    }

    if (rowIndex === -1) {
      sheet.appendRow([
        student.grade, student.classNo, student.number, student.name, questionId,
        1, isCorrect, now, now, 0
      ]);
    } else {
      const sheetRow = rowIndex + 1; // 1-indexed, +1 for header already accounted in data array offset
      const prevCount = Number(data[rowIndex][5]) || 0;
      const prevCorrect = data[rowIndex][6] === true;
      const firstTime = data[rowIndex][7] || now;
      const finalCorrect = isCorrect || prevCorrect; // 한 번이라도 맞히면 정답으로 유지
      const elapsedSec = (now.getTime() - new Date(firstTime).getTime()) / 1000;

      sheet.getRange(sheetRow, 6).setValue(prevCount + 1);       // 제출횟수
      sheet.getRange(sheetRow, 7).setValue(finalCorrect);        // 정답여부
      sheet.getRange(sheetRow, 9).setValue(now);                 // 최종제출시각
      sheet.getRange(sheetRow, 10).setValue(elapsedSec);         // 소요시간(초)
    }
  } finally {
    lock.releaseLock();
  }

  return {
    correct: isCorrect,
    hint: isCorrect ? "" : "빈칸에 들어갈 코드를 다시 살펴보세요."
  };
}

// ---------- 공개 설정 ----------

// 스테이지별 공개 여부 기본값: 1단계만 항상 공개, 나머지는 교사가 열어주기 전까지 비공개.
const ALWAYS_OPEN_STAGE = "stage1_variables";

function getStageOpenMap(settingsSheet) {
  const map = {};
  Object.keys(ANSWER_KEY).forEach(stageId => {
    if (stageId === ALWAYS_OPEN_STAGE) {
      map[stageId] = true;
      return;
    }
    const value = getSettingValue(settingsSheet, "stageOpen_" + stageId);
    // 설정이 아예 없으면(교사가 아직 건드리지 않은 스테이지) 기본값은 비공개.
    map[stageId] = value === "TRUE" || value === true;
  });
  return map;
}

function isStageOpen(stageId, settingsSheet) {
  if (stageId === ALWAYS_OPEN_STAGE) return true;
  const value = getSettingValue(settingsSheet, "stageOpen_" + stageId);
  return value === "TRUE" || value === true;
}

function handleGetSettings() {
  const sheet = getOrCreateSheet(SETTINGS_SHEET, ["key", "value"]);
  const value = getSettingValue(sheet, "hubPublic");
  return {
    hubPublic: value === "TRUE" || value === true,
    stageOpen: getStageOpenMap(sheet)
  };
}

function handleVerifyPin(body) {
  return { ok: checkPin(body.pin) };
}

function handleSetHubPublic(body) {
  if (!checkPin(body.pin)) {
    return { error: "PIN이 올바르지 않습니다." };
  }
  const sheet = getOrCreateSheet(SETTINGS_SHEET, ["key", "value"]);
  setSettingValue(sheet, "hubPublic", body.isPublic ? "TRUE" : "FALSE");
  return { ok: true, hubPublic: !!body.isPublic };
}

function handleSetStageOpen(body) {
  if (!checkPin(body.pin)) {
    return { error: "PIN이 올바르지 않습니다." };
  }
  if (body.stageId === ALWAYS_OPEN_STAGE) {
    return { error: "1단계는 항상 공개 상태이며 잠글 수 없습니다." };
  }
  if (!ANSWER_KEY[body.stageId]) {
    return { error: "존재하지 않는 스테이지입니다." };
  }
  const sheet = getOrCreateSheet(SETTINGS_SHEET, ["key", "value"]);
  setSettingValue(sheet, "stageOpen_" + body.stageId, body.isOpen ? "TRUE" : "FALSE");
  return { ok: true, stageOpen: getStageOpenMap(sheet) };
}

// ---------- 교사 대시보드 ----------

function handleGetDashboard(body) {
  if (!checkPin(body.pin)) {
    return { error: "PIN이 올바르지 않습니다." };
  }

  const totalStudents = getTotalStudentCount();
  const stages = [];

  Object.keys(ANSWER_KEY).forEach(stageId => {
    const totalQuestions = Object.keys(ANSWER_KEY[stageId]).length;
    const sheet = getOrCreateSheet(stageId, STAGE_HEADERS);
    const data = sheet.getDataRange().getValues();

    // 학생별로 (정답 문항 수, 제출횟수, 마지막 제출시각) 집계
    const perStudent = {}; // key -> {grade,classNo,number,name,correctCount,attempts,lastTime}

    for (let i = 1; i < data.length; i++) {
      const r = data[i];
      const key = [r[0], r[1], r[2], r[3]].join("|");
      if (!perStudent[key]) {
        perStudent[key] = {
          grade: r[0], classNo: r[1], number: r[2], name: r[3],
          correctCount: 0, attempts: 0, lastTime: r[8]
        };
      }
      perStudent[key].attempts += Number(r[5]) || 0;
      if (r[6] === true) perStudent[key].correctCount += 1;
      if (r[8] && (!perStudent[key].lastTime || new Date(r[8]) > new Date(perStudent[key].lastTime))) {
        perStudent[key].lastTime = r[8];
      }
    }

    const students = Object.values(perStudent).map(s => ({
      ...s,
      rate: totalQuestions ? Math.round((s.correctCount / totalQuestions) * 100) : 0,
      reached: s.correctCount >= totalQuestions
    }));

    const reachedCount = students.filter(s => s.reached).length;

    stages.push({
      stageId,
      totalQuestions,
      totalStudents,
      reachedCount,
      reachedRate: totalStudents ? Math.round((reachedCount / totalStudents) * 100) : 0,
      students
    });
  });

  return { stages };
}

function getTotalStudentCount() {
  const sheet = getOrCreateSheet(STUDENT_LIST_SHEET, ["학년", "반", "번호", "이름"]);
  const lastRow = sheet.getLastRow();
  return Math.max(0, lastRow - 1);
}

// ---------- 공통 유틸 ----------

function getOrCreateSheet(name, headers) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.appendRow(headers);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function getSettingValue(sheet, key) {
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === key) return data[i][1];
  }
  return null;
}

function setSettingValue(sheet, key, value) {
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === key) {
      sheet.getRange(i + 1, 2).setValue(value);
      return;
    }
  }
  sheet.appendRow([key, value]);
}

function checkPin(pin) {
  const stored = PropertiesService.getScriptProperties().getProperty("ADMIN_PIN");
  return stored && pin && String(pin) === String(stored);
}

/**
 * 최초 설치 시 딱 한 번만 실행하세요.
 * (Apps Script 편집기에서 이 함수를 선택하고 '실행' 버튼을 누르면 됩니다)
 * 원하는 PIN 번호로 바꿔서 실행하세요.
 */
function setupAdminPin() {
  const myPin = "1234"; // TODO: 원하는 PIN으로 변경 후 실행하세요
  PropertiesService.getScriptProperties().setProperty("ADMIN_PIN", myPin);
}
