// ===== Pyodide 클라이언트 (메인 스레드) =====
// 워커에게 코드 실행을 맡기고, 일정 시간(TIMEOUT_MS) 안에 응답이 없으면
// 무한 루프로 간주해 워커를 강제 종료하고 새로 띄운다.

const PYODIDE_TIMEOUT_MS = 4000;

let worker = null;
let msgId = 0;
const pending = new Map();

function createWorker() {
  worker = new Worker("assets/js/pyodide-worker.js");
  worker.onmessage = (e) => {
    const { id } = e.data;
    const entry = pending.get(id);
    if (!entry) return;
    clearTimeout(entry.timer);
    pending.delete(id);
    entry.resolve(e.data);
  };
  worker.onerror = (e) => {
    // 워커 자체 오류 - 대기 중인 모든 요청을 실패 처리
    for (const [id, entry] of pending) {
      clearTimeout(entry.timer);
      entry.resolve({ ok: false, error: "실행 환경 오류: " + e.message });
    }
    pending.clear();
  };
}

createWorker();

/**
 * 파이썬 코드를 실행하고 결과를 반환한다.
 * @param {string} code
 * @param {string[]} [loadPackages] - 이 실행에 필요한 추가 pyodide 패키지(예: ["pandas"])
 * @returns {Promise<{ok:boolean, stdout?:string, stderr?:string, error?:string, timedOut?:boolean}>}
 */
function runPython(code, loadPackages) {
  const id = ++msgId;
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      pending.delete(id);
      // 응답이 없으면(무한 루프 등) 워커를 통째로 종료하고 재생성한다.
      worker.terminate();
      createWorker();
      resolve({ ok: false, timedOut: true, error: "실행 시간이 너무 깁니다. (무한 루프 여부를 확인해 보세요)" });
    }, PYODIDE_TIMEOUT_MS);

    pending.set(id, { resolve, timer });
    worker.postMessage({ id, code, loadPackages });
  });
}
