let items = JSON.parse(localStorage.getItem("cashForecastItems")) || [];
let skippedEvents = JSON.parse(localStorage.getItem("cashForecastSkippedEvents")) || [];
let editingId = null;
let chartPoints = [];
let selectedChartIndex = null;
let currentForecast = [];
let currentStartingBalance = 0;
let currentCalendarDate = new Date();
let selectedCalendarDate = null;
let returnToCalendarAfterEdit = false;
let returnToForecastAfterEdit = false;
let returnToSettingsAfterEdit = false;
let returnToNonNegotiablesAfterEdit = false;
let returnAfterEditTab = null;
let returnAfterEditScrollTarget = null;
let currentOverviewForecast = [];
let deletedItems =
  JSON.parse(localStorage.getItem("cashForecastDeletedItems")) || [];
let historyItems =
  JSON.parse(localStorage.getItem("cashForecastHistoryItems")) || [];
let scrubberTimeout;
let pinnedChartSelection = false;
let pendingHistoryUndo = null;
let processedEarlyItems = JSON.parse(localStorage.getItem("processedEarlyItems")) || [];
let selectedDeletedItems = new Set();
let pendingRecurringEdit = null;
let recurringEditMode = null;

const balanceInput = document.getElementById("balance");
const bufferInput = document.getElementById("buffer");
const rangeInput = document.getElementById("range");

balanceInput.value = localStorage.getItem("cashForecastBalance") || "";
bufferInput.value = localStorage.getItem("cashForecastBuffer") || "";
rangeInput.value = localStorage.getItem("cashForecastRange") || "30";

balanceInput.addEventListener("input", saveSettings);
bufferInput.addEventListener("input", saveSettings);
rangeInput.addEventListener("change", saveSettings);

document.querySelectorAll("select").forEach(select => {
  select.addEventListener("change", function () {
    setTimeout(() => {
  requestAnimationFrame(() => {
    drawChart(currentForecast, currentStartingBalance, "balanceChart");
    drawChart(currentOverviewForecast, currentStartingBalance, "overviewChart");
  });
}, 250);
  });
});


calculate();

const chartCanvas = document.getElementById("balanceChart");




let isScrubbingChart = false;

chartCanvas.addEventListener("pointerdown", event => {
  isScrubbingChart = true;
  chartCanvas.setPointerCapture(event.pointerId);
  handleChartTap(event);
});

chartCanvas.addEventListener("pointermove", event => {
  if (!isScrubbingChart) return;
  handleChartTap(event);
});

chartCanvas.addEventListener("pointerup", event => {
  isScrubbingChart = false;
  chartCanvas.releasePointerCapture(event.pointerId);
});

chartCanvas.addEventListener("pointercancel", () => {
  isScrubbingChart = false;
});
window.addEventListener("resize", () => {
  drawChart(currentForecast, currentStartingBalance, "balanceChart");
  drawChart(currentOverviewForecast, currentStartingBalance, "overviewChart");
});

function saveHistoryItems() {
  localStorage.setItem(
    "cashForecastHistoryItems",
    JSON.stringify(historyItems)
  );

  showSaveIndicator();
}

function saveSettings() {
  localStorage.setItem("cashForecastBalance", balanceInput.value);
  localStorage.setItem("cashForecastBuffer", bufferInput.value);
  localStorage.setItem("cashForecastRange", rangeInput.value);
  calculate();
  showSaveIndicator();
}



function toggleCustomRepeatFields() {
  
  const repeat = document.getElementById("repeat").value;

  const customFields =
    document.getElementById("customRepeatFields");

  if (repeat === "custom") {
    customFields.style.display = "block";
  } else {
    customFields.style.display = "none";
  }
}

function saveProcessedEarlyItems() {
  localStorage.setItem("processedEarlyItems", JSON.stringify(processedEarlyItems));
}

function showSaveIndicator() {
  const indicator = document.getElementById("saveIndicator");

  if (!indicator) return;

  indicator.classList.add("show");

  clearTimeout(window.saveIndicatorTimeout);

  window.saveIndicatorTimeout = setTimeout(() => {
    indicator.classList.remove("show");
  }, 1200);
}

function toggleHistoryPanel() {
  const panel = document.getElementById("historyPanel");
  const toggle = document.getElementById("historyToggle");

  if (!panel || !toggle) return;

  const isOpen = panel.style.display !== "none";

  panel.style.display = isOpen ? "none" : "block";
  toggle.classList.toggle("closed", isOpen);

  displayCalendarHistory();
}
function toggleDashCard(type) {
  const front = document.getElementById(type + "Front");
  const back = document.getElementById(type + "Back");

  if (!front || !back) return;

  const showingFront = front.style.display !== "none";

  const hide = showingFront ? front : back;
  const show = showingFront ? back : front;

  hide.style.opacity = "0";

  setTimeout(() => {
    hide.style.display = "none";

    show.style.display = "block";
    show.style.opacity = "0";

    requestAnimationFrame(() => {
      show.style.opacity = "1";
    });
  }, 150);
}
function showTab(tabId) {
  document.querySelectorAll(".tab-content").forEach(tab => {
    tab.classList.remove("active-tab");
  });

  document.querySelectorAll(".tab-button").forEach(button => {
    button.classList.remove("active");
  });

  document.getElementById(tabId).classList.add("active-tab");
  
  setTimeout(() => {
  drawChart(currentForecast, currentStartingBalance, "balanceChart");
  drawChart(currentOverviewForecast, currentStartingBalance, "overviewChart");
}, 50);

  const matchingButton = document.querySelector(
    `.tab-button[onclick="showTab('${tabId}')"]`
  );

  if (matchingButton) {
    matchingButton.classList.add("active");
  }
}

const tabOrder = [
  "overviewTab",
  "forecastTab",
  "calendarTab",
  "settingsTab"
];

let touchStartX = 0;
let touchStartY = 0;

document.addEventListener("touchstart", event => {
  if (
    event.target.closest(".chart-scroll") ||
    event.target.closest(".overview-chart-wrap")
  ) {
    return;
  }

  touchStartX = event.touches[0].clientX;
  touchStartY = event.touches[0].clientY;
});

document.addEventListener("touchend", event => {
  const touchEndX = event.changedTouches[0].clientX;
  const touchEndY = event.changedTouches[0].clientY;

  const diffX = touchStartX - touchEndX;
  const diffY = touchStartY - touchEndY;

  if (Math.abs(diffX) < 60) return;
  if (Math.abs(diffY) > 50) return;

  const activeTab = document.querySelector(
    ".tab-content.active-tab"
  );

  if (!activeTab) return;

  const currentIndex = tabOrder.indexOf(activeTab.id);

  if (currentIndex === -1) return;

  if (
    diffX > 0 &&
    currentIndex < tabOrder.length - 1
  ) {
    showTab(tabOrder[currentIndex + 1]);
  }

  if (
    diffX < 0 &&
    currentIndex > 0
  ) {
    showTab(tabOrder[currentIndex - 1]);
  }
});

let mouseStartX = 0;
let mouseStartY = 0;
let isMouseDown = false;

document.addEventListener("mousedown", event => {
  if (
    event.target.closest(".chart-scroll") ||
    event.target.closest(".overview-chart-wrap")
  ) {
    return;
  }

  isMouseDown = true;

  mouseStartX = event.clientX;
  mouseStartY = event.clientY;
});

document.addEventListener("mouseup", event => {
  if (!isMouseDown) return;

  isMouseDown = false;

  const diffX = mouseStartX - event.clientX;
  const diffY = mouseStartY - event.clientY;

  if (Math.abs(diffX) < 60) return;
  if (Math.abs(diffY) > 50) return;

  const activeTab = document.querySelector(
    ".tab-content.active-tab"
  );

  if (!activeTab) return;

  const currentIndex = tabOrder.indexOf(activeTab.id);

  if (currentIndex === -1) return;

  if (
    diffX > 0 &&
    currentIndex < tabOrder.length - 1
  ) {
    showTab(tabOrder[currentIndex + 1]);
  }

  if (
    diffX < 0 &&
    currentIndex > 0
  ) {
    showTab(tabOrder[currentIndex - 1]);
  }
});

function updateSaveButtonState() {
  const name = document.getElementById("name").value.trim();
  const amount = document.getElementById("amount").value;
  const date = document.getElementById("date").value;
  const saveButton = document.getElementById("saveButton");
const endType = document.getElementById("endType").value || "never";
const endDate = document.getElementById("endDate").value || "";
const endCount = parseInt(document.getElementById("endCount").value) || "";


  if (!saveButton) return;

  const formIsValid = name && amount && date;

  saveButton.disabled = !formIsValid;
}

["name", "amount", "date"].forEach(id => {
  const input = document.getElementById(id);

  if (input) {
    input.addEventListener("input", updateSaveButtonState);
  }
});

function saveDeletedItems() {
  localStorage.setItem(
    "cashForecastDeletedItems",
    JSON.stringify(deletedItems)
  );

  showSaveIndicator();
}


