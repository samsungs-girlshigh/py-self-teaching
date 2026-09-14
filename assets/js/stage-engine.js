// ===== 스테이지 렌더링 & 채점 엔진 =====
// data/stages/*.json 을 읽어 화면을 그리고, 보기 실행/제출을 처리한다.

let currentStudent = null;
let currentStageId = null;
let currentStageOpenMap = null; // { stageId: true/false } - 서버에서 받아온 공개 상태

async function initStage(stageId) {
  currentStageId = stageId;
  const meta = getStageMeta(stageId);
  if (!meta) {
    document.getElementById("stage-root").innerHTML =
      `<div class="card">존재하지 않는 스테이지입니다.</div>`;
    return;
  }

  // 잠금 여부부터 서버에 확인한다. 학생 식별 화면(개인정보 입력)보다 먼저 확인해서,
  // 잠긴 스테이지는 문제 내용은 물론 식별 화면조차 보여주지 않는다 (URL 직접 접근 차단).
  let settings;
  try {
    settings = await getPublicSettings();
  } catch (e) {
    document.getElementById("stage-root").innerHTML =
      `<div class="card">설정을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요. (${e.message})</div>`;
    return;
  }
  currentStageOpenMap = settings.stageOpen || {};

  if (!currentStageOpenMap[stageId]) {
    renderLockedStage(meta);
    return;
  }

  const res = await fetch(meta.file);
  const stage = await res.json();

  showIdentifyGate((info) => {
    currentStudent = info;
    renderStage(stage, meta);
  });
}

function renderLockedStage(meta) {
  const root = document.getElementById("stage-root");
  root.innerHTML = `
    <div class="card">
      <div class="badge">${meta.chapter}</div>
      <h1>${meta.title}</h1>
      <p>🔒 이 관문은 아직 열리지 않았습니다. 선생님이 진도에 맞춰 열어주실 때까지 기다려 주세요.</p>
      <a class="btn btn-secondary" href="hub.html">허브로 돌아가기</a>
    </div>
  `;
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
  root.appendChild(nextCard);

  if (stage.questions.length === 0) {
    const idx = STAGE_LIST.findIndex(s => s.id === stage.id);
    const isLastStage = idx === STAGE_LIST.length - 1;

    if (isLastStage) {
      // 마지막 스테이지(문제 없음)는 학생이 직접 완료 버튼을 눌러야 최종 클리어 연출이 나온다.
      nextCard.innerHTML = `
        <p class="small-note">내용을 다 확인했다면, 아래 버튼을 눌러 최종 보스를 처치하세요.</p>
        <button class="btn btn-primary" id="final-clear-btn">최종 보스 처치 완료!</button>
      `;
      document.getElementById("final-clear-btn").addEventListener("click", () => {
        renderNextStageLink();
      });
    } else {
      // 문제가 없는 "설명 전용" 스테이지는 읽는 즉시 다음 관문으로 넘어갈 수 있게 한다.
      nextCard.innerHTML = `<p class="small-note">내용을 확인했다면 아래에서 다음 관문으로 이동하세요.</p>`;
      renderNextStageLink();
    }
  } else {
    nextCard.innerHTML = `<p class="small-note">모든 문제를 맞히면 다음 관문으로 가는 길이 열립니다.</p>`;
  }
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
    const result = await runPython(fullCode, q.loadPackages, q.inputValues);
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
    renderNextStageLink();
  }
}

function renderNextStageLink() {
  const idx = STAGE_LIST.findIndex(s => s.id === currentStageId);
  const next = STAGE_LIST[idx + 1];
  const nextCard = document.getElementById("next-stage-card");
  if (next) {
    const isNextOpen = currentStageOpenMap && currentStageOpenMap[next.id];
    if (isNextOpen) {
      nextCard.innerHTML = `
        <h2>관문 통과! 🚪</h2>
        <p>다음 관문으로 이동하세요.</p>
        <a class="btn btn-primary" href="stage.html?id=${next.id}">${next.title} 로 이동 →</a>
      `;
    } else {
      nextCard.innerHTML = `
        <h2>관문 통과! 🚪</h2>
        <p>🔒 다음 관문(${next.title})은 아직 열리지 않았습니다. 선생님이 열어주실 때까지 기다려 주세요.</p>
      `;
    }
  } else {
    nextCard.innerHTML = `
      <div class="final-clear-card">
        <div class="final-clear-title">🏆 코드 대륙 정복! 🏆</div>
        <p class="final-clear-subtitle">모든 관문을 통과하고 진정한 코드 마스터가 되었습니다!</p>
        <p>19개의 관문을 모두 클리어했습니다. 정말 수고 많으셨어요.</p>
      </div>
    `;
    launchConfetti();
  }
}

// 화면 가득 컨페티(색종이 조각) 효과를 잠깐 띄운다. 외부 라이브러리 없이 순수 CSS 애니메이션으로 구현.
function launchConfetti() {
  const colors = ["#ffcb47", "#4fd1c5", "#ff6b6b", "#4ade80", "#f2f2f8"];
  const layer = document.createElement("div");
  layer.className = "confetti-layer";
  document.body.appendChild(layer);

  const pieceCount = 120;
  for (let i = 0; i < pieceCount; i++) {
    const piece = document.createElement("div");
    piece.className = "confetti-piece";
    piece.style.left = Math.random() * 100 + "vw";
    piece.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
    piece.style.animationDuration = 2.5 + Math.random() * 2 + "s";
    piece.style.animationDelay = Math.random() * 1.2 + "s";
    // 조각마다 살짝 다른 모양을 줘서 종이 조각처럼 보이게 함
    if (Math.random() < 0.5) {
      piece.style.borderRadius = "50%";
    }
    layer.appendChild(piece);
  }

  // 애니메이션이 다 끝나면 DOM에서 정리한다 (최대 지연 1.2s + 최대 길이 4.5s + 여유 0.5s)
  setTimeout(() => {
    layer.remove();
  }, 6500);
}

function escapeHtml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
