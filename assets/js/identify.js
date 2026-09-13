// ===== 학생 식별(학년/반/번호/이름) 공통 모듈 =====
// - 처음 접속 시 4칸을 입력받아 localStorage에 저장
// - 이후 접속 시에는 저장된 값을 자동으로 채워 보여주고 "확인"만 누르면 되도록 안내
// - 스테이지가 바뀌어도 항상 같은 정보로 식별되도록 하기 위한 장치

const STUDENT_KEY = "codecontinent_student_info";

function loadSavedStudent() {
  try {
    const raw = localStorage.getItem(STUDENT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

function saveStudent(info) {
  try {
    localStorage.setItem(STUDENT_KEY, JSON.stringify(info));
  } catch (e) {
    // localStorage 사용 불가 환경 - 무시하고 진행 (매 스테이지 재입력 필요)
  }
}

/**
 * 식별 오버레이를 표시하고, 학생이 확인을 누르면 콜백으로 정보를 전달한다.
 * @param {(info: {grade:string, classNo:string, number:string, name:string}) => void} onConfirm
 */
function showIdentifyGate(onConfirm) {
  const saved = loadSavedStudent();

  const overlay = document.createElement("div");
  overlay.className = "overlay";
  overlay.id = "identify-overlay";
  overlay.innerHTML = `
    <div class="card">
      <div class="badge">본인 확인</div>
      <h2>학년 · 반 · 번호 · 이름을 입력해 주세요</h2>
      <p class="small-note">
        ${saved ? "이전에 입력했던 정보가 자동으로 채워져 있어요. 맞는지 확인하고 눌러주세요." : "모든 스테이지에서 <b>항상 같은 정보</b>로 입력해야 진행 기록이 하나로 합쳐집니다."}
      </p>
      <div class="field-row">
        <div>
          <label class="small-note">학년</label>
          <input type="text" id="in-grade" placeholder="예: 2" inputmode="numeric" />
        </div>
        <div>
          <label class="small-note">반</label>
          <input type="text" id="in-class" placeholder="예: 3" inputmode="numeric" />
        </div>
      </div>
      <div class="field-row">
        <div>
          <label class="small-note">번호</label>
          <input type="text" id="in-number" placeholder="예: 15" inputmode="numeric" />
        </div>
        <div>
          <label class="small-note">이름</label>
          <input type="text" id="in-name" placeholder="예: 홍길동" />
        </div>
      </div>
      <div id="identify-error" class="feedback no" style="display:none;"></div>
      <button class="btn btn-primary" id="identify-confirm-btn" style="width:100%; margin-top:10px;">확인하고 시작하기</button>
    </div>
  `;
  document.body.appendChild(overlay);

  if (saved) {
    document.getElementById("in-grade").value = saved.grade || "";
    document.getElementById("in-class").value = saved.classNo || "";
    document.getElementById("in-number").value = saved.number || "";
    document.getElementById("in-name").value = saved.name || "";
  }

  document.getElementById("identify-confirm-btn").addEventListener("click", () => {
    const grade = document.getElementById("in-grade").value.trim();
    const classNo = document.getElementById("in-class").value.trim();
    const number = document.getElementById("in-number").value.trim();
    const name = document.getElementById("in-name").value.trim();
    const errorBox = document.getElementById("identify-error");

    if (!grade || !classNo || !number || !name) {
      errorBox.style.display = "block";
      errorBox.textContent = "네 칸을 모두 입력해 주세요.";
      return;
    }

    const info = { grade, classNo, number, name };
    saveStudent(info);
    overlay.remove();
    onConfirm(info);
  });
}