function saveFormItem() {
  const name = document.getElementById("name").value.trim();
  let amount = parseFloat(document.getElementById("amount").value);
  const type = document.getElementById("type").value;
  const date = document.getElementById("date").value;
  const repeat = document.getElementById("repeat").value;
const customInterval =
  parseInt(document.getElementById("customInterval").value) || 1;

const customUnit =
  document.getElementById("customUnit").value;
  const endType = document.getElementById("endType").value || "never";
const endDate = document.getElementById("endDate").value || "";
const endCount = parseInt(document.getElementById("endCount").value) || "";
  
  if (!name || isNaN(amount) || !date) {
    alert("Please fill in name, amount, and date.");
    return;
  }

  amount = type === "bill" ? -Math.abs(amount) : Math.abs(amount);
if (
  pendingRecurringEdit &&
  recurringEditMode === "single"
) {
  const originalItem = items.find(
    item => String(item.id) === String(pendingRecurringEdit.itemId)
  );

  if (!originalItem) return;

  const skipKey =
    pendingRecurringEdit.itemId + "|" + pendingRecurringEdit.dateKey;

  const alreadySkipped = skippedEvents.some(
    skip => skip.key === skipKey
  );

  if (!alreadySkipped) {
    skippedEvents.push({
      key: skipKey,
      itemId: pendingRecurringEdit.itemId,
      dateKey: pendingRecurringEdit.dateKey,
      name: originalItem.name,
      amount: originalItem.amount,
      editedOccurrence: true
    });
  }

  items.push({
    id: Date.now(),
    name,
    amount,
    type,
    date,
    repeat: "once",
    customInterval: 1,
    customUnit: "days",
    endType: "never",
    endDate: "",
    endCount: ""
  });

  pendingRecurringEdit = null;
  recurringEditMode = null;
  editingId = null;

  saveItems();
  saveSkippedEvents();
  clearInputs();
  calculate();

  returnToForecastAfterEdit = false;
  showTab("forecastTab");
  return;
}
if (
  pendingRecurringEdit &&
  recurringEditMode === "future"
) {
  const originalItem = items.find(
    item => String(item.id) === String(pendingRecurringEdit.itemId)
  );

  if (!originalItem) return;

  const previousDateKey = getPreviousOccurrenceDate(
    originalItem,
    pendingRecurringEdit.dateKey
  );

  items = items.map(item => {
    if (String(item.id) === String(originalItem.id)) {
      return {
        ...item,
        endType: previousDateKey ? "date" : "count",
        endDate: previousDateKey || "",
        endCount: previousDateKey ? "" : 0
      };
    }

    return item;
  });

  items.push({
    id: Date.now(),
    name,
    amount,
    type,
    date: pendingRecurringEdit.dateKey,
    repeat,
    customInterval,
    customUnit,
    endType,
    endDate,
    endCount
  });

  pendingRecurringEdit = null;
  recurringEditMode = null;
  editingId = null;

  saveItems();
  clearInputs();
  calculate();

  returnToForecastAfterEdit = false;
  showTab("forecastTab");
  return;
}
 if (editingId !== null) {
  items = items.map(item => {
    if (item.id === editingId) {
      return {
        id: item.id,
        name,
        amount,
        type,
        date,
        repeat,
        customInterval,
        customUnit,
        endType,
        endDate,
        endCount,
        
        fromHistoryUndo: item.fromHistoryUndo || false
      };
    }

    return item;
  });

  if (
  pendingHistoryUndo &&
  pendingHistoryUndo.restoredItemId === editingId
) {
  historyItems = historyItems.filter(
    item => item.historyKey !== pendingHistoryUndo.originalHistoryItem.historyKey
  );

  saveHistoryItems();

  pendingHistoryUndo = null;
}

  editingId = null;
    document.getElementById("formTitle").innerText = "Add Income or Bill";
    document.getElementById("saveButton").innerText = "Add";
    document.getElementById("cancelEditButton").style.display = "none";
} else {
  items.push({
    id: Date.now(),
    name,
    amount,
    type,
    date,
    repeat,
    customInterval,
    customUnit,
    endType,
    endDate,
    endCount
  });
}

saveItems();
clearInputs();
calculate();

toggleCustomRepeatFields();

if (returnToCalendarAfterEdit) {
  showTab("calendarTab");
  returnToCalendarAfterEdit = false;
}

if (returnToForecastAfterEdit) {
  showTab("forecastTab");
  returnToForecastAfterEdit = false;
}
 
}

function editItem(id) {
  

  const item = items.find(item => item.id === id);
  if (!item) return;
 
  editingId = id;

  document.getElementById("name").value = item.name;
  document.getElementById("amount").value = Math.abs(item.amount);
  document.getElementById("type").value = item.type;
  document.getElementById("date").value = item.date;
  document.getElementById("repeat").value = item.repeat;
  document.getElementById("customInterval").value =
  item.customInterval || 1;

document.getElementById("customUnit").value =
  item.customUnit || "days";

document.getElementById("endType").value =
  item.endType || "never";

document.getElementById("endDate").value =
  item.endDate || "";

document.getElementById("endCount").value =
  item.endCount || "";

toggleCustomRepeatFields();
toggleEndRepeatFields();

  document.getElementById("formTitle").innerText = "Edit Item";
  document.getElementById("saveButton").innerText = "Save Changes";
  document.getElementById("cancelEditButton").style.display = "block";
  document.getElementById("saveButton").disabled = false;
document.getElementById("saveButton").classList.add("active");

  const formCard = document.getElementById("formTitle");

const y =
  formCard.getBoundingClientRect().top +
  window.pageYOffset -
  120;

window.scrollTo({
  top: y,
  behavior: "smooth"
});
}

function startFutureCashEdit(itemId, dateKey) {
  const item = items.find(item => String(item.id) === String(itemId));
  if (!item) return;

  if (item.repeat === "once") {
    editItem(item.id);
    return;
  }

  pendingRecurringEdit = {
    itemId: item.id,
    dateKey
  };

  openRecurringEditModal();
}

function cancelEdit() {
  if (pendingHistoryUndo) {
    if (pendingHistoryUndo.removeRestoredItemOnCancel) {
      items = items.filter(item => item.id !== pendingHistoryUndo.restoredItemId);
    }

    const alreadyBackInHistory = historyItems.some(
      item => item.historyKey === pendingHistoryUndo.originalHistoryItem.historyKey
    );

    if (!alreadyBackInHistory) {
      historyItems.push(pendingHistoryUndo.originalHistoryItem);
    }

    pendingHistoryUndo = null;
    editingId = null;

    clearInputs();

    document.getElementById("formTitle").innerText = "Add Income or Bill";
    document.getElementById("saveButton").innerText = "Add";
    document.getElementById("cancelEditButton").style.display = "none";

    saveItems();
    saveHistoryItems();
    calculate();

    showTab("calendarTab");
    return;
  }

  editingId = null;
  clearInputs();

  document.getElementById("formTitle").innerText = "Add Income or Bill";
  document.getElementById("saveButton").innerText = "Add";
  document.getElementById("cancelEditButton").style.display = "none";

  if (returnAfterEditTab) {
    showTab(returnAfterEditTab);

    if (returnAfterEditScrollTarget) {
      setTimeout(() => {
        const target = document.getElementById(returnAfterEditScrollTarget);

        if (target) {
          target.scrollIntoView({
            behavior: "smooth",
            block: "start"
          });
        }
      }, 100);
    }

    returnAfterEditTab = null;
    returnAfterEditScrollTarget = null;
  }
}  
function deleteItem(id) {
  showConfirmModal(
    "Delete this item?",
    () => {
      const itemToDelete = items.find(item => item.id === id);

      if (itemToDelete) {
        deletedItems.push({
          ...itemToDelete,
          deletedAt: new Date().toISOString()
        });

        saveDeletedItems();
      }

      items = items.filter(item => item.id !== id);
      skippedEvents = skippedEvents.filter(skip => skip.itemId !== id);

      saveItems();
      saveSkippedEvents();

      calculate();
    }
  );

  return;
}

function saveItems() {
  localStorage.setItem("cashForecastItems", JSON.stringify(items));
  showSaveIndicator();
}

function saveSkippedEvents() {
  localStorage.setItem("cashForecastSkippedEvents", JSON.stringify(skippedEvents));
  showSaveIndicator();
}

function clearInputs() {
  document.getElementById("name").value = "";
  document.getElementById("amount").value = "";
  document.getElementById("date").value = "";
  document.getElementById("repeat").value = "once";
  document.getElementById("type").value = "bill";
  document.getElementById("endType").value = "never";
  document.getElementById("endDate").value = "";
  document.getElementById("endCount").value = "";
toggleEndRepeatFields();

  updateSaveButtonState();
}

function getSkipKey(itemId, dateObj) {
  return itemId + "|" + dateToKey(dateObj);
}

function dateToKey(dateObj) {
  return dateObj.toISOString().split("T")[0];
}

function isSkipped(itemId, dateObj) {
  const key = getSkipKey(itemId, dateObj);
  return skippedEvents.some(skip => skip.key === key);
}

function processEarly(itemId, dateKey, name, amount) {
  showConfirmModal(
    "Process this item today? Your current balance will update now, and the original future date will be marked as processed early.",
    () => {

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const todayKey = dateToKey(today);
      const originalKey = itemId + "|" + dateKey;
      const processedEarlyKey = itemId + "|" + todayKey + "|early|" + dateKey;

      const alreadyProcessed = processedEarlyItems.some(
        item => item.originalKey === originalKey
      );

      if (alreadyProcessed) {
        alert("This item was already processed early.");
        return;
      }

      const currentBalance = parseFloat(balanceInput.value) || 0;
      balanceInput.value = (currentBalance + amount).toFixed(2);
      localStorage.setItem("cashForecastBalance", balanceInput.value);

      processedEarlyItems.push({
        key: processedEarlyKey,
        originalKey,
        itemId,
        originalDateKey: dateKey,
        processedDateKey: todayKey,
        name,
        amount,
        loggedAt: new Date().toISOString()
      });

      historyItems.push({
        itemId,
        date: today,
        dateKey: todayKey,
        name,
        amount,
        repeat: "once",
        skipped: false,
        processedEarly: true,
        originalDateKey: dateKey,
        historyKey: processedEarlyKey,
        loggedAt: new Date().toISOString()
      });

      saveItems();
      saveHistoryItems();
      saveProcessedEarlyItems();
      calculate();
    }
  );
}

function skipEvent(itemId, dateKey, name, amount = 0) {
  const key = itemId + "|" + dateKey;

  if (!skippedEvents.some(skip => skip.key === key)) {

    skippedEvents.push({
  key,
  itemId,
  dateKey,
  name,
  amount
});

console.log("Skipped events now:", skippedEvents);
  }

  saveSkippedEvents();
  calculate();
  refreshSelectedCalendarDay();
}

