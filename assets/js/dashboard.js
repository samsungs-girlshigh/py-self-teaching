// ===== 교사 대시보드 로직 =====

async function loadDashboard(pin) {
  const content = document.getElementById("dashboard-content");
  content.innerHTML = `<div class="card">불러오는 중...</div>`;

  const data = await getDashboardData(pin);
  if (data.error) {
    content.innerHTML = `<div class="card feedback no" style="display:block;">${data.error}</div>`;
    return;
  }

  content.innerHTML = data.stages.map(stage => {
    const meta = getStageMeta(stage.stageId);
    const title = meta ? `${meta.order}. ${meta.title}` : stage.stageId;

    const rows = stage.students
      .sort((a, b) => b.rate - a.rate)
      .map(s => `
        <tr>
          <td>${s.grade}</td>
          <td>${s.classNo}</td>
          <td>${s.number}</td>
          <td>${s.name}</td>
          <td>${s.rate}%</td>
          <td>${s.attempts}</td>
          <td>${s.lastTime ? new Date(s.lastTime).toLocaleString("ko-KR") : "-"}</td>
        </tr>
      `).join("");

    return `
      <div class="card">
        <h2>${title}</h2>
        <p>전체 학생 중 정답 도달 학생 비율: <b>${stage.reachedRate}%</b> (${stage.reachedCount} / ${stage.totalStudents}명)</p>
        <div style="overflow-x:auto;">
          <table class="dash-table">
            <thead>
              <tr>
                <th>학년</th><th>반</th><th>번호</th><th>이름</th>
                <th>정답율(학생별)</th><th>제출횟수</th><th>최종제출시각</th>
              </tr>
            </thead>
            <tbody>${rows || `<tr><td colspan="7">아직 제출 기록이 없습니다.</td></tr>`}</tbody>
          </table>
        </div>
      </div>
    `;
  }).join("");
}

document.getElementById("pin-confirm-btn").addEventListener("click", async () => {
  const pin = document.getElementById("pin-input").value.trim();
  const errorBox = document.getElementById("pin-error");
  try {
    const verify = await verifyTeacherPin(pin);
    if (!verify.ok) {
      errorBox.style.display = "block";
      errorBox.textContent = "PIN이 올바르지 않습니다.";
      return;
    }
    sessionStorage.setItem("teacher_pin", pin);
    document.getElementById("pin-card").style.display = "none";
    await loadDashboard(pin);
  } catch (e) {
    errorBox.style.display = "block";
    errorBox.textContent = "확인 중 오류: " + e.message;
  }
});

// 이미 로그인되어 있으면 자동 진행
(async () => {
  const savedPin = sessionStorage.getItem("teacher_pin");
  if (savedPin) {
    const verify = await verifyTeacherPin(savedPin);
    if (verify.ok) {
      document.getElementById("pin-card").style.display = "none";
      await loadDashboard(savedPin);
    }
  }
})();
