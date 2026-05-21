const CONFIG = {
  totalMinutes: 15,
  consultationMinutes: 5,
    googleSheetUrl: "https://script.google.com/macros/s/AKfycbzaRn6DKS-2gwJMgppeXgMw2LdDV5-PSMzrbVdTtCFOVYGNwMUqYd7ZYNVI7ZZq8q-6/exec",
  displayExtraMinutes: 2,
  passExtraMinutes: 3,
  maxDisplayPatients: 15,

  initialVirtualMin: 2,
  initialVirtualMax: 3,

  duringVirtualMin: 1,
  duringVirtualMax: 2,
  duringVirtualMinutes: [5, 10],

  announcementSchedule: [4, 9, 13],
  announcementDurationMinutes: 1,

  announcementPool: [
    "醫師正在用餐中…",
    "醫師正在確認診療資料…",
    "醫師正在整理設備…",
    "醫師正在木工廠備料中…",
    "醫師正在進行前一位患者診療…"
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

function saveCondition() {
  const select = document.getElementById("conditionSelect");
  localStorage.setItem("experimentCondition", select.value);
  window.location.href = "admin.html";
}

document.addEventListener("DOMContentLoaded", () => {
  const condition = localStorage.getItem("experimentCondition") || "A";
  const conditionEl = document.getElementById("currentCondition");
  if (conditionEl) conditionEl.textContent = condition;

  renderAdmin();
  renderDisplay();

    window.addEventListener("storage", () => {
    renderDisplay();
    renderAdmin();
  });

  setInterval(() => {
    updateQueueStatus();
    renderAdmin();
  }, 1000);

  setInterval(() => {
    renderDisplay();
  }, 60000);
});

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
function generateQueueNumber() {
  const currentNumber =
    Number(localStorage.getItem("queueNumber") || "0") + 1;

  localStorage.setItem(
    "queueNumber",
    String(currentNumber)
  );

  return String(currentNumber).padStart(3, "0");
}

function createVirtualParticipant(minutesAlreadyWaited = 0) {
  const virtualCount = Number(localStorage.getItem("virtualCount") || "0") + 1;
  localStorage.setItem("virtualCount", String(virtualCount));

  const name =
    CONFIG.virtualNames[Math.floor(Math.random() * CONFIG.virtualNames.length)];

  const startTime = Date.now() - minutesAlreadyWaited * 60000;

  return {
    實驗日期: new Date().toLocaleDateString("zh-TW"),
    實驗條件: localStorage.getItem("experimentCondition") || "A",
    受測者編號: `V${String(virtualCount).padStart(3, "0")}`,
掛號號碼: generateQueueNumber(),
    受測者姓名代碼: name,
    預約時間: "",
    實際報到時間: new Date().toLocaleTimeString("zh-TW"),
    候診開始時間: new Date().toLocaleTimeString("zh-TW"),
    開始時間戳: startTime,
    候診結束時間: "",
    實際等待秒數: "",
    顯示延長分鐘: 0,
    是否過號: "否",
    過號時間: "",
    狀態: "候診中",
    公告內容紀錄: [],
    是否虛擬: true,
    已加入中途虛擬: []
  };
}

function addInitialVirtualPatientsIfNeeded() {
  const queue = getQueue();
  const hasReal = queue.some(p => !p.是否虛擬);

  if (hasReal || queue.length > 0) return queue;

  // 第一位：正在看診
  const seeingPatient = createVirtualParticipant(randomInt(5, 12));
  seeingPatient.狀態 = "正在看診";

  queue.push(seeingPatient);

  // 後面候診者
  const waitingCount = randomInt(2, 3);

  for (let i = 0; i < waitingCount; i++) {
    queue.push(
      createVirtualParticipant(randomInt(1, 10))
    );
  }

  saveQueue(queue);

  // 保持目前號碼有人
  localStorage.setItem(
    "lastSeenPatient",
    JSON.stringify(seeingPatient)
  );

  return queue;
}

function addDuringVirtualPatientsFor(realParticipant) {
  const queue = getQueue();

  if (!realParticipant || realParticipant.是否虛擬) return;

  const elapsedMinute = getElapsedMinutes(realParticipant);

  if (!CONFIG.duringVirtualMinutes.includes(elapsedMinute)) return;

  realParticipant.已加入中途虛擬 = realParticipant.已加入中途虛擬 || [];

  if (realParticipant.已加入中途虛擬.includes(elapsedMinute)) return;

  const count = randomInt(CONFIG.duringVirtualMin, CONFIG.duringVirtualMax);

  for (let i = 0; i < count; i++) {
    queue.push(createVirtualParticipant(0));
  }

  const target = queue.find(p => p.受測者編號 === realParticipant.受測者編號);
  if (target) {
    target.已加入中途虛擬 = target.已加入中途虛擬 || [];
    target.已加入中途虛擬.push(elapsedMinute);
  }

  saveQueue(queue);
}

function checkInParticipant() {
  let queue = addInitialVirtualPatientsIfNeeded();

  const id = document.getElementById("participantId")?.value.trim();
  const name = document.getElementById("participantName")?.value.trim();
  const appointment = document.getElementById("appointmentTime")?.value || "";

  let maskedName = name;

  if (name.length === 2) {
    maskedName = name[0] + "○";
  }

  if (name.length >= 3) {
    maskedName =
      name[0] + "○" + name[name.length - 1];
  }

  if (!id) {
    alert("請輸入受測者編號");
    return;
  }

  const participant = {
    實驗日期: new Date().toLocaleDateString("zh-TW"),
    實驗條件: localStorage.getItem("experimentCondition") || "A",
    受測者編號: id,
掛號號碼: generateQueueNumber(),
    受測者姓名代碼: maskedName || "未填寫",
    預約時間: appointment,
    實際報到時間: new Date().toLocaleTimeString("zh-TW"),
    候診開始時間: new Date().toLocaleTimeString("zh-TW"),
    開始時間戳: Date.now(),
    候診結束時間: "",
    實際等待秒數: "",
    顯示延長分鐘: 0,
    是否過號: "否",
    過號時間: "",
    狀態: "候診中",
    公告內容紀錄: [],
    是否虛擬: false,
    已加入中途虛擬: []
  };

  queue.push(participant);
  saveQueue(queue);

  document.getElementById("participantId").value = "";
  document.getElementById("participantName").value = "";

  renderAdmin();
  renderDisplay();
}

function getElapsedSeconds(p) {
  if (p.狀態 === "已看診" && p.實際等待秒數 !== "") {
    return Number(p.實際等待秒數);
  }

  return Math.floor((Date.now() - p.開始時間戳) / 1000);
}

function getElapsedMinutes(p) {
  return Math.floor(getElapsedSeconds(p) / 60);
}

function getDisplayRemainingMinutes(p) {
  const elapsed = getElapsedMinutes(p);
  const extra = p.顯示延長分鐘 || 0;

  return Math.max(
    CONFIG.totalMinutes + CONFIG.displayExtraMinutes + extra - elapsed,
    0
  );
}

function updateQueueStatus() {
  const queue = getQueue();
  let changed = false;

  queue.forEach(p => {
    if (p.狀態 === "正在看診") {
  const consultSeconds =
    Math.floor((Date.now() - p.開始看診時間戳) / 1000);

  if (consultSeconds >= CONFIG.consultationMinutes * 60) {
    p.狀態 = "已看診";
    p.候診結束時間 = new Date().toLocaleTimeString("zh-TW");

    const nextVirtual = queue.find(
      item => item.狀態 === "候診中" && item.是否虛擬
    );

    if (nextVirtual) {
      nextVirtual.狀態 = "正在看診";
      nextVirtual.開始看診時間 = new Date().toLocaleTimeString("zh-TW");
      nextVirtual.開始看診時間戳 = Date.now();
    }

    changed = true;
  }
}
    const elapsedSeconds = getElapsedSeconds(p);

    if (p.狀態 === "候診中" && elapsedSeconds >= CONFIG.totalMinutes * 60) {
      p.狀態 = p.是否虛擬 ? "已看診" : "等待確認";
      p.候診結束時間 = new Date().toLocaleTimeString("zh-TW");
      p.實際等待秒數 = elapsedSeconds;
      changed = true;
    }

    if (!p.是否虛擬 && p.狀態 === "候診中") {
      addDuringVirtualPatientsFor(p);
    }
  });

  if (changed) saveQueue(queue);
}

function markParticipantStatus(participantId, status) {
  const queue = getQueue();
  const records = getRecords();

  const index = queue.findIndex(p => p.受測者編號 === participantId);
  if (index === -1) return;

  const p = queue[index];

  if (status === "正在看診") {
    p.狀態 = "正在看診";
    p.開始看診時間 = new Date().toLocaleTimeString("zh-TW");
    p.開始看診時間戳 = Date.now();

    if (!p.是否虛擬) {
      p.候診結束時間 = new Date().toLocaleTimeString("zh-TW");
      p.實際等待秒數 = getElapsedSeconds(p);
      records.push({ ...p });
      saveRecords(records);
    }

    saveQueue(queue);
    renderAdmin();
    renderDisplay();

    alert(`${p.受測者編號} 已開始看診。`);
  }
}

function renderAdmin() {
  const tableBody = document.getElementById("queueTableBody");
  if (!tableBody) return;

  const queue = getQueue();

  if (queue.length === 0) {
    tableBody.innerHTML = `<tr><td colspan="6">目前尚無候診者</td></tr>`;
    return;
  }

  tableBody.innerHTML = queue.map((p, index) => {
    const elapsedSeconds = getElapsedSeconds(p);
    const min = Math.floor(elapsedSeconds / 60);
    const sec = elapsedSeconds % 60;
    const elapsedText = `${String(min).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;

    let actionButtons = "—";

if (p.狀態 === "等待確認" && !p.是否虛擬) {
  actionButtons = `
    <button onclick="markParticipantStatus('${p.受測者編號}', '正在看診')">
      開始看診
    </button>
  `;
}

if (p.狀態 === "等待確認" && !p.是否虛擬) {
  actionButtons = `
    <button onclick="markParticipantStatus('${p.受測者編號}', '正在看診')">
      開始看診
    </button>
  `;
}

    const typeLabel = p.是否虛擬 ? "（虛擬）" : "";

    return `
      <tr>
        <td>${p.受測者編號}${typeLabel}</td>
        <td>${p.受測者姓名代碼}</td>
        <td>${elapsedText}</td>
        <td>${getDisplayRemainingMinutes(p)} 分鐘</td>
        <td>${p.狀態}</td>
        <td>${actionButtons}</td>
      </tr>
    `;
  }).join("");

  const announcementEl = document.getElementById("currentAnnouncement");
  if (announcementEl) {
    announcementEl.textContent = localStorage.getItem("currentAnnouncement") || "—";
  }
}

function renderDisplay() {
  const currentNumber = document.getElementById("currentNumber");
  if (!currentNumber) return;

  const queue = getQueue();
  const visibleQueue = queue.filter(p => p.狀態 !== "已看診");
const seeingPatients = queue.filter(p => p.狀態 === "正在看診");
const seeingPatient =
  seeingPatients.length > 0
    ? seeingPatients[seeingPatients.length - 1]
    : null;

const waitingQueue = queue.filter(
  p => p.狀態 !== "已看診" && p.狀態 !== "正在看診"
);

const first = seeingPatient;
const nextPatient = waitingQueue[0];

  const urlParams = new URLSearchParams(window.location.search);
  const condition =
    urlParams.get("condition") ||
    localStorage.getItem("experimentCondition") ||
    "A";

  const announcementArea = document.querySelector(".announcement-area");

  if (!first && !nextPatient) {
    currentNumber.textContent = "—";
    document.getElementById("currentName").textContent = "目前尚無候診者";
    document.getElementById("nextNumber").textContent = "—";
    document.getElementById("conditionArea").innerHTML = "";
    renderDisplayQueue(queue, condition);
    if (announcementArea) announcementArea.style.display = "none";
    return;
  }

  if (first) {
  currentNumber.textContent = first.掛號號碼 || first.受測者編號;
  document.getElementById("currentName").textContent = first.受測者姓名代碼;
} else {
  currentNumber.textContent = "—";
  document.getElementById("currentName").textContent = "目前尚未開始看診";
}

document.getElementById("nextNumber").textContent =
  nextPatient?.掛號號碼 || nextPatient?.受測者編號 || "—";
    const nextNameEl = document.getElementById("nextName");
if (nextNameEl) {
  nextNameEl.textContent = nextPatient?.受測者姓名代碼 || "—";
}

  const elapsed = getElapsedMinutes(first);
  const percent = Math.min((elapsed / CONFIG.totalMinutes) * 100, 100);
  const remaining = getDisplayRemainingMinutes(first);
  const area = document.getElementById("conditionArea");

  if (condition === "A") {
    area.innerHTML = "";
  }

  if (condition === "B") {
  area.innerHTML = "";
}

  if (condition === "C") {
    area.innerHTML = `
      <div class="display-estimate-box">
        <div class="display-estimate-title">預估等待時間</div>
        <div class="estimate-text">${remaining} 分鐘</div>
      </div>
    `;
  }

  updateAnnouncement(first, condition);
  renderDisplayQueue(queue, condition);

  const displayAnnouncement = document.getElementById("displayAnnouncement");

  if (condition === "A") {
    if (announcementArea) announcementArea.style.display = "none";
  } else {
    if (announcementArea) announcementArea.style.display = "grid";
    if (displayAnnouncement) {
      displayAnnouncement.textContent =
        localStorage.getItem("currentAnnouncement") || "請留意現場叫號資訊。";
    }
  }
}

function renderDisplayQueue(queue, condition) {
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

  const visibleQueue = queue
  .filter(p => p.狀態 !== "已看診" && p.狀態 !== "正在看診")
    .slice(0, CONFIG.maxDisplayPatients);

  if (visibleQueue.length === 0) {
    body.innerHTML = `<tr><td colspan="4">目前尚無候診者</td></tr>`;
    return;
  }

  body.innerHTML = visibleQueue.map(p => {
    const queueIndex = visibleQueue.findIndex(
  q => q.受測者編號 === p.受測者編號
);

const adjustedRemaining =
  (queueIndex + 1) * CONFIG.consultationMinutes;

    const displayStatus = "候診中";

    const waitText =
      remaining <= 3 && (p.狀態 === "候診中" || p.狀態 === "等待確認")
        ? `<span class="soon-status">即將叫號</span>`
        : `${adjustedRemaining} 分鐘`;
    const progressPercent = Math.min(
  (getElapsedMinutes(p) / CONFIG.totalMinutes) * 100,
  100
);

const waitColumn =
  condition === "B"
    ? `
      <td>
        <div class="mini-progress-container">
          <div class="mini-progress-bar" style="width:${progressPercent}%"></div>
        </div>
        <div class="mini-progress-text">${Math.round(progressPercent)}%</div>
      </td>
    `
    : condition === "C"
      ? `<td>${waitText}</td>`
      : "";

    return `
  <tr>
    <td>${p.掛號號碼 || p.受測者編號}</td>
    <td>${displayStatus}</td>
    <td>${p.受測者姓名代碼}</td>
    ${waitColumn}
  </tr>
`;

  }).join("");
}

function updateAnnouncement(first, condition) {
  if (condition === "A") return;

  const elapsed = getElapsedMinutes(first);
  const isAnnouncementMinute = CONFIG.announcementSchedule.includes(elapsed);
  const key = `announcement_${first.受測者編號}_${elapsed}`;

  if (isAnnouncementMinute && !localStorage.getItem(key)) {
    const message =
      CONFIG.announcementPool[
        Math.floor(Math.random() * CONFIG.announcementPool.length)
      ];

    localStorage.setItem("currentAnnouncement", message);
    localStorage.setItem(key, "shown");

    const queue = getQueue();
    const target = queue.find(p => p.受測者編號 === first.受測者編號);

    if (target) {
      target.公告內容紀錄.push({
        分鐘: elapsed,
        公告內容: message
      });

      target.顯示延長分鐘 =
        (target.顯示延長分鐘 || 0) + CONFIG.passExtraMinutes;

      saveQueue(queue);
    }
  }

  const shouldShowAnnouncement = CONFIG.announcementSchedule.some(start => {
    return elapsed >= start && elapsed < start + CONFIG.announcementDurationMinutes;
  });

  if (!shouldShowAnnouncement) {
    localStorage.setItem("currentAnnouncement", "請留意現場叫號資訊。");
  }
}

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
  "顯示延長分鐘",
  "是否過號",
  "過號時間",
  "狀態",
  "公告內容紀錄"
];

  const rows = records.map(r =>
    headers.map(h => {
      const value =
        h === "公告內容紀錄"
          ? JSON.stringify(r[h] || [])
          : r[h] || "";
      return `"${String(value).replace(/"/g, '""')}"`;
    }).join(",")
  );

  const csv = "\uFEFF" + headers.join(",") + "\n" + rows.join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });

  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "候診實驗資料.csv";
  link.click();
}

function markMissed() {
  alert("目前已移除過號功能，請使用「已看診」完成受測者流程。");
}

function resetExperiment() {
  if (confirm("確定要重置目前候診隊列嗎？")) {
    localStorage.removeItem("waitingQueue");
    localStorage.removeItem("currentAnnouncement");
    localStorage.removeItem("virtualCount");
    localStorage.removeItem("lastSeenPatient");
    localStorage.removeItem("queueNumber");
    renderAdmin();
    renderDisplay();
  }
}

function openDisplay() {
  const condition = localStorage.getItem("experimentCondition") || "A";
  window.open(`display.html?condition=${condition}`, "_blank");
}
async function uploadRecordsToGoogleSheet() {
  const records = getRecords();

  if (records.length === 0) {
    alert("目前沒有完成資料可以上傳。");
    return;
  }

  for (const record of records) {
    await fetch(CONFIG.googleSheetUrl, {
      method: "POST",
      mode: "no-cors",
      body: JSON.stringify(record)
    });
  }

  alert("已送出，請查看 Google Sheets 是否新增資料。");
}