function restoreDeletedItem(id) {
  const itemIndex = deletedItems.findIndex(item => item.id === id);

  if (itemIndex === -1) return;

  const restoredItem = deletedItems[itemIndex];

  if (restoredItem.deletedFrom === "skipped") {
    skippedEvents.push({
      key: restoredItem.skipKey,
      itemId: restoredItem.itemId,
      dateKey: restoredItem.date,
      name: restoredItem.name,
      amount: restoredItem.amount
    });
  } else {
    items.push({
      ...restoredItem
    });
  }

  deletedItems.splice(itemIndex, 1);

  saveItems();
  saveSkippedEvents();
  saveDeletedItems();

  calculate();
}


function restoreEvent(key) {
 skippedEvents = skippedEvents.filter(skip => skip.key !== key);
saveSkippedEvents();
calculate();
refreshSelectedCalendarDay();
}
function removeSkippedEvent(key) {

  const skipToRemove = skippedEvents.find(item => item.key === key);
  console.log("skipToRemove:", skipToRemove);
  if (!skipToRemove) return;
  

  showConfirmModal(
    "Remove this skipped item? It will move to Deleted Items.",
    () => {
      deletedItems.push({
        id: Date.now(),
        itemId: skipToRemove.itemId,
        name: skipToRemove.name,
        amount: skipToRemove.amount,
        date: skipToRemove.dateKey,
        repeat: "once",
        deletedAt: new Date().toISOString(),
        deletedFrom: "skipped",
        skipKey: skipToRemove.key
      });

      skippedEvents = skippedEvents.filter(item => item.key !== key);

      saveDeletedItems();
      saveSkippedEvents();
      calculate();
      refreshSelectedCalendarDay();
    }
  );
}
function addMonthsSafe(date, monthsToAdd, preferredDay) {
  const targetDay = preferredDay || date.getDate();

  const newDate = new Date(date);
  newDate.setDate(1);
  newDate.setMonth(newDate.getMonth() + monthsToAdd);

  const lastDayOfTargetMonth = new Date(
    newDate.getFullYear(),
    newDate.getMonth() + 1,
    0
  ).getDate();

  newDate.setDate(Math.min(targetDay, lastDayOfTargetMonth));

  return newDate;
}
function getPreviousOccurrenceDate(item, selectedDateKey) {
  const selectedDate = new Date(selectedDateKey + "T00:00:00");
  let itemDate = new Date(item.date + "T00:00:00");
  const preferredMonthlyDay = itemDate.getDate();

  let previousDate = null;
  let safetyCounter = 0;

  while (itemDate < selectedDate && safetyCounter < 500) {
    safetyCounter++;

    previousDate = new Date(itemDate);

    if (item.repeat === "weekly") {
      itemDate.setDate(itemDate.getDate() + 7);
    } else if (item.repeat === "biweekly") {
      itemDate.setDate(itemDate.getDate() + 14);
    } else if (item.repeat === "monthly") {
      itemDate = addMonthsSafe(itemDate, 1, preferredMonthlyDay);
    } else if (item.repeat === "yearly") {
      itemDate.setFullYear(itemDate.getFullYear() + 1);
    } else if (item.repeat === "custom") {
      const interval = item.customInterval || 1;
      const unit = item.customUnit || "days";

      if (unit === "days") {
        itemDate.setDate(itemDate.getDate() + interval);
      } else if (unit === "weeks") {
        itemDate.setDate(itemDate.getDate() + interval * 7);
      } else if (unit === "months") {
        itemDate = addMonthsSafe(itemDate, interval, preferredMonthlyDay);
      } else {
        break;
      }
    } else {
      break;
    }
  }

  return previousDate ? dateToKey(previousDate) : null;
}
function buildEventsUntil(endDate, today) {
  let events = [];

  items.forEach(item => {
    let itemDate = new Date(item.date + "T00:00:00");
    const preferredMonthlyDay = itemDate.getDate();
    let safetyCounter = 0;
    let occurrenceCount = 0;

    const repeatEndDate = item.endDate
      ? new Date(item.endDate + "T00:00:00")
      : null;

    while (itemDate <= endDate && safetyCounter < 500) {
      safetyCounter++;

      if (
        item.endType === "date" &&
        repeatEndDate &&
       dateToKey(itemDate) > dateToKey(repeatEndDate)
      ) {
        break;
      }

      occurrenceCount++;

      if (
        item.endType === "count" &&
        item.endCount &&
        occurrenceCount > item.endCount
      ) {
        break;
      }

      if (itemDate > today) {
        const dateKey = dateToKey(itemDate);
        const originalKey = item.id + "|" + dateKey;

        const processedEarly = processedEarlyItems.some(
          processed => processed.originalKey === originalKey
        );

        if (!processedEarly) {
          const skipped = isSkipped(item.id, itemDate);

          events.push({
            itemId: item.id,
            date: new Date(itemDate),
            dateKey,
            name: item.name,
            amount: item.amount,
            repeat: item.repeat,
            skipped
          });
        }
      }

      if (item.repeat === "once") break;

      if (item.repeat === "weekly") {
        itemDate.setDate(itemDate.getDate() + 7);
      } else if (item.repeat === "biweekly") {
        itemDate.setDate(itemDate.getDate() + 14);
      } else if (item.repeat === "monthly") {
        itemDate = addMonthsSafe(itemDate, 1, preferredMonthlyDay);
      } else if (item.repeat === "yearly") {
        itemDate.setFullYear(itemDate.getFullYear() + 1);
      } else if (item.repeat === "firstBusinessDay") {
        const nextMonth = itemDate.getMonth() + 1;
        const nextYear =
          itemDate.getFullYear() +
          Math.floor(nextMonth / 12);

        itemDate = getFirstBusinessDay(nextYear, nextMonth % 12);
      } else if (item.repeat === "lastBusinessDay") {
        const nextMonth = itemDate.getMonth() + 1;
        const nextYear =
          itemDate.getFullYear() +
          Math.floor(nextMonth / 12);

        itemDate = getLastBusinessDay(nextYear, nextMonth % 12);
      } else if (item.repeat === "custom") {
        const interval = item.customInterval || 1;
        const unit = item.customUnit || "days";

        if (unit === "days") {
          itemDate.setDate(itemDate.getDate() + interval);
        } else if (unit === "weeks") {
          itemDate.setDate(itemDate.getDate() + interval * 7);
        } else if (unit === "months") {
          itemDate = addMonthsSafe(itemDate, interval, preferredMonthlyDay);
        } else {
          break;
        }
      } else {
        break;
      }
    }
  });

  events.sort((a, b) => a.date - b.date);

  return events;
}



function calculate() {
  displayItems();
  displaySkippedItems();
  displayDeletedItems();
  displayItems();
displaySkippedItems();
displayDeletedItems();
displayCalendarHistory();

let balance = parseFloat(balanceInput.value) || 0;
let buffer = parseFloat(bufferInput.value) || 0;

let rangeDays = window.rangeDays || parseInt(rangeInput.value) || 30;
window.rangeDays = rangeDays;
  

  const today = new Date();
  today.setHours(0,0,0,0);

  const endDate = new Date(today);
  endDate.setDate(endDate.getDate() + rangeDays);

  let events = buildEventsUntil(endDate, today);

const overviewEndDate = new Date(today);
overviewEndDate.setDate(overviewEndDate.getDate() + 90);

let overviewEvents = buildEventsUntil(overviewEndDate, today);

 

  let forecast = [];
  let runningBalance = balance;

  events.forEach(event => {
    if (!event.skipped) {
      runningBalance += event.amount;
    }

    forecast.push({
      ...event,
      balance: runningBalance
    });
  });

items.forEach(item => {
  let itemDate = new Date(item.date + "T00:00:00");
  itemDate.setHours(0, 0, 0, 0);

  const todayCopy = new Date();
  todayCopy.setHours(0, 0, 0, 0);

  const dateKey = dateToKey(itemDate);
const historyKey = item.id + "|" + dateKey;

const alreadyLogged = historyItems.some(
  historyItem => historyItem.historyKey === historyKey
);

const alreadyDeleted = deletedItems.some(
  deletedItem => deletedItem.historyKey === historyKey
);

const alreadySkipped = skippedEvents.some(
  skip => String(skip.itemId) === String(item.id)
);

if (itemDate <= todayCopy && !alreadyLogged && !alreadyDeleted && !alreadySkipped) {
  historyItems.push({
    itemId: item.id,
    date: new Date(itemDate),
    dateKey,
    name: item.name,
    amount: item.amount,
    repeat: item.repeat,
    type: item.type,
    customInterval: item.customInterval,
    customUnit: item.customUnit,
    skipped: false,
    balance: (parseFloat(balanceInput.value) || 0) + item.amount,
    historyKey,
    loggedAt: new Date().toISOString()
  });

    const currentBalance = parseFloat(balanceInput.value) || 0;
    balanceInput.value = (currentBalance + item.amount).toFixed(2);
    localStorage.setItem("cashForecastBalance", balanceInput.value);
  }
});

const todayFilter = new Date();
todayFilter.setHours(0, 0, 0, 0);

forecast = forecast.filter(item => {
  const itemDate = new Date(item.date);
  itemDate.setHours(0, 0, 0, 0);

  return itemDate > todayFilter;
});
  
  const rangeEndDate = new Date(todayFilter);
rangeEndDate.setDate(rangeEndDate.getDate() + rangeDays);

const lastForecastItem = forecast.length
  ? forecast[forecast.length - 1]
  : null;

const activeEndItem = forecast
  .filter(item => !item.skipped && !item.isRangeEnd)
  .at(-1);

const endBalance = activeEndItem
  ? activeEndItem.balance
  : balance;

forecast.push({
  ...(lastForecastItem || {}),
  name: "End of range",
  label: "End of range",
  amount: 0,
  date: rangeEndDate,
  dateKey: dateToKey(rangeEndDate),
  balance: endBalance,
  skipped: false,
  isRangeEnd: true
});

saveHistoryItems(); 
 displayCalendarHistory(); 
let overviewForecast = [];
let overviewRunningBalance = balance;

overviewForecast.push({
  name: "Today",
  label: "Today",
  amount: 0,
  date: new Date(),
  dateKey: dateToKey(new Date()),
  balance: overviewRunningBalance,
  skipped: false,
  isStartingPoint: true
});

overviewEvents.forEach(event => {
  if (!event.skipped) {
    overviewRunningBalance += event.amount;
  }

  overviewForecast.push({
    ...event,
    balance: overviewRunningBalance
  });
});  
  
  overviewForecast = overviewForecast.filter(item => {
  const itemDate = new Date(item.date);
  itemDate.setHours(0, 0, 0, 0);

  return itemDate >= todayFilter;
});
  
  displaySummary(forecast);
  updateDashboard(overviewForecast, balance, buffer);
  currentForecast = forecast;
  currentStartingBalance = balance;
  currentOverviewForecast = overviewForecast;
  drawChart(forecast, balance, "balanceChart");
  drawChart(overviewForecast, balance, "overviewChart");
  displayWarnings(forecast, buffer);
  displayForecast(forecast);
  renderCalendar(forecast);
  if (selectedCalendarDate) {
  const selectedEvents = forecast.filter(item => item.dateKey === selectedCalendarDate);
  showCalendarDayDetails(selectedCalendarDate, selectedEvents);
}
  
}

