const CONFIG = {
  totalMinutes: 15,
  displayUpdateSeconds: 15,
  maxDisplayPatients: 15,

  initialNextMinutes: 5,
  initialThirdNextMinutes: 5,
  initialThirdPublicWait: 17,

  autoVirtualIntervalMinutes: 3,

  announcementIntervalMinutes: 3,

  announcementPool: [
    "醫師正在處理上一位患者的心跳異常狀況，請稍候。",
    "診間內心悸檢查程序延長，請留意後續叫號資訊。",
    "護理師正在協助醫師確認心律資料，候診順序將持續更新。",
    "前一位患者檢查時間超出預期，請耐心等候。",
    "診間正在進行特殊心悸案例評估，請保持安靜並留意螢幕叫號。"
  ],

  virtualNames: [
    "王○明",
    "李○華",
    "陳○婷",
    "林○安",
    "張○瑜",
    "黃○傑",
    "蔡○德",
    "劉○萱",
    "吳○芳",
    "謝○君"
  ]
};

/* =========================
   基本工具
========================= */

function getQueue() {
  return JSON.parse(localStorage.getItem("waitingQueue") || "[]");
}

function saveQueue(queue) {
  localStorage.setItem("waitingQueue", JSON.stringify(queue));
}

function getRecords() {
  return JSON.parse(localStorage.getItem("records") || "[]");
}

