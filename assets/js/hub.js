// ===== 허브 페이지 로직 =====

function renderLinkList(targetId) {
  const ul = document.getElementById(targetId);
  ul.innerHTML = STAGE_LIST
    .slice()
    .sort((a, b) => a.order - b.order)
    .map(s => `<li><a href="stage.html?id=${s.id}">${s.order}. ${s.chapter} - ${s.title}</a></li>`)
    .join("");
}

const ALWAYS_OPEN_STAGE_ID = "stage1_variables";

function renderStageOpenList(pin, stageOpenMap) {
  const ul = document.getElementById("stage-open-list");
  ul.innerHTML = STAGE_LIST
    .slice()
    .sort((a, b) => a.order - b.order)
    .map(s => {
      const isAlwaysOpen = s.id === ALWAYS_OPEN_STAGE_ID;
      const isOpen = isAlwaysOpen || !!stageOpenMap[s.id];
      return `
        <li class="toggle-row">
          <label class="switch">
            <input type="checkbox" class="stage-open-toggle" data-stage-id="${s.id}"
              ${isOpen ? "checked" : ""} ${isAlwaysOpen ? "disabled" : ""} />
            <span class="slider"></span>
          </label>
          <span>${s.order}. ${s.chapter} - ${s.title}${isAlwaysOpen ? " (항상 공개)" : ""}</span>
        </li>
      `;
    })
    .join("");

  ul.querySelectorAll(".stage-open-toggle").forEach(toggle => {
    toggle.addEventListener("change", async (e) => {
      const stageId = e.target.dataset.stageId;
      const isOpen = e.target.checked;
      e.target.disabled = true;
      try {
        await setStageOpen(pin, stageId, isOpen);
      } catch (err) {
        alert("스테이지 공개 설정 변경 중 오류: " + err.message);
        e.target.checked = !isOpen;
      } finally {
        e.target.disabled = false;
      }
    });
  });
}

async function initHub() {
  const statusEl = document.getElementById("hub-status");
  try {
    const settings = await getPublicSettings();
    if (settings.hubPublic) {
      statusEl.textContent = "현재 이 페이지는 공개되어 있습니다.";
      document.getElementById("public-list-card").style.display = "block";
      renderLinkList("stage-link-list");
    } else {
      statusEl.textContent = "현재 이 페이지는 비공개(교사 전용)입니다. 학생은 클래스룸에 공유된 개별 스테이지 링크를 이용해 주세요.";
    }

    // 세션에 저장된 PIN이 있으면 자동으로 관리자 화면 표시 시도
    const savedPin = sessionStorage.getItem("teacher_pin");
    if (savedPin) {
      const verify = await verifyTeacherPin(savedPin);
      if (verify.ok) {
        showAdminPanel(savedPin, settings);
      }
    }
  } catch (e) {
    statusEl.textContent = "설정을 불러오지 못했습니다. APPS_SCRIPT_URL 설정을 확인해 주세요. (" + e.message + ")";
  }
}

function showAdminPanel(pin, settings) {
  document.getElementById("teacher-login-card").style.display = "none";
  document.getElementById("admin-card").style.display = "block";
  document.getElementById("public-toggle").checked = !!settings.hubPublic;
  renderLinkList("admin-link-list");
  renderStageOpenList(pin, settings.stageOpen || {});

  document.getElementById("public-toggle").addEventListener("change", async (e) => {
    const isPublic = e.target.checked;
    try {
      await setHubPublic(pin, isPublic);
    } catch (err) {
      alert("설정 변경 중 오류: " + err.message);
      e.target.checked = !isPublic;
    }
  });
}

document.getElementById("pin-confirm-btn").addEventListener("click", async () => {
  const pin = document.getElementById("pin-input").value.trim();
  const errorBox = document.getElementById("pin-error");
  try {
    const result = await verifyTeacherPin(pin);
    if (result.ok) {
      sessionStorage.setItem("teacher_pin", pin);
      const settings = await getPublicSettings();
      showAdminPanel(pin, settings);
    } else {
      errorBox.style.display = "block";
      errorBox.textContent = "PIN이 올바르지 않습니다.";
    }
  } catch (e) {
    errorBox.style.display = "block";
    errorBox.textContent = "확인 중 오류: " + e.message;
  }
});

initHub();