function updateDashboard(forecast, startingBalance, buffer) {
  const currentEl = document.getElementById("dashCurrent");
  const lowestEl = document.getElementById("dashLowest");
  const warningEl = document.getElementById("dashWarning");
  const monthlyEl = document.getElementById("dashMonthly");
  const upcomingEl = document.getElementById("upcomingBills");

  if (!currentEl) return;

  currentEl.innerText = formatMoney(startingBalance);
const todayBackValue = document.getElementById("todayBackValue");
if (todayBackValue) {
  todayBackValue.innerText = formatMoney(startingBalance);
}
  const activeForecast = forecast.filter(item => !item.skipped);

 let lowest = {
  name: "Today",
  date: new Date(),
  balance: startingBalance
};

activeForecast.forEach(item => {
  console.log(item.name, item.balance);

  if (item.balance < lowest.balance) {
    lowest = item;
  }
});

 lowestEl.innerText = lowest
  ? formatMoney(lowest.balance)
  : formatMoney(startingBalance);

const lowestBackValue = document.getElementById("lowestBackValue");
if (lowestBackValue) {
  lowestBackValue.innerText = lowest
    ? formatMoney(lowest.balance)
    : formatMoney(startingBalance);
}
  window.lowestForecastItem = lowest;
  console.log("Lowest card updated:", lowest);


  const playMoney = Math.max(0, lowest.balance - buffer);

monthlyEl.innerText = formatMoney(playMoney);

const playMoneyBackValue = document.getElementById("playMoneyBackValue");
if (playMoneyBackValue) {
  playMoneyBackValue.innerText = formatMoney(playMoney);
}

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const negative = activeForecast.find(item => item.balance < 0);

  const belowBuffer = activeForecast.find(
    item => buffer > 0 && item.balance < buffer && item.balance >= 0
  );

  const warning = negative || belowBuffer;

  if (warningEl) {
  if (warning) {
    const days = daysUntil(warning.date, today);
    warningEl.innerText = days + " day" + (days === 1 ? "" : "s");
  } else {
    warningEl.innerText = "All Clear";
  }
}

  lowestEl.className =
    "dash-value " + ((lowest && lowest.balance < 0) ? "bill" : "income");

  monthlyEl.className =
  "dash-value " + (playMoney > 0 ? "income" : "bill");

  if (warningEl) {
  warningEl.className =
    "dash-value " + (warning ? "bill" : "income");
}

  if (upcomingEl) {
  const upcomingBills = activeForecast
    .filter(item => {
      const itemDate = new Date(item.date);
      itemDate.setHours(0, 0, 0, 0);

      return !item.isStartingPoint && itemDate >= today;
    })
  .sort((a, b) => new Date(a.date) - new Date(b.date))
  .slice(0, 3);

    upcomingEl.innerHTML = upcomingBills.length
      ? upcomingBills.map(item => `
          <div class="upcoming-row">
            <div class="upcoming-left">
              <div class="upcoming-date">${formatShortDate(item.date)}</div>
              <div>${item.name}</div>
            </div>
            <span class="upcoming-money-out">${formatMoney(item.amount)}</span>
          </div>
        `).join("")
      : `<div class="muted">Nothing coming up</div>`;
  }
}

function jumpToLowestBalance() {
  if (!chartPoints || chartPoints.length === 0) return;

  const lowestPoint = chartPoints
    .filter(point => !point.isRangeEnd)
    .reduce((lowest, point) => {
      if (!lowest || point.balance < lowest.balance) {
        return point;
      }
      return lowest;
    }, null);

  if (!lowestPoint) return;

  selectedChartIndex = lowestPoint.index;
  pinnedChartSelection = true;

  clearTimeout(scrubberTimeout);

  drawChart(currentForecast, currentStartingBalance, "balanceChart");
}

function displaySummary(forecast) {
  const div = document.getElementById("summary");
  div.innerHTML = "";

let moneyIn = 0;
let moneyOut = 0;

forecast
  .filter(item => !item.skipped)
  .forEach(item => {
    if (item.amount >= 0) {
      moneyIn += item.amount;
    } else {
      moneyOut += Math.abs(item.amount);
    }
  });

const whatsLeft = moneyIn - moneyOut;

let lowest = {
  name: "Today",
  date: new Date(),
  balance: parseFloat(balanceInput.value) || 0
};

forecast
  .filter(item => !item.skipped && !item.isRangeEnd)
  .forEach(item => {
    if (item.balance < lowest.balance) {
      lowest = item;
    }
  });

  const lowestClass = lowest.balance < 0 ? "summary-bad" : "summary-good";

  div.innerHTML = `
    <div class="${lowestClass} clickable-summary-card" onclick="jumpToLowestBalance()">
  <strong>Rock Bottom:</strong><br>
  ${formatMoney(lowest.balance)} on ${formatDateObj(lowest.date)}<br>
  <span class="small">After: ${lowest.name}</span>
</div>

    <p><strong>Money In:</strong><br>
    <span class="income">${formatMoney(moneyIn)}</span></p>

    <p><strong>Money Out:</strong><br>
    <span class="bill">${formatMoney(moneyOut)}</span></p>

    <p><strong>${whatsLeft >= 0 ? "Growing" : "Shrinking"}:</strong><br>
<span class="${whatsLeft >= 0 ? "income" : "bill"}">
  ${formatMoney(whatsLeft)}
</span></p>
  `;
}

function setForecastRange(days) {
  rangeDays = days;
  window.rangeDays = days;
const chartCard = document.getElementById("chartCard");
if (chartCard) chartCard.classList.add("chart-updating");
  const rangeInputEl = document.getElementById("forecastRange");

  if (rangeInputEl) {
    rangeInputEl.value = days;
  }

  document.querySelectorAll(".range-chip").forEach(button => {
    button.classList.toggle(
      "active",
      Number(button.textContent.replace("d", "")) === days ||
      (button.textContent === "6m" && days === 180) ||
      (button.textContent === "1y" && days === 365)
    );
  });

 if (chartCard) {
  chartCard.classList.add("chart-updating");
}

setTimeout(() => {
  calculate();

  requestAnimationFrame(() => {
    if (chartCard) {
      chartCard.classList.remove("chart-updating");
    }
  });
}, 120);
}

function toggleChartStickiness() {
  const chartCard = document.getElementById("chartCard");
  const button = document.querySelector(".chart-toggle");

  chartCard.classList.toggle("sticky-chart");
  
  if (chartCard.classList.contains("sticky-chart")) {
    button.innerText = "Unstick";
  } else {
    button.innerText = "Stick";
  }
}
function syncGraphToScroll() {
  const forecastItems = document.querySelectorAll("#forecast .forecast-item");

  if (forecastItems.length === 0) return;

  const screenMiddle = window.innerHeight / 2;

  let closestItem = null;
  let closestDistance = Infinity;

  forecastItems.forEach(item => {
    const rect = item.getBoundingClientRect();
    const itemMiddle = rect.top + rect.height / 2;
    const distance = Math.abs(itemMiddle - screenMiddle);

    if (distance < closestDistance) {
      closestItem = item;
      closestDistance = distance;
    }
  });

  if (!closestItem) return;

  selectedChartIndex = parseInt(closestItem.dataset.chartIndex);

  drawChart(currentForecast, currentStartingBalance);
}

