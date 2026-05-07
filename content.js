// 检查URL是否以目标地址开头
const targetUrlPrefix = 'https://buyin.jinritemai.com/dashboard/dataCenter/order';
const exportListUrl = 'https://buyin.jinritemai.com/dashboard/dataCenter/export-list';

let lastUrl = window.location.href;
const exportTriggeredKey = 'order_export_triggered';
const downloadTriggeredKey = 'order_download_triggered';
const lastExportListRefreshTimeKey = 'order_last_export_list_refresh_time';
const tabIdKey = 'order_automation_tab_id';
const lastRunKeyPrefix = 'order_last_successful_run_date';

// 任务状态变量（必须在使用前声明）
let downloadTriggered = sessionStorage.getItem(downloadTriggeredKey) === '1';
let exportTriggered = sessionStorage.getItem(exportTriggeredKey) === '1';
let dateSelected = false;
let dateSelectionInProgress = false;
let tabClicked = false;
let searchTriggered = false;
let lastExportClickTime = 0;
let lastExportListRefreshTime = Number(sessionStorage.getItem(lastExportListRefreshTimeKey) || 0);

// 生成或获取当前tab的唯一ID；sessionStorage 会跟随当前标签页刷新保留，新标签页独立生成
const getTabId = () => {
  let tabId = sessionStorage.getItem(tabIdKey);
  if (!tabId) {
    tabId = `tab_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
    sessionStorage.setItem(tabIdKey, tabId);
  }
  return tabId;
};

const getLastRunKey = () => {
  return `${lastRunKeyPrefix}_${getTabId()}`;
};

// 每天只运行一次的控制
const checkDailyLimit = () => {
  const lastRunKey = getLastRunKey();
  const lastRun = localStorage.getItem(lastRunKey);
  const today = new Date().toDateString();

  console.log(`[DailyLimit] tabId=${getTabId()}, lastRun=${lastRun}, today=${today}`);

  if (lastRun === today) {
    console.log(`[DailyLimit] 今日已运行，跳过`);
    return false;
  }

  console.log(`[DailyLimit] 今日未完成，允许运行`);
  return true;
};

// 重置当前页面会话里的任务状态
const resetTaskState = () => {
  sessionStorage.removeItem(exportTriggeredKey);
  sessionStorage.removeItem(downloadTriggeredKey);
  sessionStorage.removeItem(lastExportListRefreshTimeKey);
  downloadTriggered = false;
  exportTriggered = false;
  dateSelected = false;
  dateSelectionInProgress = false;
  tabClicked = false;
  searchTriggered = false;
  lastExportClickTime = 0;
  lastExportListRefreshTime = 0;
  console.log(`[DailyLimit] 状态已重置`);
};

const markTodayRunCompleted = () => {
  const today = new Date().toDateString();
  localStorage.setItem(getLastRunKey(), today);
  console.log(`[DailyLimit] 下载完成，已记录当前tab今日运行: ${today}`);
};

// 如果在订单页面且之前有download记录，说明是完成了上一轮刷新回来的，重置状态
if (window.location.href.startsWith(targetUrlPrefix) && (downloadTriggered || exportTriggered)) {
  console.log('[Init] 在订单页面，重置上一次任务状态');
  resetTaskState();
}

// 检查每日限制（在变量声明之后）
const canRunTask = checkDailyLimit();

const setAutomationState = (key, value) => {
  sessionStorage.setItem(key, value ? '1' : '0');
};

const isVisible = (element) => {
  return Boolean(element && element.getClientRects().length > 0);
};

const findVisibleButtonByText = (text, scope = document) => {
  const buttons = scope.querySelectorAll('button');

  for (let btn of buttons) {
    if (btn.textContent.trim() === text && isVisible(btn) && !btn.disabled) {
      return btn;
    }
  }

  return null;
};

const formatPickerDate = (date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const formatPickerTime = (date) => {
  const h = String(date.getHours()).padStart(2, '0');
  const m = String(date.getMinutes()).padStart(2, '0');
  const s = String(date.getSeconds()).padStart(2, '0');
  return `${h}:${m}:${s}`;
};

const setNativeInputValue = (input, value) => {
  const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  nativeSetter.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
};

const findPickerDateCell = (dateStr) => {
  const cells = document.querySelectorAll('.auxo-picker-dropdown td.auxo-picker-cell');

  for (let cell of cells) {
    if (cell.getAttribute('title') === dateStr && !cell.classList.contains('auxo-picker-cell-disabled')) {
      return cell;
    }
  }

  return null;
};

const setPickerTimeRange = (startTime, endTime) => {
  const timeInputs = Array.from(document.querySelectorAll('.auxo-picker-dropdown input'));
  const startTimeInput = timeInputs.find(input => input.placeholder === '开始时间') ||
                         document.querySelector('input[placeholder="开始时间"]');
  const endTimeInput = timeInputs.find(input => input.placeholder === '结束时间') ||
                       document.querySelector('input[placeholder="结束时间"]');

  if (!startTimeInput || !endTimeInput) {
    console.log('未找到开始/结束时间输入框');
    return false;
  }

  setNativeInputValue(startTimeInput, startTime);
  setNativeInputValue(endTimeInput, endTime);
  console.log(`已设置时间范围: ${startTime} - ${endTime}`);
  return true;
};

const setDateRange = () => {
  if (!canRunTask) return;
  if (dateSelected) return;
  if (dateSelectionInProgress) return;
  if (!tabClicked) return;
  if (!window.location.href.startsWith(targetUrlPrefix)) return;

  const startInput = document.getElementById('order_detail_range_time');
  if (!startInput) {
    console.log('未找到开始日期输入框');
    return;
  }

  const inputWrapper = startInput.closest('.auxo-picker-input');
  if (inputWrapper) {
    inputWrapper.click();
    console.log('已点击日期输入框包装器');
  } else {
    startInput.click();
    console.log('已点击开始日期输入框');
  }

  dateSelectionInProgress = true;

  setTimeout(() => {
    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const startDateStr = formatPickerDate(twentyFourHoursAgo);
    const endDateStr = formatPickerDate(now);
    const startTimeStr = formatPickerTime(twentyFourHoursAgo);
    const endTimeStr = formatPickerTime(now);

    console.log(`目标开始时间: ${startDateStr} ${startTimeStr}`);
    console.log(`目标结束时间: ${endDateStr} ${endTimeStr}`);

    const startCell = findPickerDateCell(startDateStr);

    if (!startCell) {
      console.log(`未找到开始日期单元格: ${startDateStr}`);
      dateSelectionInProgress = false;
      return;
    }

    startCell.click();
    console.log(`已点击开始日期: ${startDateStr}`);

    setTimeout(() => {
      const endCell = findPickerDateCell(endDateStr);

      if (!endCell) {
        console.log(`未找到结束日期单元格: ${endDateStr}`);
        dateSelectionInProgress = false;
        return;
      }

      endCell.click();
      console.log(`已点击结束日期: ${endDateStr}`);

      setTimeout(() => {
        if (!setPickerTimeRange(startTimeStr, endTimeStr)) {
          console.log('设置时间失败，停止本轮日期选择');
          dateSelectionInProgress = false;
          return;
        }

        const confirmBtn = document.querySelector('button.sp-picker-range-ok-btn');
        if (confirmBtn) {
          confirmBtn.click();
          console.log('已点击"确定"按钮');
          dateSelected = true;
          dateSelectionInProgress = false;
        } else {
          console.log('未找到"确定"按钮');
          dateSelectionInProgress = false;
        }
      }, 300);
    }, 500);
  }, 800);
};

const clickTabIfFound = () => {
  if (!canRunTask) return;
  if (tabClicked) return;
  if (!window.location.href.startsWith(targetUrlPrefix)) return;

  const allTabs = document.querySelectorAll('div.auxo-tabs-tab-btn');
  let targetTab = null;

  for (let tab of allTabs) {
    if (tab.textContent.trim() === '全部订单') {
      targetTab = tab;
      break;
    }
  }

  if (targetTab && targetTab.offsetParent !== null) {
    targetTab.click();
    console.log('已点击"全部订单"标签');
    tabClicked = true;
  }
};

const clickSearchBtnIfFound = () => {
  if (!canRunTask) return;
  if (!tabClicked) return;
  if (!dateSelected) return;
  if (searchTriggered) return;
  if (!window.location.href.startsWith(targetUrlPrefix)) return;

  const searchBtns = document.querySelectorAll('button.auxo-btn.auxo-btn-dashed');
  let searchBtn = null;

  for (let btn of searchBtns) {
    if (btn.textContent.trim() === '查询') {
      searchBtn = btn;
      break;
    }
  }

  if (searchBtn && searchBtn.offsetParent !== null) {
    searchBtn.click();
    console.log('已点击"查询"按钮');
    searchTriggered = true;
  }
};

const clickExportBtnIfFound = () => {
  if (!canRunTask) {
    console.log('导出跳过: 每日限制');
    return;
  }
  if (!dateSelected) {
    console.log('导出跳过: dateSelected=false');
    return;
  }
  if (!window.location.href.startsWith(targetUrlPrefix)) {
    console.log('导出跳过: URL不匹配');
    return;
  }
  if (exportTriggered || downloadTriggered) {
    console.log(`导出跳过: exportTriggered=${exportTriggered}, downloadTriggered=${downloadTriggered}`);
    return;
  }

  const now = Date.now();
  if (now - lastExportClickTime < 60000) {
    console.log(`导出跳过: 60秒限制 now=${now}, lastClick=${lastExportClickTime}, diff=${now - lastExportClickTime}`);
    return;
  }

  const exportBtns = document.querySelectorAll('button.auxo-btn.data-export__btn');
  let exportBtn = null;

  for (let btn of exportBtns) {
    if (btn.textContent.trim() === '导出数据') {
      exportBtn = btn;
      break;
    }
  }

  console.log(`导出按钮: ${exportBtn ? '找到' : '未找到'}, visible=${exportBtn && exportBtn.offsetParent !== null ? '是' : '否'}`);

  if (exportBtn && exportBtn.offsetParent !== null) {
    exportBtn.click();
    console.log('已点击"导出数据"按钮');
    lastExportClickTime = now;
    setTimeout(clickModalExportBtnIfFound, 1500);
  }
};

const clickModalExportBtnIfFound = () => {
  if (!canRunTask) return;
  if (!window.location.href.startsWith(targetUrlPrefix)) return;
  if (exportTriggered || downloadTriggered) return;

  const modalBtns = document.querySelectorAll('button.auxo-btn.auxo-btn-primary');
  let modalExportBtn = null;

  for (let btn of modalBtns) {
    if (btn.textContent.trim() === '导出') {
      modalExportBtn = btn;
      break;
    }
  }

  if (modalExportBtn && modalExportBtn.offsetParent !== null) {
    modalExportBtn.click();
    console.log('已点击弹窗中的"导出"按钮');
    exportTriggered = true;
    downloadTriggered = false;
    setAutomationState(exportTriggeredKey, true);
    setAutomationState(downloadTriggeredKey, false);
  }
};

const checkUrlChange = () => {
  const currentUrl = window.location.href;
  if (lastUrl.startsWith(targetUrlPrefix) && currentUrl.startsWith(exportListUrl)) {
    console.log('检测到页面跳转到导出列表，等待下载报表生成');
  }
  lastUrl = currentUrl;
};

const clickDownloadBtnIfFound = () => {
  if (!canRunTask) return;
  if (!window.location.href.startsWith(exportListUrl)) return;

  console.log(`downloadTriggered=${downloadTriggered}, exportTriggered=${exportTriggered}, url=${window.location.href}`);

  if (!exportTriggered || downloadTriggered) {
    console.log(`跳过下载: exportTriggered=${exportTriggered}, downloadTriggered=${downloadTriggered}`);
    return;
  }

  const exportListItems = document.querySelectorAll('div.export-list-item');
  console.log(`找到${exportListItems.length}个导出列表项`);

  let downloadBtn = null;

  if (exportListItems.length > 0) {
    const firstItem = exportListItems[0];
    downloadBtn = findVisibleButtonByText('下载报表', firstItem);
  }

  if (!downloadBtn) {
    downloadBtn = findVisibleButtonByText('下载报表');
  }

  console.log(`找到下载按钮: ${downloadBtn ? downloadBtn.textContent.trim() : 'null'}`);

  if (downloadBtn) {
    downloadBtn.click();
    console.log('已点击"下载报表"按钮');
    downloadTriggered = true;
    exportTriggered = false;
    setAutomationState(downloadTriggeredKey, true);
    setAutomationState(exportTriggeredKey, false);
    sessionStorage.removeItem(lastExportListRefreshTimeKey);

    markTodayRunCompleted();

    setTimeout(clickAllianceOrderItem, 1500);
  } else if (exportListItems.length > 0 && Date.now() - lastExportListRefreshTime > 10000) {
    console.log('下载按钮还未生成，刷新页面');
    lastExportListRefreshTime = Date.now();
    sessionStorage.setItem(lastExportListRefreshTimeKey, String(lastExportListRefreshTime));
    window.location.reload();
  }
};

const clickAllianceOrderItem = () => {
  if (!canRunTask) return;
  const menuItems = document.querySelectorAll('li.auxo-menu-item');
  for (let item of menuItems) {
    if (item.textContent.includes('联盟订单明细')) {
      item.click();
      console.log('已点击"联盟订单明细"，重置状态并刷新页面');
      resetTaskState();
      setTimeout(() => window.location.reload(), 500);
      break;
    }
  }
};

const startAutomation = () => {
  setTimeout(clickTabIfFound, 1000);
  setInterval(clickTabIfFound, 5000);
  setInterval(setDateRange, 2000);
  setInterval(clickSearchBtnIfFound, 2000);
  setInterval(clickExportBtnIfFound, 5000);
  setInterval(clickModalExportBtnIfFound, 2000);
  setInterval(clickDownloadBtnIfFound, 3000);
  setInterval(checkUrlChange, 1000);
};

// 页面加载完成后开始定期执行
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', startAutomation);
} else {
  startAutomation();
}
