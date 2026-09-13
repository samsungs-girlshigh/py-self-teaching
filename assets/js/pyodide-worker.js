// ===== Pyodide 실행 워커 =====
// 메인 화면이 멈추지 않도록 Web Worker 안에서 파이썬 코드를 실행한다.
// 무한 루프 등으로 응답이 없으면 메인 스레드가 이 워커를 통째로 종료(terminate)하고 새로 만든다.

importScripts("https://cdn.jsdelivr.net/pyodide/v0.26.4/full/pyodide.js");

let pyodideReadyPromise = null;

async function initPyodide() {
  if (!pyodideReadyPromise) {
    pyodideReadyPromise = loadPyodide({
      indexURL: "https://cdn.jsdelivr.net/pyodide/v0.26.4/full/"
    });
  }
  return pyodideReadyPromise;
}

self.onmessage = async (e) => {
  const { id, code, loadPackages, inputValues } = e.data;
  try {
    const pyodide = await initPyodide();

    if (loadPackages && loadPackages.length) {
      await pyodide.loadPackage(loadPackages);
    }

    // 매 실행마다 stdout/stderr를 새로 캡처하고, 전역 네임스페이스도 초기화한다.
    pyodide.setStdout({ batched: (s) => { self.__out += s + "\n"; } });
    pyodide.setStderr({ batched: (s) => { self.__err += s + "\n"; } });
    self.__out = "";
    self.__err = "";

    // 문제에서 미리 정해둔 입력값을 input() 호출 순서대로 하나씩 돌려주기 위한 큐.
    // input() 호출 시 화면에도 "입력값 >> ..." 형태로 함께 출력해 사용자가 흐름을 볼 수 있게 한다.
    self.__inputQueue = Array.isArray(inputValues) ? inputValues.slice() : [];

    // 이전 실행의 변수가 남지 않도록 새 전역 딕셔너리에서 실행한다.
    await pyodide.runPythonAsync(`
import builtins
import js

__input_queue = list(js.self.__inputQueue)
__input_index = {"i": 0}

def __fake_input(prompt=""):
    if prompt:
        print(prompt, end="")
    if __input_index["i"] < len(__input_queue):
        value = __input_queue[__input_index["i"]]
        __input_index["i"] += 1
    else:
        value = ""
    print(value)
    return value

builtins.input = __fake_input
__game_globals = {"__builtins__": builtins}
`);
    const globalsDict = pyodide.globals.get("__game_globals");
    await pyodide.runPythonAsync(code, { globals: globalsDict });

    self.postMessage({
      id,
      ok: true,
      stdout: self.__out,
      stderr: self.__err
    });
  } catch (err) {
    self.postMessage({
      id,
      ok: false,
      error: err && err.message ? err.message : String(err),
      stdout: self.__out || "",
      stderr: self.__err || ""
    });
  }
};