function drawChart(forecast, startingBalance, canvasId = "balanceChart") {
  const canvas = document.getElementById(canvasId);

  if (!canvas) return;

  const ctx = canvas.getContext("2d");
  
  const isOverviewChart = canvasId === "overviewChart";

  const rangeDays = isOverviewChart
  ? 90
  : window.rangeDays || 30;

let pixelsPerDay = 4;

if (rangeDays <= 30) {
  pixelsPerDay = 3;
} else if (rangeDays <= 60) {
  pixelsPerDay = 4;
} else if (rangeDays <= 90) {
  pixelsPerDay = 5;
} else {
  pixelsPerDay = 6;
}

const chartWidth = canvas.parentElement.offsetWidth;

  canvas.width = chartWidth;
  canvas.height = isOverviewChart ? 150 : 300;
  canvas.style.width = chartWidth + "px";

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const safeBuffer = parseFloat(bufferInput.value) || 0;

  const grouped = {};

forecast
  .filter(item => !item.skipped)
  .forEach(item => {
    const key = item.dateKey;

    if (!grouped[key]) {
      grouped[key] = {
        balance: item.balance,
        label: item.name,
        amount: item.amount,
        date: item.date,
        dateKey: item.dateKey,
        items: []
      };
    }

    grouped[key].items.push(item);

    // Use the final balance after all events on that date
    grouped[key].balance = item.balance;
  });

const points = [
  {
    balance: startingBalance,
    label: "Starting balance",
    amount: 0,
    date: new Date(),
    dateKey: dateToKey(new Date()),
    items: []
  },
  ...Object.values(grouped)
];
points.sort((a, b) => new Date(a.date) - new Date(b.date));
chartPoints = [];

if (points.length < 2) {
  ctx.fillStyle = "#222";
  ctx.fillText("Add forecast items to see your balance graph.", 15, 30);
  return;
}

  const balances = points.map(p => p.balance);

  const min = Math.min(...balances);
const max = Math.max(...balances, 0);

const paddingLeft = isOverviewChart ? 46 : 18;
const paddingRight = isOverviewChart ? 8 : 24;
const paddingTop = isOverviewChart ? 28 : 52;
const paddingBottom = isOverviewChart ? 18 : 62;

const width = canvas.width - paddingLeft - paddingRight;
const height = canvas.height - paddingTop - paddingBottom;
  
function x(i) {
  const pointDate = new Date(points[i].date);
  pointDate.setHours(0, 0, 0, 0);

  const firstDate = new Date(points[0].date);
  firstDate.setHours(0, 0, 0, 0);

  const totalDays = isOverviewChart ? 90 : window.rangeDays || 30;
  const msPerDay = 1000 * 60 * 60 * 24;

  const daysFromStart = Math.round((pointDate - firstDate) / msPerDay);
  const ratio = Math.max(0, Math.min(1, daysFromStart / totalDays));

  return paddingLeft + ratio * width;
}

function y(balance) {
  if (max === min) return paddingTop + height / 2;

  return paddingTop + ((max - balance) / (max - min)) * height;
}

  // zero line
  ctx.strokeStyle = "#2A9D8F";
  ctx.lineWidth = 1;
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.moveTo(paddingLeft, y(0));
ctx.lineTo(canvas.width - paddingRight, y(0));
  ctx.stroke();

  // safe buffer line
if (safeBuffer > 0) {
  const bufferY = y(safeBuffer);

ctx.strokeStyle = "rgba(244, 162, 97, 0.7)";
ctx.lineWidth = 1.5;
ctx.setLineDash([6, 6]);

ctx.beginPath();
ctx.moveTo(0, bufferY);
ctx.lineTo(canvas.width - paddingRight, bufferY);
ctx.stroke();

ctx.setLineDash([]);
}
  
// filled area under balance line
const baselineY = canvas.height - paddingBottom;

ctx.beginPath();

points.forEach((point, i) => {
  const px = x(i);
  const py = y(point.balance);

  if (i === 0) ctx.moveTo(px, py);
  else ctx.lineTo(px, py);
});

ctx.lineTo(x(points.length - 1), baselineY);
ctx.lineTo(x(0), baselineY);
ctx.closePath();

const gradient = ctx.createLinearGradient(
  0,
  paddingTop,
  0,
  canvas.height - paddingBottom
);

gradient.addColorStop(0, "rgba(42, 157, 143, 0.38)");
gradient.addColorStop(0.45, "rgba(42, 157, 143, 0.18)");
gradient.addColorStop(1, "rgba(42, 157, 143, 0.03)");

ctx.fillStyle = gradient;
ctx.fill();


// balance line
ctx.strokeStyle = "#2A9D8F";
ctx.lineWidth = 3;
ctx.setLineDash([]);
ctx.beginPath();

points.forEach((point, i) => {
  const px = x(i);
  const py = y(point.balance);

  if (i === 0) ctx.moveTo(px, py);
  else ctx.lineTo(px, py);
});

ctx.stroke();

// dots + saved tap points
const balancesOnly = points.map(p => p.balance);
const lowestBalance = Math.min(...balancesOnly);
const lastPointIndex = points.length - 1;

points.forEach((point, i) => {
  const px = x(i);
  const py = y(point.balance);

  const isSelected = selectedChartIndex === i && canvasId === "balanceChart";
  const isLowest = point.balance === lowestBalance;
  const isStart = i === 0;
  const isEnd = i === lastPointIndex;

 

  const shouldDrawDot =
  isSelected;

if (shouldDrawDot) {
  let dotRadius = isOverviewChart ? 2.5 : 4;

  if (isSelected) {
    dotRadius = 7;
  } else if (isLowest || isEnd) {
    dotRadius = 5;
  }

  ctx.beginPath();

  if (point.balance < 0) {
    ctx.fillStyle = "#E76F51";
  } else if (safeBuffer > 0 && point.balance < safeBuffer) {
    ctx.fillStyle = "#F4A261";
  } else {
    ctx.fillStyle = "#2A9D8F";
  }

  ctx.arc(px, py, dotRadius, 0, Math.PI * 2);
  ctx.fill();

  if (isSelected) {
  ctx.shadowColor = "rgba(42, 157, 143, 0.45)";
  ctx.shadowBlur = 16;

  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 3;
  ctx.stroke();

  ctx.shadowBlur = 0;
}
}

  if (isSelected) {
    ctx.strokeStyle = "rgba(34, 34, 34, 0.45)";
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 4]);

    ctx.beginPath();
    ctx.moveTo(px, paddingTop);
    ctx.lineTo(px, canvas.height - 35);
    ctx.stroke();

    ctx.setLineDash([]);
  }

  chartPoints.push({
    index: i,
    x: px,
    y: py,
    label: point.label || point.name || "Event",
    amount: point.amount || 0,
    balance: point.balance,
    date: point.date,
    dateKey: point.dateKey || dateToKey(new Date(point.date))
  });
});

  
if (!isOverviewChart) {
  const firstDate = new Date(points[0].date);
  firstDate.setHours(0, 0, 0, 0);

  const totalDays = window.rangeDays || 30;
  const labelCount = 7;

  for (let n = 0; n < labelCount; n++) {
    const ratio = n / (labelCount - 1);

    const labelX = paddingLeft + ratio * width;

    const labelDate = new Date(firstDate);
    labelDate.setDate(firstDate.getDate() + Math.round(totalDays * ratio));

    const shortDate = labelDate.toLocaleDateString("en-CA", {
      month: "short",
      day: "numeric"
    });

    ctx.fillStyle = "#666";
    ctx.font = "10px Arial";
    ctx.fillText(shortDate, labelX - 14, canvas.height - 18);
  }
}  
// Y-axis labels
ctx.fillStyle = "#666";
ctx.font = "11px Arial";

// Y-axis dollar labels and guide lines
ctx.font = "10px Arial";
ctx.lineWidth = 1;

const yAxisSteps = 4;
  
const yAxisEl =
  canvasId === "balanceChart"
    ? document.getElementById("chartYAxis")
    : canvasId === "overviewChart"
      ? document.getElementById("overviewChartYAxis")
      : null;

if (yAxisEl && canvasId === "balanceChart") {
  yAxisEl.style.height = canvas.height + "px";
}

if (yAxisEl) {
  yAxisEl.innerHTML = "";
}  

for (let step = 0; step <= yAxisSteps; step++) {
  const rawValue = min + ((max - min) / yAxisSteps) * step;

const roundingBase =
  max > 10000 ? 2000 :
  max > 5000 ? 1000 :
  max > 2000 ? 500 :
  100;

const value =
  Math.round(rawValue / roundingBase) * roundingBase;

const roundedValue =
  Math.abs(value) < (max - min) / 10
    ? 0
    : value;

const py = y(roundedValue);
  
  if (yAxisEl) {
  const label = document.createElement("div");

  label.className = "chart-y-label";
  label.style.top = (py - 5) + "px";

  label.innerText = Math.round(roundedValue).toLocaleString("en-CA", {
    style: "currency",
    currency: "CAD",
    maximumFractionDigits: 0
  });

  yAxisEl.appendChild(label);
}
if (step === 0 && yAxisEl) {
  const lowLabel = document.createElement("div");

  lowLabel.className = "chart-extreme-label low";
  lowLabel.style.top = (py - 5) + "px";

  lowLabel.innerText =
  "Low: " +
  Math.round(min).toLocaleString("en-CA", {
    style: "currency",
    currency: "CAD",
    maximumFractionDigits: 0
  });

  yAxisEl.appendChild(lowLabel);
}

if (step === yAxisSteps && yAxisEl) {
  const highLabel = document.createElement("div");

  highLabel.className = "chart-extreme-label high";
  highLabel.style.top = (py - 5) + "px";

  highLabel.innerText =
  "High: " +
  Math.round(max).toLocaleString("en-CA", {
    style: "currency",
    currency: "CAD",
    maximumFractionDigits: 0
  });

  yAxisEl.appendChild(highLabel);
}
  ctx.strokeStyle = "#eeeeee";
  ctx.setLineDash([]);

  ctx.beginPath();
  ctx.moveTo(paddingLeft, py);
ctx.lineTo(canvas.width - paddingRight, py);
  ctx.stroke();
/*
ctx.fillStyle = "#666";
ctx.fillText(
  Math.round(roundedValue).toLocaleString("en-CA", {
    style: "currency",
    currency: "CAD",
    maximumFractionDigits: 0
  }),
  4,
  py + 3
);
*/
}

  ctx.fillStyle = "#222";
  ctx.font = "12px Arial";
/*
  ctx.fillText(
  "High: " +
    Math.round(max).toLocaleString("en-CA", {
      style: "currency",
      currency: "CAD",
      maximumFractionDigits: 0
    }),
  paddingLeft,
  22
);
*/
/*
ctx.fillText(
  "Low: " +
    Math.round(min).toLocaleString("en-CA", {
      style: "currency",
      currency: "CAD",
      maximumFractionDigits: 0
    }),
  paddingLeft,
  canvas.height - 6
);
*/
}