function saveRecords(records) {
  localStorage.setItem("records", JSON.stringify(records));
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function nowTimeText() {
  return new Date().toLocaleTimeString("zh-TW");
}

function todayText() {
  return new Date().toLocaleDateString("zh-TW");
}

function getConditionFromUrlOrStorage() {
  const urlParams = new URLSearchParams(window.location.search);

  return (
    urlParams.get("condition") ||
    localStorage.getItem("experimentCondition") ||
    "A"
  );
}

function generateQueueNumber() {
  const currentNumber =
    Number(localStorage.getItem("queueNumber") || "0") + 1;

  localStorage.setItem("queueNumber", String(currentNumber));

  return String(currentNumber).padStart(3, "0");
}

function generateParticipantId() {
  const condition = getConditionFromUrlOrStorage();
  const key = `participantCount_${condition}`;

  const currentCount =
    Number(localStorage.getItem(key) || "0") + 1;

  localStorage.setItem(key, String(currentCount));

  return `${condition}${String(currentCount).padStart(2, "0")}`;
}

function maskName(name) {
  if (!name) return "未填寫";

  if (name.length === 2) {
    return name[0] + "○";
  }

  if (name.length >= 3) {
    return name[0] + "○" + name[name.length - 1];
  }

  return name;
}

function getElapsedSeconds(p) {
  return Math.floor((Date.now() - p.開始時間戳) / 1000);
}

function getElapsedMinutes(p) {
  return Math.floor(getElapsedSeconds(p) / 60);
}

function getPersonalRemainingMinutes(p) {
  const elapsed = getElapsedMinutes(p);
  return Math.max(CONFIG.totalMinutes - elapsed, 0);
}

/* =========================
   條件選擇
========================= */

function saveCondition() {
  const select = document.getElementById("conditionSelect");
  localStorage.setItem("experimentCondition", select.value);
  window.location.href = "admin.html";
}

function openDisplay() {
  const condition = localStorage.getItem("experimentCondition") || "A";
  window.open(`display.html?condition=${condition}`, "_blank");
}

/* =========================
   建立候診者
========================= */

function getRandomVirtualName() {
  let name;
  const lastName = localStorage.getItem("lastVirtualName");

  do {
    name =
      CONFIG.virtualNames[
        Math.floor(Math.random() * CONFIG.virtualNames.length)
      ];
  } while (name === lastName && CONFIG.virtualNames.length > 1);

  localStorage.setItem("lastVirtualName", name);
  return name;
}

function createBaseParticipant({
  id,
  queueNumber,
  name,
  isVirtual,
  status,
  waitStartTimestamp,
  nextDurationMinutes = "",
  publicEstimateMinutes = ""
}) {
  return {
    實驗日期: todayText(),
    實驗條件: localStorage.getItem("experimentCondition") || "A",

    受測者編號: id,
    掛號號碼: queueNumber,
    受測者姓名代碼: name,
    預約時間: "",

    實際報到時間: nowTimeText(),
    候診開始時間: nowTimeText(),
    開始時間戳: waitStartTimestamp || Date.now(),

    開始看診時間: "",
    開始看診時間戳: "",

    候診結束時間: "",
    實際等待秒數: "",

    狀態: status,
    是否虛擬: isVirtual,

    下一號開始時間戳: "",
    下一號等待分鐘: nextDurationMinutes,

    公開預估等待分鐘: publicEstimateMinutes,
    公開預估開始時間戳: Date.now(),

    已加入中途虛擬: false,
    中途虛擬延遲分鐘: "",
    公告內容紀錄: []
  };
}

function createVirtualParticipant({
  status = "候診中",
  nextDurationMinutes = "",
  publicEstimateMinutes = "",
  alreadyWaitedMinutes = 0
} = {}) {
  const virtualCount =
    Number(localStorage.getItem("virtualCount") || "0") + 1;

  localStorage.setItem("virtualCount", String(virtualCount));

  return createBaseParticipant({
    id: `V${String(virtualCount).padStart(3, "0")}`,
    queueNumber: generateQueueNumber(),
    name: getRandomVirtualName(),
    isVirtual: true,
    status,
    waitStartTimestamp: Date.now() - alreadyWaitedMinutes * 60000,
    nextDurationMinutes,
    publicEstimateMinutes
  });
}

function getNextInsertedVirtualDelay() {
  const count =
    Number(localStorage.getItem("insertedVirtualDelayCount") || "0");

  const delay =
    CONFIG.insertedVirtualDelays[
      count % CONFIG.insertedVirtualDelays.length
    ];

  localStorage.setItem(
    "insertedVirtualDelayCount",
    String(count + 1)
  );

  return delay;
}

/* =========================
   初始虛擬候診者
========================= */

function addInitialVirtualPatientsIfNeeded() {
  const queue = getQueue();

  if (queue.length > 0) return queue;

  const currentPatient = createVirtualParticipant({
    status: "正在看診"
  });

  currentPatient.開始看診時間 = nowTimeText();
  currentPatient.開始看診時間戳 = Date.now();

  const nextPatient = createVirtualParticipant({
    status: "即將叫號",
    nextDurationMinutes: CONFIG.initialNextMinutes
  });

  nextPatient.下一號開始時間戳 = Date.now();

  const thirdPatient = createVirtualParticipant({
    status: "候診中",
    nextDurationMinutes: CONFIG.initialThirdNextMinutes,
    publicEstimateMinutes: CONFIG.initialThirdPublicWait
  });

  queue.push(currentPatient);
  queue.push(nextPatient);
  queue.push(thirdPatient);

  saveQueue(queue);
  return queue;
}

/* =========================
   報到
========================= */

function checkInParticipant() {
  let queue = addInitialVirtualPatientsIfNeeded();

  const name =
    document.getElementById("participantName")?.value.trim();

  if (!name) {
    alert("請輸入姓名");
    return;
  }

  const id = generateParticipantId();

  const participant = createBaseParticipant({
    id,
    queueNumber: generateQueueNumber(),
    name: maskName(name),
    isVirtual: false,
    status: "候診中",
    waitStartTimestamp: Date.now()
  });


  queue.push(participant);

if (!localStorage.getItem("autoVirtualStartedAt")) {
  localStorage.setItem("autoVirtualStartedAt", String(Date.now()));
  localStorage.setItem("lastAutoVirtualAddedAt", String(Date.now()));
}

saveQueue(queue);

  document.getElementById("participantName").value = "";

  setTimeout(() => {
    renderAdmin();
    renderDisplay();
  }, 100);
}

/* =========================
   中途虛擬候診者
========================= */

function addAutoVirtualPatientIfNeeded() {
  const startedAt = Number(localStorage.getItem("autoVirtualStartedAt") || 0);
  const lastAddedAt = Number(localStorage.getItem("lastAutoVirtualAddedAt") || 0);

  if (!startedAt || !lastAddedAt) return;

  const now = Date.now();
  const intervalMs = CONFIG.autoVirtualIntervalMinutes * 60 * 1000;

  if (now - lastAddedAt < intervalMs) return;

  const queue = getQueue();

  const virtualPatient = createVirtualParticipant({
    status: "候診中"
  });

  queue.push(virtualPatient);

  localStorage.setItem("lastAutoVirtualAddedAt", String(now));
  saveQueue(queue);
}

/* =========================
   狀態處理
========================= */

function finishPatient(patient) {
  patient.狀態 = "已看診";
  patient.候診結束時間 = nowTimeText();

  if (!patient.實際等待秒數) {
    patient.實際等待秒數 = getElapsedSeconds(patient);
  }
}

function startCurrentPatient(patient) {
  patient.狀態 = "正在看診";
  patient.開始看診時間 = nowTimeText();
  patient.開始看診時間戳 = Date.now();

  if (!patient.實際等待秒數) {
    patient.實際等待秒數 = getElapsedSeconds(patient);
  }

  patient.候診結束時間 = nowTimeText();

  saveRealPatientRecord(patient);
}

function ensureNextPatient(queue) {
  const hasNext = queue.some(p => p.狀態 === "即將叫號");

  if (hasNext) return false;

  const firstWaiting = queue.find(p => p.狀態 === "候診中");

  if (!firstWaiting) return false;

  firstWaiting.狀態 = "即將叫號";
  firstWaiting.下一號開始時間戳 = Date.now();

  if (!firstWaiting.下一號等待分鐘) {
    if (firstWaiting.是否虛擬) {
      firstWaiting.下一號等待分鐘 = 5;
    } else {
      firstWaiting.下一號等待分鐘 =
        getPersonalRemainingMinutes(firstWaiting);
    }
  }

  return true;
}

function promoteNextPatient(queue) {
  function playCallBell() {
  try {
    const audioContext =
      new (window.AudioContext || window.webkitAudioContext)();

    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(880, audioContext.currentTime);

    gainNode.gain.setValueAtTime(0.25, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(
      0.001,
      audioContext.currentTime + 0.6
    );

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.start();
    oscillator.stop(audioContext.currentTime + 0.6);
  } catch (error) {
    console.log("鈴聲播放失敗", error);
  }
}
  const currentPatient =
    queue.find(p => p.狀態 === "正在看診");

  const nextPatient =
    queue.find(p => p.狀態 === "即將叫號");

  if (!nextPatient) return false;

  if (currentPatient) {
    finishPatient(currentPatient);
  }

  startCurrentPatient(nextPatient);
  playCallBell();

  const waitingQueue = queue.filter(p => p.狀態 === "候診中");

  if (waitingQueue.length > 0) {
    const newNext = waitingQueue[0];

    newNext.狀態 = "即將叫號";
    newNext.下一號開始時間戳 = Date.now();

    if (!newNext.下一號等待分鐘) {
      if (newNext.是否虛擬) {
        newNext.下一號等待分鐘 = 5;
      } else {
        newNext.下一號等待分鐘 =
          getPersonalRemainingMinutes(newNext);
      }
    }
  }

  return true;
}

function saveRealPatientRecord(patient) {
  if (patient.是否虛擬) return;

  const records = getRecords();

  const alreadySaved = records.some(
    r => r.受測者編號 === patient.受測者編號
  );

  if (!alreadySaved) {
    records.push({ ...patient });
    saveRecords(records);
  }
}

function showAdminAlert(patient) {
  if (!document.getElementById("queueTableBody")) return;

  const alertKey = `alertShown_${patient.受測者編號}`;

  if (localStorage.getItem(alertKey)) return;

  localStorage.setItem(alertKey, "yes");

  const modal = document.createElement("div");
  modal.className = "admin-alert-modal";

  modal.innerHTML = `
    <div class="admin-alert-box">
      <div class="admin-alert-title">請準備叫號</div>
      <div class="admin-alert-number">
        ${patient.掛號號碼 || patient.受測者編號}
      </div>
      <div class="admin-alert-name">
        ${patient.受測者姓名代碼}
      </div>
      <button onclick="this.closest('.admin-alert-modal').remove()">
        我知道了
      </button>
    </div>
  `;

  document.body.appendChild(modal);
}

function updateQueueStatus() {
  let queue = getQueue();
  let changed = false;

  if (ensureNextPatient(queue)) {
    saveQueue(queue);
    changed = true;
  }

  addAutoVirtualPatientIfNeeded();
queue = getQueue();

  const nextPatient =
    queue.find(p => p.狀態 === "即將叫號");

  if (nextPatient && nextPatient.下一號開始時間戳) {
    const elapsedAsNext = Math.floor(
      (Date.now() - nextPatient.下一號開始時間戳) / 1000
    );

    const durationSeconds =
      Number(nextPatient.下一號等待分鐘 || 0) * 60;

    if (elapsedAsNext >= durationSeconds) {
      const didPromote = promoteNextPatient(queue);

      if (didPromote) {
        changed = true;
      }
    }
  }

  queue.forEach(p => {
    if (
      !p.是否虛擬 &&
      p.狀態 !== "已看診" &&
      getElapsedSeconds(p) >= CONFIG.totalMinutes * 60
    ) {
      showAdminAlert(p);
    }
  });

  if (changed) {
    saveQueue(queue);
    renderDisplay();
  }
}

/* =========================
   控制台
========================= */

function getAdminDisplayWait(p) {
  if (p.狀態 === "正在看診") return "看診中";
  if (p.狀態 === "即將叫號") return "即將叫號";
  if (p.狀態 === "已看診") return "已完成";

  if (p.是否虛擬) {
    return "候診中";
  }

  return `${getPersonalRemainingMinutes(p)} 分鐘`;
}

function renderAdmin() {
  const tableBody = document.getElementById("queueTableBody");
  if (!tableBody) return;

  const queue = getQueue();

  if (queue.length === 0) {
    tableBody.innerHTML =
      `<tr><td colspan="6">目前尚無候診者</td></tr>`;
    return;
  }

  tableBody.innerHTML = queue.map(p => {
    const elapsedSeconds = getElapsedSeconds(p);
    const min = Math.floor(elapsedSeconds / 60);
    const sec = elapsedSeconds % 60;

    const elapsedText =
      `${String(min).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;

    const typeLabel = p.是否虛擬 ? "（虛擬）" : "";

    return `
      <tr>
        <td>${p.受測者編號}${typeLabel}</td>
        <td>${p.受測者姓名代碼}</td>
        <td>${elapsedText}</td>
        <td>${getAdminDisplayWait(p)}</td>
        <td>${p.狀態}</td>
        <td>—</td>
      </tr>
    `;
  }).join("");

  const announcementEl =
    document.getElementById("currentAnnouncement");

  if (announcementEl) {
    announcementEl.textContent =
      localStorage.getItem("currentAnnouncement") ||
      "請留意現場叫號資訊。";
  }

  const nextAnnouncementEl =
    document.getElementById("nextAnnouncement");

  if (nextAnnouncementEl) {
    nextAnnouncementEl.textContent = getNextAnnouncementText();
  }
}

/* =========================
   公共候診畫面
========================= */

function getCurrentPatient(queue) {
  return queue.find(p => p.狀態 === "正在看診") || null;
}

function getNextPatient(queue) {
  return queue.find(p => p.狀態 === "即將叫號") || null;
}

function getWaitingList(queue) {
  return queue.filter(p => p.狀態 === "候診中");
}

function getPublicRemainingWait(p) {
  const base = Number(p.公開預估等待分鐘 || 0);

  if (!base) return 0;

  const elapsed = Math.floor(
    (Date.now() - Number(p.公開預估開始時間戳 || Date.now())) / 60000
  );

  return Math.max(base - elapsed, 1);
}

function ensurePublicEstimates(waitingList) {
  let previous = 0;
  let changed = false;

  waitingList.forEach((p, index) => {
    let currentEstimate = Number(p.公開預估等待分鐘 || 0);

    if (!currentEstimate) {
      if (index === 0) {
        currentEstimate =
          Math.max(17, CONFIG.totalMinutes + randomInt(1, 4));
      } else {
        currentEstimate = previous + randomInt(2, 4);
      }

      p.公開預估等待分鐘 = currentEstimate;
      p.公開預估開始時間戳 = Date.now();
      changed = true;
    }

    const currentRemaining = getPublicRemainingWait(p);
    previous = Math.max(previous, currentRemaining);
  });

  if (changed) {
    const queue = getQueue();

    waitingList.forEach(item => {
      const target = queue.find(
        p => p.受測者編號 === item.受測者編號
      );

      if (target) {
        target.公開預估等待分鐘 = item.公開預估等待分鐘;
        target.公開預估開始時間戳 = item.公開預估開始時間戳;
      }
    });

    saveQueue(queue);
  }
}

function renderDisplay() {
  const currentNumber = document.getElementById("currentNumber");
  if (!currentNumber) return;

  let queue = getQueue();

  if (ensureNextPatient(queue)) {
    saveQueue(queue);
  }

  queue = getQueue();

  const condition = getConditionFromUrlOrStorage();

  const currentPatient = getCurrentPatient(queue);
  const nextPatient = getNextPatient(queue);
  const waitingList =
    getWaitingList(queue).slice(0, CONFIG.maxDisplayPatients);

  ensurePublicEstimates(waitingList);

  const announcementArea = document.querySelector(".announcement-area");

  if (!currentPatient && !nextPatient) {
    currentNumber.textContent = "—";
    document.getElementById("currentName").textContent =
      "目前尚無候診者";

    document.getElementById("nextNumber").textContent = "—";

    const nextNameEl = document.getElementById("nextName");
    if (nextNameEl) nextNameEl.textContent = "—";

    renderDisplayQueue([], condition);

    if (announcementArea) announcementArea.style.display = "none";

    return;
  }

  if (currentPatient) {
    currentNumber.textContent =
      currentPatient.掛號號碼 || currentPatient.受測者編號;

    document.getElementById("currentName").textContent =
      currentPatient.受測者姓名代碼;
  }

  document.getElementById("nextNumber").textContent =
    nextPatient?.掛號號碼 || nextPatient?.受測者編號 || "—";

  const nextNameEl = document.getElementById("nextName");

  if (nextNameEl) {
    nextNameEl.textContent =
      nextPatient?.受測者姓名代碼 || "—";
  }

  const area = document.getElementById("conditionArea");

  if (area) {
    area.innerHTML = "";
  }

  updateAnnouncement(nextPatient, condition);
  renderDisplayQueue(waitingList, condition);

  const displayAnnouncement =
    document.getElementById("displayAnnouncement");

  if (condition === "A") {
  if (announcementArea) {
    announcementArea.style.display = "none";
  }
} else {
  if (announcementArea) {
    announcementArea.style.display = "flex";
  }

  if (displayAnnouncement) {
    displayAnnouncement.textContent =
      localStorage.getItem("currentAnnouncement") ||
      "請留意現場叫號資訊。";
  }
}
}

function renderDisplayQueue(visibleQueue, condition) {
  const body = document.getElementById("displayQueueBody");
  const headerRow = document.getElementById("queueHeaderRow");

  if (headerRow) {
    if (condition === "B") {
      headerRow.innerHTML = `
        <th>掛號</th>
        <th>狀態</th>
        <th>姓名</th>
        <th>等待進度</th>
      `;
    } else if (condition === "C") {
      headerRow.innerHTML = `
        <th>掛號</th>
        <th>狀態</th>
        <th>姓名</th>
        <th>預計等待</th>
      `;
    } else {
      headerRow.innerHTML = `
        <th>掛號</th>
        <th>狀態</th>
        <th>姓名</th>
      `;
    }
  }

  if (!body) return;

  if (visibleQueue.length === 0) {
    const colspan = condition === "A" ? 3 : 4;
    body.innerHTML =
      `<tr><td colspan="${colspan}">目前尚無候診者</td></tr>`;
    return;
  }

  body.innerHTML = visibleQueue.map(p => {
    const realRemaining = getPersonalRemainingMinutes(p);
    const publicRemaining = getPublicRemainingWait(p);

    let waitText = `${publicRemaining} 分鐘`;

    if (realRemaining <= 5) {
      waitText = `${realRemaining} 分鐘`;
    }

    if (realRemaining <= 3) {
      waitText = `<span class="soon-status">即將叫號</span>`;
    }

    const publicBase =
      Number(p.公開預估等待分鐘 || CONFIG.totalMinutes);

    const queueIndex = visibleQueue.findIndex(
      item => item.受測者編號 === p.受測者編號
    );

    const progressPercent = Math.min(
      ((publicBase - publicRemaining) / publicBase) * 100 + queueIndex * 3,
      100
    );

    const waitColumn =
      condition === "B"
        ? `
          <td>
            <div class="mini-progress-container">
              <div
                class="mini-progress-bar"
                style="width:${progressPercent}%">
              </div>
            </div>
            <div class="mini-progress-text">
              ${Math.round(progressPercent)}%
            </div>
          </td>
        `
        : condition === "C"
          ? `<td>${waitText}</td>`
          : "";

    return `
      <tr>
        <td>${p.掛號號碼 || p.受測者編號}</td>
        <td>候診中</td>
        <td>${p.受測者姓名代碼}</td>
        ${waitColumn}
      </tr>
    `;
  }).join("");
}

/* =========================
   公告
========================= */

function getNextAnnouncementText() {
  const currentAnnouncement =
    localStorage.getItem("currentAnnouncement") ||
    "請留意現場叫號資訊。";

  const currentIndex =
    CONFIG.announcementPool.indexOf(currentAnnouncement);

  if (currentIndex === -1) {
    return CONFIG.announcementPool[0];
  }

  const nextIndex =
    (currentIndex + 1) % CONFIG.announcementPool.length;

  return CONFIG.announcementPool[nextIndex];
}

function updateAnnouncement(targetPatient, condition) {
  if (condition === "A") return;

  if (!targetPatient) {
    localStorage.setItem(
      "currentAnnouncement",
      "請留意現場叫號資訊。"
    );
    return;
  }

  const elapsed = getElapsedMinutes(targetPatient);

  if (elapsed < CONFIG.announcementIntervalMinutes) {
    localStorage.setItem(
      "currentAnnouncement",
      "請留意現場叫號資訊。"
    );
    return;
  }

  const announcementIndex =
    Math.floor(elapsed / CONFIG.announcementIntervalMinutes) - 1;

  const messageIndex =
    announcementIndex % CONFIG.announcementPool.length;

  const message = CONFIG.announcementPool[messageIndex];

  localStorage.setItem("currentAnnouncement", message);

  const announcementKey =
    `announcement_${targetPatient.受測者編號}_${announcementIndex}`;

  if (!localStorage.getItem(announcementKey)) {
    localStorage.setItem(announcementKey, "shown");

    const queue = getQueue();

    const target = queue.find(
      p => p.受測者編號 === targetPatient.受測者編號
    );

    if (target) {
      target.公告內容紀錄.push({
        分鐘: elapsed,
        公告內容: message
      });

      saveQueue(queue);
    }
  }
}

/* =========================
   匯出 CSV
========================= */

function exportCSV() {
  const records = getRecords();

  if (records.length === 0) {
    alert("目前沒有完成資料");
    return;
  }

  const headers = [
    "實驗日期",
    "實驗條件",
    "受測者編號",
    "掛號號碼",
    "受測者姓名代碼",
    "預約時間",
    "實際報到時間",
    "候診開始時間",
    "開始看診時間",
    "候診結束時間",
    "實際等待秒數",
    "狀態"
  ];

  const rows = records.map(r =>
    headers.map(h => {
      return `"${String(r[h] || "").replace(/"/g, '""')}"`;
    }).join(",")
  );

  const csv =
    "\uFEFF" + headers.join(",") + "\n" + rows.join("\n");

  const blob = new Blob(
    [csv],
    { type: "text/csv;charset=utf-8;" }
  );

  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "候診實驗資料.csv";
  link.click();
}

