// ===== 공통 설정 파일 =====
// 구글 앱스 스크립트를 웹앱으로 배포한 뒤 나오는 URL을 여기에 붙여넣으세요.
// (appsscript/README.md 참고)
const APPS_SCRIPT_URL = "여기에_배포된_앱스스크립트_웹앱_URL을_붙여넣으세요";

// 전체 스테이지 목록 (허브 페이지, 스테이지 이동에 공통 사용)
const STAGE_LIST = [
  { id: "stage1_variables", order: 1, chapter: "3단원 · 변수와 자료형", title: "시작의 마을 - 캐릭터 각성", file: "data/stages/stage1_variables.json" },
  { id: "stage2_datatypes",  order: 2, chapter: "3단원 · 변수와 자료형", title: "시작의 마을 - 스탯 창",       file: "data/stages/stage2_datatypes.json" },
  { id: "stage3_operators",  order: 3, chapter: "3단원 · 연산자",       title: "연산의 관문",                 file: "data/stages/stage3_operators.json" },
  { id: "stage4_io",        order: 4, chapter: "3단원 · 표준입출력",     title: "대화의 숲",                   file: "data/stages/stage4_io.json" },
  { id: "stage5_fileio",    order: 5, chapter: "3단원 · 파일입출력",     title: "기억의 동굴",                 file: "data/stages/stage5_fileio.json" },
  { id: "stage6_list1d",    order: 6, chapter: "3단원 · 1차원 리스트",   title: "창고 마을",                   file: "data/stages/stage6_list1d.json" },
  { id: "stage7_list2d",    order: 7, chapter: "3단원 · 2차원 리스트",   title: "지도의 탑",                   file: "data/stages/stage7_list2d.json" },
  { id: "stage8_conditional1", order: 8, chapter: "4단원 · 조건문",      title: "갈림길 신전 Ⅰ",               file: "data/stages/stage8_conditional1.json" },
  { id: "stage9_conditional2", order: 9, chapter: "4단원 · 다중 조건문", title: "갈림길 신전 Ⅱ",               file: "data/stages/stage9_conditional2.json" }
];

function getStageMeta(stageId) {
  return STAGE_LIST.find(s => s.id === stageId);
}