function handleChartTap(event) {
  pinnedChartSelection = false;

  const canvas = document.getElementById("balanceChart");
  const tooltip = document.getElementById("chartTooltip");

  if (!canvas || !tooltip || chartPoints.length === 0) return;

  const rect = canvas.getBoundingClientRect();

  const scaleX = canvas.width / rect.width;
  const tapX = (event.clientX - rect.left) * scaleX;

  let closest = null;
  let closestDistance = Infinity;

  chartPoints.forEach(point => {
    const distance = Math.abs(point.x - tapX);

    if (distance < closestDistance) {
      closest = point;
      closestDistance = distance;
    }
  });

  if (!closest) return;

  selectedChartIndex = closest.index;

  clearTimeout(scrubberTimeout);

  scrubberTimeout = setTimeout(() => {
    if (!pinnedChartSelection) {
      selectedChartIndex = null;
      drawChart(currentForecast, currentStartingBalance, "balanceChart");
    }
  }, 1800);

  const sameDayItems = currentForecast.filter(item =>
    item.dateKey === closest.dateKey && !item.isRangeEnd
  );

  tooltip.innerHTML = `
    <div class="scrub-card">
      <div class="scrub-card-top">
        <div>
          <div class="scrub-label">Selected date</div>
          <div class="scrub-date">${formatDateObj(new Date(closest.date))}</div>
        </div>

        <div class="scrub-balance">
          <div class="scrub-label">Balance</div>
          <strong>${formatMoney(closest.balance)}</strong>
        </div>
      </div>

      <div class="scrub-items">
        ${sameDayItems.length
          ? sameDayItems.map(item => `
            <div class="scrub-row">
              <span>${item.name}</span>
              <strong class="${item.amount >= 0 ? "income" : "bill"}">
                ${formatMoney(item.amount)}
              </strong>
            </div>
          `).join("")
          : `<div class="scrub-empty">No scheduled items this day</div>`
        }
      </div>
    </div>
  `;

  drawChart(currentForecast, currentStartingBalance, "balanceChart");
}

function estimateMonthlyAmount(item) {
  if (item.repeat === "once") return 0;
  if (item.repeat === "weekly") return item.amount * 4.333;
  if (item.repeat === "biweekly") return item.amount * 2.166;
  if (item.repeat === "monthly") return item.amount;
  if (item.repeat === "yearly") return item.amount / 12;
  return 0;
}

function displayDeletedItems() {
  const div = document.getElementById("deletedItemsList");
  if (!div) return;

  if (deletedItems.length === 0) {
    div.innerHTML = `<div class="muted">No deleted items yet</div>`;
    return;
  }

div.innerHTML = deletedItems.map(item => `
  <div class="deleted-row">
    <input
      type="checkbox"
      class="bulk-checkbox"
      ${selectedDeletedItems.has(item.id) ? "checked" : ""}
      onchange="toggleDeletedSelection(${item.id})"
    >

    <div class="deleted-content">
      <div class="deleted-main">
        <div>
          <div class="deleted-name">${item.name}</div>
          <div class="upcoming-date">
          Deleted ${formatShortDate(new Date(item.deletedAt))}
${item.deletedFrom === "skipped" ? " • Skipped Occurrence" : ""}
          </div>
        </div>

        <span class="${item.amount >= 0 ? "money-in" : "money-out"}">
          ${formatMoney(item.amount)}
        </span>
      </div>

      <div class="deleted-actions">
        <button class="restore compact-action" onclick="restoreDeletedItem(${item.id})">
          Restore
        </button>

        <button class="delete compact-action" onclick="permanentlyDeleteItem(${item.id})">
          Delete Forever
        </button>
      </div>
    </div>
  </div>
`).join("");
  updateDeletedBulkActions();
}
function updateDeletedBulkActions() {
  const count = selectedDeletedItems.size;

  const restoreBtn = document.getElementById("restoreSelectedBtn");
  const deleteBtn = document.getElementById("deleteSelectedBtn");

  if (restoreBtn) {
    restoreBtn.textContent = `Restore (${count})`;
    restoreBtn.disabled = count === 0;
  }

  if (deleteBtn) {
    deleteBtn.textContent = `Delete Forever (${count})`;
     deleteBtn.disabled = count === 0;
  }
}
function toggleDeletedSelection(id) {
  if (selectedDeletedItems.has(id)) {
    selectedDeletedItems.delete(id);
  } else {
    selectedDeletedItems.add(id);
  }
updateDeletedBulkActions();
}

function toggleEndRepeatFields() {
  const endType = document.getElementById("endType").value;
  const endDate = document.getElementById("endDate");
  const endCount = document.getElementById("endCount");

  endDate.style.display = endType === "date" ? "block" : "none";
  endCount.style.display = endType === "count" ? "block" : "none";
}

function toggleSelectAllDeleted() {
  const checkbox = document.getElementById("selectAllDeleted");

  selectedDeletedItems.clear();

  if (checkbox.checked) {
    deletedItems.forEach(item => {
      selectedDeletedItems.add(item.id);
    });
  }

  displayDeletedItems();
  updateDeletedBulkActions();
}

function restoreSelectedDeletedItems() {
  if (selectedDeletedItems.size === 0) return;

  const idsToRestore = [...selectedDeletedItems];

  idsToRestore.forEach(id => {
    restoreDeletedItem(id);
  });

  selectedDeletedItems.clear();
  updateDeletedBulkActions();

  const selectAll = document.getElementById("selectAllDeleted");
  if (selectAll) selectAll.checked = false;
}

function permanentlyDeleteItem(id) {
  console.log("permanent delete modal");

  showConfirmModal(
    "Permanently delete this item?",
    () => {
      deletedItems = deletedItems.filter(item => item.id !== id);

      saveDeletedItems();
      calculate();
    }
  );
}
function deleteSelectedForever() {
  const count = selectedDeletedItems.size;

  if (!count) return;

  showConfirmModal(
    `Delete ${count} item${count === 1 ? "" : "s"} forever? This cannot be undone.`,
    () => {
      deletedItems = deletedItems.filter(
        item => !selectedDeletedItems.has(item.id)
      );

      selectedDeletedItems.clear();

      saveDeletedItems();
      displayDeletedItems();
      updateDeletedBulkActions();

      const selectAll = document.getElementById("selectAllDeleted");
      if (selectAll) selectAll.checked = false;
    }
  );
}

let confirmCallback = null;

function showConfirmModal(message, callback) {
  console.log("modal called");

  const modal = document.getElementById("confirmModal");

  document.body.appendChild(modal);

  document.getElementById("confirmMessage").textContent = message;

  confirmCallback = callback;

  modal.classList.add("show");
}

function closeConfirmModal() {
  const modal = document.getElementById("confirmModal");

  modal.classList.remove("show");
  confirmCallback = null;
}
function openRecurringEditModal() {
  const modal = document.getElementById("recurringEditModal");
  document.body.appendChild(modal);
  modal.classList.add("show");

  console.log("recurring modal opened", modal);
}

function closeRecurringEditModal() {
  const modal = document.getElementById("recurringEditModal");
  modal.classList.remove("show");

  pendingRecurringEdit = null;
  recurringEditMode = null;
}

function confirmRecurringEditChoice() {
  const choice = document.querySelector(
    'input[name="recurringEditChoice"]:checked'
  ).value;

  recurringEditMode = choice;

  document.getElementById("recurringEditModal").classList.remove("show");

  if (!pendingRecurringEdit) return;

  returnAfterEditTab = "forecastTab";
returnAfterEditScrollTarget = null;

  showTab("settingsTab");
  editItem(pendingRecurringEdit.itemId);

  if (recurringEditMode === "single" || recurringEditMode === "future") {
    editingId = null;

    document.getElementById("date").value = pendingRecurringEdit.dateKey;

    if (recurringEditMode === "single") {
      document.getElementById("repeat").value = "once";
    }

    toggleCustomRepeatFields();
    toggleEndRepeatFields();
  }
}
document.getElementById("confirmOkButton").addEventListener("click", () => {
  const callback = confirmCallback;

  closeConfirmModal();

  if (callback) {
    callback();
  }
});

function toggleDeletedItems() {
  const panel = document.getElementById("deletedItemsPanel");
  const toggle = document.getElementById("deletedItemsToggle");

  if (!panel || !toggle) return;

  const isOpen = panel.style.display !== "none";

  panel.style.display = isOpen ? "none" : "block";

  toggle.classList.toggle("closed", isOpen);
}

function displayCalendarHistory() {
  const div = document.getElementById("calendarHistory");
  if (!div) return;

  const today = new Date();
  today.setHours(0,0,0,0);

  const visibleHistory = historyItems
    .filter(item => {
      const itemDate = new Date(item.date);
      itemDate.setHours(0,0,0,0);

      return itemDate <= today || item.processedEarly;
    })
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  if (visibleHistory.length === 0) {
    div.innerHTML = `
      <div class="muted">
        No historical entries yet
      </div>
    `;
    return;
  }

  div.innerHTML = visibleHistory.map(item => `
    <div class="forecast-item">
      <strong>${item.name}</strong>

      <div class="forecast-sub-row">
        ${formatDateObj(new Date(item.date))}
      </div>

     <div class="forecast-sub-row">
  ${formatDateObj(new Date(item.date))}
  ${item.processedEarly ? ` • Processed early from ${item.originalDateKey}` : ""}
</div>

      <div class="compact-buttons">
  <span class="${item.amount >= 0 ? "money-in" : "money-out"}">
    ${formatMoney(item.amount)}
  </span>

  <button onclick="undoHistoryItem('${item.historyKey}')">
    Undo
  </button>

  <button onclick="deleteHistoryItem('${item.historyKey}')">
    Delete
  </button>
</div>
    </div>
  `).join("");
}