/* =========================
   重置
========================= */

function resetExperiment() {
  if (confirm("確定要重置目前候診隊列嗎？")) {
    localStorage.removeItem("participantCount_A");
    localStorage.removeItem("participantCount_B");
    localStorage.removeItem("participantCount_C");

    localStorage.removeItem("waitingQueue");
    localStorage.removeItem("records");
    localStorage.removeItem("currentAnnouncement");
    localStorage.removeItem("virtualCount");
    localStorage.removeItem("queueNumber");
    localStorage.removeItem("lastVirtualName");
    localStorage.removeItem("autoVirtualStartedAt");
localStorage.removeItem("lastAutoVirtualAddedAt");

    Object.keys(localStorage).forEach(key => {
      if (key.startsWith("alertShown_")) {
        localStorage.removeItem(key);
      }

      if (key.startsWith("announcement_")) {
        localStorage.removeItem(key);
      }
    });

    renderAdmin();
    renderDisplay();
  }
}

function markMissed() {
  alert("目前已移除過號功能。");
}

/* =========================
   啟動
========================= */

document.addEventListener("DOMContentLoaded", () => {
  const condition = getConditionFromUrlOrStorage();

  document.body.addEventListener(
  "click",
  () => {
    playCallBell();
  },
  { once: true }
);

  const conditionEl =
    document.getElementById("currentCondition");

  if (conditionEl) {
    conditionEl.textContent = condition;
  }

  renderAdmin();
  renderDisplay();

  window.addEventListener("storage", () => {
    renderAdmin();
    renderDisplay();
  });

  setInterval(() => {
    updateQueueStatus();
    renderAdmin();
  }, 1000);

  setInterval(() => {
    renderDisplay();
  }, CONFIG.displayUpdateSeconds * 1000);
});