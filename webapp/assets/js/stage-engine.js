// ===== 스테이지 렌더링 & 채점 엔진 =====
// data/stages/*.json 을 읽어 화면을 그리고, 보기 실행/제출을 처리한다.

let currentStudent = null;
let currentStageId = null;

async function initStage(stageId) {
  currentStageId = stageId;
  const meta = getStageMeta(stageId);
  if (!meta) {
    document.getElementById("stage-root").innerHTML =
      `<div class="card">존재하지 않는 스테이지입니다.</div>`;
    return;
  }

  const res = await fetch(meta.file);
  const stage = await res.json();

  showIdentifyGate((info) => {
    currentStudent = info;
    renderStage(stage, meta);
  });
}

function renderStage(stage, meta) {
  const root = document.getElementById("stage-root");
  root.innerHTML = "";

  // 상단 정보 카드
  const header = document.createElement("div");
  header.className = "card";
  header.innerHTML = `
    <div class="badge">${meta.chapter}</div>
    <h1>${stage.title}</h1>
    ${stage.intro.map(line => `<div class="intro-line">${line}</div>`).join("")}
  `;
  root.appendChild(header);

  // 개념 카드
  if (stage.conceptCard) {
    const cc = document.createElement("div");
    cc.className = "card";
    cc.innerHTML = `
      <h2>핵심 개념</h2>
      <div class="term-list">
        ${stage.conceptCard.terms.map(t => `<span class="term-chip"><b>${t.term}</b> — ${t.desc}</span>`).join("")}
      </div>
      ${stage.conceptCard.exampleCode ? `<pre class="code-block">${escapeHtml(stage.conceptCard.exampleCode)}</pre>` : ""}
    `;
    root.appendChild(cc);
  }

  // 문제들
  stage.questions.forEach((q, idx) => {
    root.appendChild(renderQuestion(stage.id, q, idx));
  });

  // 다음 스테이지 안내
  const nextCard = document.createElement("div");
  nextCard.className = "card";
  nextCard.id = "next-stage-card";
  nextCard.innerHTML = `<p class="small-note">모든 문제를 맞히면 다음 관문으로 가는 길이 열립니다.</p>`;
  root.appendChild(nextCard);
}

function renderQuestion(stageId, q, idx) {
  const box = document.createElement("div");
  box.className = "card";
  box.id = `q-${q.id}`;

  const codeWithBlank = q.codeTemplate.replace(
    "{{blank}}",
    `<span class="blank-slot" id="blank-${q.id}">____</span>`
  );

  box.innerHTML = `
    <h2>문제 ${idx + 1}</h2>
    <p>${q.prompt}</p>
    <pre class="code-block" id="code-${q.id}">${codeWithBlank}</pre>
    <div class="option-grid" id="options-${q.id}"></div>
    <div class="run-result" id="run-${q.id}" style="display:none;"></div>
    <button class="btn btn-secondary" id="run-btn-${q.id}" disabled>선택한 보기 실행해보기</button>
    <button class="btn btn-primary" id="submit-btn-${q.id}" disabled>이 답으로 제출하기</button>
    <div class="feedback" id="feedback-${q.id}" style="display:none;"></div>
  `;

  const optionGrid = box.querySelector(`#options-${q.id}`);
  let selectedOptionId = null;

  q.options.forEach(opt => {
    const btn = document.createElement("button");
    btn.className = "option-btn";
    btn.textContent = opt.code;
    btn.addEventListener("click", () => {
      selectedOptionId = opt.id;
      [...optionGrid.children].forEach(c => c.classList.remove("selected"));
      btn.classList.add("selected");
      document.getElementById(`blank-${q.id}`).textContent = opt.code;
      document.getElementById(`run-btn-${q.id}`).disabled = false;
      document.getElementById(`submit-btn-${q.id}`).disabled = false;
    });
    optionGrid.appendChild(btn);
  });

  box.querySelector(`#run-btn-${q.id}`).addEventListener("click", async () => {
    if (!selectedOptionId) return;
    const opt = q.options.find(o => o.id === selectedOptionId);
    const fullCode = q.codeTemplate.replace("{{blank}}", opt.code);
    const runBox = document.getElementById(`run-${q.id}`);
    runBox.style.display = "block";
    runBox.textContent = "실행 중...";
    const result = await runPython(fullCode, q.loadPackages);
    if (result.ok) {
      runBox.textContent = result.stdout || "(출력 없음)";
    } else {
      runBox.textContent = "오류: " + result.error;
    }
  });

  box.querySelector(`#submit-btn-${q.id}`).addEventListener("click", async () => {
    if (!selectedOptionId) return;
    const submitBtn = document.getElementById(`submit-btn-${q.id}`);
    submitBtn.disabled = true;
    submitBtn.textContent = "채점 중...";
    try {
      const result = await submitAnswer({
        stageId,
        questionId: q.id,
        optionIds: [selectedOptionId],
        student: currentStudent
      });
      const fb = document.getElementById(`feedback-${q.id}`);
      fb.style.display = "block";
      if (result.correct) {
        fb.className = "feedback ok";
        fb.textContent = "정답입니다! 🎉";
        checkAllCorrectAndShowNext();
      } else {
        fb.className = "feedback no";
        fb.textContent = "다시 한 번 생각해 보세요. (" + (result.hint || "오답입니다") + ")";
      }
    } catch (e) {
      alert("제출 중 오류가 발생했습니다: " + e.message);
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = "이 답으로 제출하기";
    }
  });

  return box;
}

function checkAllCorrectAndShowNext() {
  const allFeedback = document.querySelectorAll(".feedback.ok");
  const allQuestions = document.querySelectorAll("[id^='q-']");
  if (allFeedback.length >= allQuestions.length) {
    const idx = STAGE_LIST.findIndex(s => s.id === currentStageId);
    const next = STAGE_LIST[idx + 1];
    const nextCard = document.getElementById("next-stage-card");
    if (next) {
      nextCard.innerHTML = `
        <h2>관문 통과! 🚪</h2>
        <p>다음 관문으로 이동하세요.</p>
        <a class="btn btn-primary" href="stage.html?id=${next.id}">${next.title} 로 이동 →</a>
      `;
    } else {
      nextCard.innerHTML = `<h2>모든 스테이지를 완료했습니다! 축하합니다 🎉</h2>`;
    }
  }
}

function escapeHtml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