function undoHistoryItem(historyKey) {
  const historyItem = historyItems.find(item => item.historyKey === historyKey);
  if (!historyItem) return;
  if (historyItem.processedEarly) {
  const currentBalance = parseFloat(balanceInput.value) || 0;

  // Reverse the Process Early balance change
  balanceInput.value = (currentBalance - historyItem.amount).toFixed(2);
  localStorage.setItem("cashForecastBalance", balanceInput.value);

  // Remove the processed-early blocker so the original future item returns
  processedEarlyItems = processedEarlyItems.filter(
    item => item.key !== historyItem.historyKey
  );

  // Remove the history record
  historyItems = historyItems.filter(item => item.historyKey !== historyKey);

  saveProcessedEarlyItems();
  saveHistoryItems();
  saveItems();
  calculate();

  return;
}

  const originalItemId = historyItem.itemId;

  let existingItem = items.find(
    item => String(item.id) === String(originalItemId)
  );

  const createdTemporaryItem = !existingItem;

  if (!existingItem) {
    existingItem = {
      id: originalItemId || Date.now(),
      name: historyItem.name,
      amount: historyItem.amount,
      type: historyItem.type || (historyItem.amount >= 0 ? "income" : "bill"),
      date: historyItem.dateKey || dateToKey(new Date(historyItem.date)),
      repeat: historyItem.repeat || "once",
      customInterval: historyItem.customInterval || 1,
      customUnit: historyItem.customUnit || "days",
      fromHistoryUndo: true
    };

    items.push(existingItem);
  } else {
    existingItem.type =
      existingItem.type || historyItem.type || (historyItem.amount >= 0 ? "income" : "bill");

    existingItem.repeat =
      existingItem.repeat || historyItem.repeat || "once";
  }

  historyItems = historyItems.filter(item => item.historyKey !== historyKey);

  pendingHistoryUndo = {
    originalHistoryItem: historyItem,
    restoredItemId: existingItem.id,
    removeRestoredItemOnCancel: createdTemporaryItem
  };

  saveItems();
  saveHistoryItems();

  editingId = existingItem.id;
  editItem(existingItem.id);
  showTab("settingsTab");
}

function deleteHistoryItem(historyKey) {
  const item = historyItems.find(item => item.historyKey === historyKey);
  if (!item) return;

  deletedItems.push({
    ...item,
    deletedAt: new Date().toISOString(),
    deletedFrom: "history"
  });

  historyItems = historyItems.filter(item => item.historyKey !== historyKey);

  saveItems();
  calculate();
}



function displayItems() {
  const div = document.getElementById("itemsList");
  div.innerHTML = "";

  if (items.length === 0) {
    div.innerHTML = "<p class='small'>No items added yet.</p>";
    return;
  }

  const sortedItems = [...items].sort((a, b) => new Date(a.date) - new Date(b.date));

  sortedItems.forEach(item => {
    const el = document.createElement("div");
    el.className = "forecast-item";
    

    el.innerHTML = `
  <div class="forecast-top-row">
    <strong>${item.name}</strong>

    <span class="${item.amount >= 0 ? "income" : "bill"}">
      ${formatMoney(item.amount)}
    </span>
  </div>

 <div class="forecast-sub-row">
  ${formatDate(item.date)} • ${getRepeatDisplay(item)}
</div>

<div class="forecast-sub-row small">
  ${
    item.endType === "date"
      ? `Ends: ${formatDate(item.endDate)}`
      : item.endType === "count"
      ? `Ends after ${item.endCount} occurrences`
      : (
          item.repeat !== "once" &&
          items.some(
            other =>
              other.name === item.name &&
              other.repeat === item.repeat &&
              other.date !== item.date
          )
        )
      ? `From: ${formatDate(item.date)}`
      : ""
  }
</div>

  <div class="button-row compact-buttons">
  <button class="edit" onclick="editItemFromNonNegotiables(${item.id})">Edit</button>
    <button class="delete" onclick="deleteItem(${item.id})">Delete</button>
  </div>
`;

    div.appendChild(el);
  });
}

function displaySkippedItems() {
  const div = document.getElementById("skippedList");
  div.innerHTML = "";

  const visibleSkippedEvents = skippedEvents.filter(
    skip => !skip.editedOccurrence
  );

  if (visibleSkippedEvents.length === 0) {
    div.innerHTML = "<p class='small'>No skipped items</p>";
    return;
  }

  const sortedSkips = [...visibleSkippedEvents].sort(
    (a, b) => new Date(a.dateKey) - new Date(b.dateKey)
  );

  console.log("Skipped list:", sortedSkips);

  sortedSkips.forEach(skip => {
    const el = document.createElement("div");
    el.className = "forecast-item";

    el.innerHTML = `
      <strong>${skip.name}</strong>

      <div class="forecast-sub-row">
        Skipped: ${formatDate(skip.dateKey)} • ${formatMoney(skip.amount)}
      </div>

      <div class="compact-buttons">
        <button
          class="restore compact-action"
          onclick="restoreEvent('${skip.key}')">
          Restore
        </button>

        <button
          class="delete compact-action"
          onclick="removeSkippedEvent('${skip.key}')">
          Remove
        </button>
      </div>
    `;

    div.appendChild(el);
  });
}

function displayWarnings(forecast, buffer) {
  const div = document.getElementById("warnings");
  div.innerHTML = "";

  const activeForecast = forecast.filter(item => !item.skipped);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const negative = activeForecast.find(item => item.balance < 0);

  const belowBuffer = activeForecast.find(
    item => item.balance < buffer && item.balance >= 0
  );

  if (!negative && !belowBuffer) {
    div.innerHTML = "<p class='small'>No warnings. Looking good.</p>";
    return;
  }

  if (negative) {
    const days = daysUntil(negative.date, today);

    div.innerHTML += `
      <div class="warning">
        You go negative in <strong>${days}</strong> day${days === 1 ? "" : "s"}
        on <strong>${formatDateObj(negative.date)}</strong>
        after <strong>${negative.name}</strong>.
      </div>
    `;
  }

  if (belowBuffer) {
    const days = daysUntil(belowBuffer.date, today);

    div.innerHTML += `
      <div class="warning">
        You drop below your safe buffer in <strong>${days}</strong> day${days === 1 ? "" : "s"}
        on <strong>${formatDateObj(belowBuffer.date)}</strong>
        after <strong>${belowBuffer.name}</strong>.
      </div>
    `;
  }
}

function daysUntil(targetDate, todayDate) {
  const oneDay = 1000 * 60 * 60 * 24;

  const target = new Date(targetDate);
  target.setHours(0, 0, 0, 0);

  const today = new Date(todayDate);
  today.setHours(0, 0, 0, 0);

  return Math.round((target - today) / oneDay);
}

function displayForecast(forecast) {
  const div = document.getElementById("forecast");
  div.innerHTML = "";

  forecast = forecast.filter(item => !item.isRangeEnd && !item.skipped);

if (forecast.length === 0) {
  div.innerHTML = "<p class='small'>No future cash items in this range</p>";
  return;
}

  let currentMonth = "";
  let monthContent = null;

  forecast.forEach(item => {
    const monthLabel = item.date.toLocaleDateString("en-CA", {
      month: "long",
      year: "numeric"
    });

    const monthId = "month-" + monthLabel.replace(/\s/g, "-");

    if (monthLabel !== currentMonth) {
      currentMonth = monthLabel;

      const monthHeader = document.createElement("div");
      monthHeader.className = "section-header month-header";
      monthHeader.onclick = function () {
        toggleSection(monthId, monthId + "-toggle");
      };

      monthHeader.innerHTML = `
        <span>${currentMonth}</span>
        <span id="${monthId}-toggle" class="section-toggle">▾</span>
      `;

      div.appendChild(monthHeader);

      monthContent = document.createElement("div");
      monthContent.id = monthId;

      div.appendChild(monthContent);
    }

    const el = document.createElement("div");
    el.className = "forecast-item";

    if (item.balance < 0) el.classList.add("negative");
    if (item.skipped) el.classList.add("skipped");

    el.innerHTML = `
  <div class="forecast-top-row">
  <strong>${item.name}</strong>

  <span class="${item.balance >= 0 ? "income" : "bill"}">
    ${formatMoney(item.balance)}
  </span>
</div>

<div class="forecast-sub-row">
  ${formatDateObj(new Date(item.date))} • ${formatMoney(item.amount)}
</div>

<div class="compact-buttons">
 <button class="edit" onclick="editItemFromForecast(${item.itemId}, '${item.dateKey}')">Edit</button>

  <button class="compact-action" onclick="processEarly(${item.itemId}, '${item.dateKey}', '${escapeText(item.name)}', ${item.amount})">
    Process Early
  </button>

  ${
    item.skipped
      ? `<button class="restore compact-action" onclick="restoreEvent('${item.itemId}|${item.dateKey}')">Restore</button>`
      : `<button class="skip compact-action" onclick="skipEvent(${item.itemId}, '${item.dateKey}', '${escapeText(item.name)}', ${item.amount})">Skip</button>`
  }
</div>
`;

    monthContent.appendChild(el);
  });
}

function toggleSection(contentId, toggleId) {
  const content = document.getElementById(contentId);
  const toggle = document.getElementById(toggleId);

  content.classList.toggle("collapsed");

toggle.innerText =
  content.classList.contains("collapsed")
    ? "▸"
    : "▾";
}

function escapeText(text) {
  return String(text).replace(/'/g, "\\'");
}
function exportBackup() {
  const backup = {
    version: "1.0",
    exportedAt: new Date().toISOString(),
    appName: "It Smy Money",
    settings: {
      balance: localStorage.getItem("cashForecastBalance") || "",
      buffer: localStorage.getItem("cashForecastBuffer") || "",
      range: localStorage.getItem("cashForecastRange") || "30"
    },
    items: items,
    skippedEvents: skippedEvents
  };

  
  
  
  
  
  const data = JSON.stringify(backup, null, 2);
  const blob = new Blob([data], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = "it-smy-money-backup.json";

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
}
function formatMoney(amount) {
  const sign = amount < 0 ? "-" : "";
  const absolute = Math.abs(amount);

  return sign + "$" + absolute.toLocaleString("en-CA", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function formatShortDate(dateString) {
  const date = new Date(dateString);

  return date.toLocaleDateString("en-CA", {
  month: "short",
  day: "numeric"
});
}

function formatDate(dateString) {
  const date = new Date(dateString + "T00:00:00");
  return formatDateObj(date);
}

function formatDateObj(date) {
  return date.toLocaleDateString("en-CA", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric"
  });
}
function getRepeatDisplay(item) {
  if (item.repeat === "custom") {
    const interval = item.customInterval || 1;
    const unit = item.customUnit || "days";

    return "Every " + interval + " " + unit;
  }

  return repeatLabel(item.repeat);
}
function isWeekend(date) {
  const day = date.getDay();
  return day === 0 || day === 6;
}

function getFirstBusinessDay(year, month) {
  const date = new Date(year, month, 1);

  while (isWeekend(date)) {
    date.setDate(date.getDate() + 1);
  }

  return date;
}

function getLastBusinessDay(year, month) {
  const date = new Date(year, month + 1, 0);

  while (isWeekend(date)) {
    date.setDate(date.getDate() - 1);
  }

  return date;
}
function repeatLabel(repeat) {
  if (repeat === "once") return "One time";
  if (repeat === "weekly") return "Weekly";
  if (repeat === "biweekly") return "Every 2 weeks";
  if (repeat === "monthly") return "Monthly";
  if (repeat === "yearly") return "Yearly";
  if (repeat === "firstBusinessDay") {
  return "First business day of month";
}

if (repeat === "lastBusinessDay") {
  return "Last business day of month";
}
  return repeat;
}
window.importBackup = function(event) {
  const file = event.target.files[0];

  if (!file) return;

  showConfirmModal(
    "Import this backup? This will replace your current saved data.",
    () => {

      const reader = new FileReader();

  reader.onload = function(e) {
    try {
      const backup = JSON.parse(e.target.result);

      localStorage.setItem("cashForecastBalance", backup.settings?.balance || "");
      localStorage.setItem("cashForecastBuffer", backup.settings?.buffer || "");
      localStorage.setItem("cashForecastRange", backup.settings?.range || "30");

      localStorage.setItem("cashForecastItems", JSON.stringify(backup.items || []));
      localStorage.setItem("cashForecastSkippedEvents", JSON.stringify(backup.skippedEvents || []));

      location.reload();
    } catch (error) {
      alert("That backup file could not be imported.");
    }
  };

  
  
      reader.readAsText(file);
    }
  );
}

function renderCalendar(forecast = []) {

  const grid = document.getElementById("calendarGrid");
  const monthLabel = document.getElementById("calendarMonth");

  if (!grid || !monthLabel) return;

  grid.innerHTML = "";

  const year = currentCalendarDate.getFullYear();
  const month = currentCalendarDate.getMonth();

  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);

  const startDay = firstDay.getDay();
  const totalDays = lastDay.getDate();

  monthLabel.innerText = firstDay.toLocaleDateString([], {
    month: "long",
    year: "numeric"
  });

  const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  weekdays.forEach(day => {
    const header = document.createElement("div");

    header.className = "calendar-day";
    header.style.fontWeight = "700";
    header.style.minHeight = "auto";

    header.innerText = day;

    grid.appendChild(header);
  });

  for (let i = 0; i < startDay; i++) {
    const empty = document.createElement("div");

    empty.className = "calendar-day calendar-empty";

    grid.appendChild(empty);
  }

  for (let day = 1; day <= totalDays; day++) {

    const cell = document.createElement("div");

    const today = new Date();

cell.className = "calendar-day";

if (
  day === today.getDate() &&
  month === today.getMonth() &&
  year === today.getFullYear()
) {
  cell.classList.add("calendar-today");
}

    const dateStr =
      `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

    const dayForecast = forecast.filter(item =>
  item.dateKey === dateStr && !item.isRangeEnd
);
    console.log("history:", history);
    
    
    
   const dayHistory = historyItems.filter(item => item.dateKey === dateStr);
    
    console.log("History for", dateStr, dayHistory);

    cell.innerHTML = `
      <div class="calendar-day-number">${day}</div>
    `;

const lastEventForDay = forecast
  .filter(item => !item.skipped && item.dateKey <= dateStr)
  .slice(-1)[0];

if (lastEventForDay || currentStartingBalance !== null) {
  const dayBalance = lastEventForDay
    ? lastEventForDay.balance
    : currentStartingBalance;

  const balanceEl = document.createElement("div");

  balanceEl.className =
    "calendar-balance " + (dayBalance < 0 ? "bill" : "income");

  balanceEl.innerText =
  "$" + Math.round(dayBalance).toLocaleString("en-CA");

  cell.appendChild(balanceEl);
}
    
   const allEvents = [
  ...dayHistory,
  ...dayForecast
];

if (allEvents.length === 1) {
  const item = allEvents[0];

  const event = document.createElement("div");

  event.className =
    "calendar-event " +
    (item.amount > 0 ? "calendar-income" : "") +
    (dayHistory.includes(item) ? " calendar-history" : "");

  event.innerText = item.name;

  cell.appendChild(event);
}

if (allEvents.length > 1) {
  const more = document.createElement("div");

  more.className = "calendar-more";

  more.innerText = `+${allEvents.length} items`;

  cell.appendChild(more);
}
    
cell.addEventListener("click", () => {
  showCalendarDayDetails(dateStr, dayForecast, dayHistory);
  selectedCalendarDate = dateStr;
});
    grid.appendChild(cell);
  }
}
document.getElementById("prevMonth").addEventListener("click", () => {
  currentCalendarDate.setMonth(currentCalendarDate.getMonth() - 1);

  renderCalendar(currentForecast);
});

document.getElementById("nextMonth").addEventListener("click", () => {
  currentCalendarDate.setMonth(currentCalendarDate.getMonth() + 1);

  renderCalendar(currentForecast);
});

function editItemFromCalendar(id) {
  returnToCalendarAfterEdit = true;
  showTab("settingsTab");
  editItem(id);
  
}
function editItemFromNonNegotiables(id) {
  pendingRecurringEdit = null;
  recurringEditMode = null;

  returnAfterEditTab = "forecastTab";
  returnAfterEditScrollTarget = "itemsList";

  showTab("settingsTab");
  editItem(id);
}
function editItemFromForecast(id, dateKey = null) {
  const item = items.find(item => item.id === id);

  if (!item) return;

  // one-time Future Cash items behave normally
  if (item.repeat === "once") {
    returnAfterEditTab = "forecastTab";
    returnAfterEditScrollTarget = null;

    showTab("settingsTab");
    editItem(id);
    return;
  }

  // recurring Future Cash items get the choice modal
  pendingRecurringEdit = {
    itemId: id,
    dateKey
  };

  openRecurringEditModal();
}

function refreshSelectedCalendarDay() {
  if (!selectedCalendarDate) return;

  const selectedEvents = currentForecast

  const selectedHistoryEvents = historyItems.filter(
    item => item.dateKey === selectedCalendarDate
  );

  showCalendarDayDetails(
    selectedCalendarDate,
    selectedEvents,
    selectedHistoryEvents
  );
}

function showCalendarDayDetails(dateStr, events, historyEvents = []) {
  const details = document.getElementById("calendarDayDetails");
  if (!details) return;

  const date = new Date(dateStr + "T00:00:00");

  if (events.length === 0 && historyEvents.length === 0) {
    details.innerHTML = `
      <strong>${formatDateObj(date)}</strong><br>
      <span class="muted">No entries this day.</span>
    `;
    return;
  }

  details.innerHTML = `
    <strong>${formatDateObj(date)}</strong>

    ${
      historyEvents.length
        ? `
          <div class="calendar-detail-section-title">Processed</div>
          ${historyEvents.map(item => `
            <div class="calendar-detail-item calendar-history-detail">
              <div>
                <strong>${item.name}</strong><br>
                <span class="${item.amount >= 0 ? "income" : "bill"}">
                  ${formatMoney(item.amount)}
                </span>
              </div>
            </div>
          `).join("")}
        `
        : ""
    }

    ${
      events.length
        ? `
          <div class="calendar-detail-section-title">Upcoming</div>
          ${events.map(item => `
            <div class="calendar-detail-item">
              <div>
                <strong>${item.name}</strong><br>
                <span class="${item.amount >= 0 ? "income" : "bill"}">
                  ${formatMoney(item.amount)}
                </span>
              </div>

              <div class="calendar-actions">
                <button
                  class="edit"
                  onclick="editItemFromCalendar(${item.itemId})">
                  Edit
                </button>

                ${
                  item.skipped
                    ? `<button class="restore compact-action" onclick="restoreEvent('${item.itemId}|${item.dateKey}')">Restore</button>`
                    : `<button class="skip compact-action" onclick="skipEvent(${item.itemId}, '${item.dateKey}', '${escapeText(item.name)}')">Skip</button>`
                }
              </div>
            </div>
          `).join("")}
        `
        : ""
    }
  `;
}
function auditForecast() {
  console.clear();

  const issues = [];

  // Duplicate check
  const seen = new Set();

  currentForecast
    .filter(item => !item.isRangeEnd)
    .forEach(item => {
      const key = item.itemId + "|" + item.dateKey;

      if (seen.has(key)) {
        issues.push(
          `Duplicate event: ${item.name} (${item.dateKey})`
        );
      }

      seen.add(key);
    });

  // Running balance check
  let expectedBalance = currentStartingBalance;

  currentForecast
    .filter(item => !item.isRangeEnd)
    .forEach(item => {

      if (!item.skipped) {
        expectedBalance += item.amount;
      }

      const expected = Number(expectedBalance.toFixed(2));
      const actual = Number(item.balance.toFixed(2));

      if (expected !== actual) {
        issues.push(
          `Balance mismatch: ${item.name} ${item.dateKey}
Expected: ${expected}
Actual: ${actual}`
        );
      }
    });

  if (issues.length === 0) {
    console.log("✅ AUDIT PASSED");
    console.log("No balance mismatches found.");
    console.log("No duplicate forecast events found.");
  } else {
    console.warn(`❌ AUDIT FOUND ${issues.length} ISSUE(S)`);
    issues.forEach(issue => console.warn(issue));
  }
}