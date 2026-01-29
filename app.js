/**
 * 오늘의 급식 - NEIS Open API 연동
 */

const NEIS_KEY = '8c63fa1b7c154802a9565cb7bc403bf6';
const STORAGE_KEY = 'meal_school';

// 시도교육청 코드 (나이스 API)
const REGIONS = [
  { code: 'B10', name: '서울특별시교육청' },
  { code: 'C10', name: '부산광역시교육청' },
  { code: 'D10', name: '대구광역시교육청' },
  { code: 'E10', name: '인천광역시교육청' },
  { code: 'F10', name: '광주광역시교육청' },
  { code: 'G10', name: '대전광역시교육청' },
  { code: 'H10', name: '울산광역시교육청' },
  { code: 'I10', name: '세종특별자치시교육청' },
  { code: 'J10', name: '경기도교육청' },
  { code: 'K10', name: '강원특별자치도교육청' },
  { code: 'M10', name: '충청북도교육청' },
  { code: 'N10', name: '충청남도교육청' },
  { code: 'P10', name: '전북특별자치도교육청' },
  { code: 'Q10', name: '전라남도교육청' },
  { code: 'R10', name: '경상북도교육청' },
  { code: 'S10', name: '경상남도교육청' },
  { code: 'T10', name: '제주특별자치도교육청' },
];

// 알레르기 유발 식재료 (나이스 기준)
const ALLERGY_MAP = {
  1: '난류', 2: '우유', 3: '메밀', 4: '땅콩', 5: '대두', 6: '밀', 7: '고등어', 8: '게',
  9: '새우', 10: '돼지고기', 11: '복숭아', 12: '토마토', 13: '아황산류', 14: '호두',
  15: '닭고기', 16: '쇠고기', 17: '오징어', 18: '조개류', 19: '잣',
};

const WEEKDAY = ['일', '월', '화', '수', '목', '금', '토'];

// DOM
const sectionWelcome = document.getElementById('sectionWelcome');
const sectionMeal = document.getElementById('sectionMeal');
const schoolInfo = document.getElementById('schoolInfo');
const datePicker = document.getElementById('datePicker');
const dateDisplay = document.getElementById('currentDate');
const weekdayEl = document.getElementById('weekday');
const mealBreakfast = document.getElementById('mealBreakfast');
const mealLunch = document.getElementById('mealLunch');
const mealDinner = document.getElementById('mealDinner');
const errorMsg = document.getElementById('errorMsg');
const modalSchool = document.getElementById('modalSchool');
const selectRegion = document.getElementById('selectRegion');
const selectLevel = document.getElementById('selectLevel');
const inputSchoolName = document.getElementById('inputSchoolName');
const schoolList = document.getElementById('schoolList');

let currentSchool = null;
let currentDate = new Date();
let showAllergy = true;
let lastMealData = null;
let viewMode = 'day'; // 'day' | 'week' | 'month'

function getStoredSchool() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function setStoredSchool(school) {
  if (school) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(school));
  } else {
    localStorage.removeItem(STORAGE_KEY);
  }
}

function formatDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return { ymd: `${y}${m}${day}`, display: `${y}.${m}.${day}` };
}

function getWeekday(d) {
  return WEEKDAY[d.getDay()];
}

function initRegionSelect() {
  selectRegion.innerHTML = '<option value="">선택</option>';
  REGIONS.forEach((r) => {
    const opt = document.createElement('option');
    opt.value = r.code;
    opt.textContent = r.name.replace('교육청', '');
    selectRegion.appendChild(opt);
  });
}

async function searchSchools() {
  const regionCode = selectRegion.value;
  const levelCode = selectLevel.value;
  const name = inputSchoolName.value.trim();
  if (!regionCode || !name) {
    errorMsg.textContent = '시/도와 학교명을 입력해 주세요.';
    errorMsg.hidden = false;
    return;
  }

  schoolList.innerHTML = '';
  const url = new URL('https://open.neis.go.kr/hub/schoolInfo');
  url.searchParams.set('KEY', NEIS_KEY);
  url.searchParams.set('Type', 'json');
  url.searchParams.set('pIndex', '1');
  url.searchParams.set('pSize', '50');
  url.searchParams.set('ATPT_OFCDC_SC_CODE', regionCode);
  url.searchParams.set('SCHUL_NM', name);

  try {
    const res = await fetch(url.toString());
    const data = await res.json();
    errorMsg.hidden = true;

    let list = [];
    if (data.schoolInfo && Array.isArray(data.schoolInfo)) {
      const rows = data.schoolInfo[1]?.row || [];
      const levelFilter = levelCode === '02' ? '초등' : levelCode === '03' ? '중학교' : '고등';
      list = rows.filter((s) => !levelCode || (s.SCHUL_KND_SC_NM && s.SCHUL_KND_SC_NM.includes(levelFilter)));
    }

    if (list.length === 0) {
      schoolList.innerHTML = '<p class="school-item" style="pointer-events:none;color:var(--text-muted)">검색 결과가 없습니다.</p>';
      return;
    }

    list.forEach((s) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'school-item';
      btn.textContent = `${s.SCHUL_NM} (${s.SCHUL_KND_SC_NM || ''})`;
      btn.addEventListener('click', () => selectSchool({
        officeCode: s.ATPT_OFCDC_SC_CODE,
        schoolCode: s.SD_SCHUL_CODE,
        schoolName: s.SCHUL_NM,
        level: s.SCHUL_KND_SC_NM || '',
      }));
      schoolList.appendChild(btn);
    });
  } catch (e) {
    errorMsg.textContent = '학교 검색 중 오류가 발생했습니다.';
    errorMsg.hidden = false;
  }
}

function selectSchool(school) {
  currentSchool = school;
  setStoredSchool(school);
  modalSchool.close();
  sectionWelcome.hidden = true;
  sectionMeal.hidden = false;
  schoolInfo.textContent = currentSchool.schoolName;
  currentDate = new Date();
  loadMeals();
}

function renderMealContent(container, items, showAllergyFlag) {
  if (!items || items.length === 0) {
    container.innerHTML = '<p class="empty">급식 정보 없음</p>';
    container.classList.add('empty');
    return;
  }
  container.classList.remove('empty');
  container.innerHTML = items.map((item) => {
    const name = item.name || item;
    const nums = item.allergy || [];
    if (!showAllergyFlag || nums.length === 0) {
      return `<div class="meal-item">${escapeHtml(name)}</div>`;
    }
    const dataAllergy = nums.join('.');
    return `<div class="meal-item">${escapeHtml(name)} <button type="button" class="allergy-num allergy-trigger" data-allergy="${escapeHtml(dataAllergy)}" aria-label="알레르기 정보 자세히 보기">${nums.join('.')}</button></div>`;
  }).join('');
}

function showAllergyDetail(allergyNums) {
  const nums = allergyNums.replace(/\s/g, '').split('.').filter(Boolean).map(Number).filter((n) => n >= 1 && n <= 19);
  const listEl = document.getElementById('allergyPopoverList');
  const popover = document.getElementById('allergyPopover');
  listEl.innerHTML = nums.map((n) => `<li><span class="allergy-num-badge">${n}</span> ${ALLERGY_MAP[n] || n}</li>`).join('');
  popover.classList.add('is-open');
  popover.removeAttribute('hidden');
  document.body.style.overflow = 'hidden';
}

function hideAllergyDetail() {
  const popover = document.getElementById('allergyPopover');
  if (popover) {
    popover.classList.remove('is-open');
    popover.setAttribute('hidden', '');
    document.body.style.overflow = '';
  }
}

function escapeHtml(s) {
  const div = document.createElement('div');
  div.textContent = s;
  return div.innerHTML;
}

function parseDishRow(dishStr) {
  if (!dishStr || typeof dishStr !== 'string') return { name: dishStr, allergy: [] };
  const match = dishStr.match(/^(.+?)(?:\s*[\(\（]?([0-9.\s]+)[\)\）]?\s*)?$/);
  const name = (match ? match[1] : dishStr).trim();
  const numStr = match && match[2] ? match[2] : '';
  const allergy = numStr.replace(/\s/g, '').split('.').filter(Boolean).map(Number).filter((n) => n >= 1 && n <= 19);
  return { name, allergy };
}

function groupByMealType(rows) {
  const breakfast = [];
  const lunch = [];
  const dinner = [];
  const map = { 1: breakfast, 2: lunch, 3: dinner };
  const typeMap = { 조식: 1, 중식: 2, 석식: 3 };
  rows.forEach((row) => {
    const type = typeMap[row.MMEAL_SC_NM] || 0;
    const list = map[type];
    if (!list) return;
    const dishStr = row.DDISH_NM || '';
    const lines = dishStr.split('<br/>').map((s) => s.trim()).filter(Boolean);
    lines.forEach((line) => {
      list.push(parseDishRow(line));
    });
  });
  return { breakfast, lunch, dinner };
}

function getDateInputValue(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** 해당 주 월요일 00:00 (한국 주간: 월~일) */
function getWeekStart(d) {
  const x = new Date(d);
  const day = x.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  x.setDate(x.getDate() + diff);
  x.setHours(0, 0, 0, 0);
  return x;
}

/** 한 날짜의 급식 데이터 요청 (Promise) */
async function fetchMealForDate(ymd) {
  if (!currentSchool) return { breakfast: [], lunch: [], dinner: [] };
  const url = new URL('https://open.neis.go.kr/hub/mealServiceDietInfo');
  url.searchParams.set('KEY', NEIS_KEY);
  url.searchParams.set('Type', 'json');
  url.searchParams.set('pIndex', '1');
  url.searchParams.set('pSize', '100');
  url.searchParams.set('ATPT_OFCDC_SC_CODE', currentSchool.officeCode);
  url.searchParams.set('SD_SCHUL_CODE', currentSchool.schoolCode);
  url.searchParams.set('MLSV_YMD', ymd);
  try {
    const res = await fetch(url.toString());
    const data = await res.json();
    if (data.mealServiceDietInfo && Array.isArray(data.mealServiceDietInfo)) {
      const rows = data.mealServiceDietInfo[1]?.row || [];
      return groupByMealType(rows);
    }
  } catch (_) {}
  return { breakfast: [], lunch: [], dinner: [] };
}

function renderMealContentHtml(items, showAllergyFlag) {
  if (!items || items.length === 0) return '<p class="empty">급식 정보 없음</p>';
  return items.map((item) => {
    const name = item.name || item;
    const nums = item.allergy || [];
    if (!showAllergyFlag || nums.length === 0) {
      return `<div class="meal-item">${escapeHtml(name)}</div>`;
    }
    const dataAllergy = nums.join('.');
    return `<div class="meal-item">${escapeHtml(name)} <button type="button" class="allergy-num allergy-trigger" data-allergy="${escapeHtml(dataAllergy)}" aria-label="알레르기 정보 자세히 보기">${nums.join('.')}</button></div>`;
  }).join('');
}

async function loadMeals() {
  if (!currentSchool) return;
  const { ymd, display } = formatDate(currentDate);
  const isToday = formatDate(new Date()).ymd === ymd;
  if (datePicker) datePicker.value = getDateInputValue(currentDate);
  dateDisplay.textContent = isToday ? `오늘 (${display})` : display;
  dateDisplay.setAttribute('datetime', getDateInputValue(currentDate));
  weekdayEl.textContent = getWeekday(currentDate) + '요일';

  errorMsg.hidden = true;
  mealBreakfast.innerHTML = '';
  mealLunch.innerHTML = '';
  mealDinner.innerHTML = '';

  const url = new URL('https://open.neis.go.kr/hub/mealServiceDietInfo');
  url.searchParams.set('KEY', NEIS_KEY);
  url.searchParams.set('Type', 'json');
  url.searchParams.set('pIndex', '1');
  url.searchParams.set('pSize', '100');
  url.searchParams.set('ATPT_OFCDC_SC_CODE', currentSchool.officeCode);
  url.searchParams.set('SD_SCHUL_CODE', currentSchool.schoolCode);
  url.searchParams.set('MLSV_YMD', ymd);

  try {
    const res = await fetch(url.toString());
    const data = await res.json();

    if (data.mealServiceDietInfo && Array.isArray(data.mealServiceDietInfo)) {
      const rows = data.mealServiceDietInfo[1]?.row || [];
      lastMealData = groupByMealType(rows);
    } else {
      lastMealData = { breakfast: [], lunch: [], dinner: [] };
    }
    const { breakfast, lunch, dinner } = lastMealData;
    renderMealContent(mealBreakfast, breakfast, showAllergy);
    renderMealContent(mealLunch, lunch, showAllergy);
    renderMealContent(mealDinner, dinner, showAllergy);
  } catch (e) {
    lastMealData = { breakfast: [], lunch: [], dinner: [] };
    errorMsg.textContent = '급식 정보를 불러오지 못했습니다. (CORS 오류 시 로컬 서버에서 실행해 보세요)';
    errorMsg.hidden = false;
    renderMealContent(mealBreakfast, [], showAllergy);
    renderMealContent(mealLunch, [], showAllergy);
    renderMealContent(mealDinner, [], showAllergy);
  }
}

async function loadMealsWeek() {
  if (!currentSchool) return;
  errorMsg.hidden = true;
  const weekStart = getWeekStart(currentDate);
  const weekRangeEl = document.getElementById('weekRange');
  const weekDaysEl = document.getElementById('weekDays');
  const mon = formatDate(weekStart);
  const sun = new Date(weekStart);
  sun.setDate(sun.getDate() + 6);
  weekRangeEl.textContent = `${mon.display} ~ ${formatDate(sun).display}`;

  const ymds = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    ymds.push({ d, ymd: formatDate(d).ymd });
  }
  const results = await Promise.all(ymds.map((x) => fetchMealForDate(x.ymd)));
  weekDaysEl.innerHTML = ymds.map((obj, i) => {
    const { d, ymd } = obj;
    const data = results[i];
    const isToday = formatDate(new Date()).ymd === ymd;
    const dayLabel = `${d.getMonth() + 1}/${d.getDate()} (${getWeekday(d)})`;
    const b = renderMealContentHtml(data.breakfast, showAllergy);
    const l = renderMealContentHtml(data.lunch, showAllergy);
    const din = renderMealContentHtml(data.dinner, showAllergy);
    return `<article class="week-day-card ${isToday ? 'is-today' : ''}">
      <h3 class="week-day-title">${dayLabel}${isToday ? ' <span class="today-badge">오늘</span>' : ''}</h3>
      <div class="week-day-meals">
        <div class="week-meal"><span class="week-meal-label">🍚 아침</span><div class="meal-content">${b}</div></div>
        <div class="week-meal"><span class="week-meal-label">🍱 점심</span><div class="meal-content">${l}</div></div>
        <div class="week-meal"><span class="week-meal-label">🍽 저녁</span><div class="meal-content">${din}</div></div>
      </div>
    </article>`;
  }).join('');
}

async function loadMealsMonth() {
  if (!currentSchool) return;
  errorMsg.hidden = true;
  const y = currentDate.getFullYear();
  const m = currentDate.getMonth();
  const monthRangeEl = document.getElementById('monthRange');
  const monthDaysEl = document.getElementById('monthDays');

  monthRangeEl.textContent = `${y}년 ${m + 1}월`;

  const firstDay = new Date(y, m, 1);
  const lastDay = new Date(y, m + 1, 0).getDate();
  const startWeekday = firstDay.getDay();

  const ymds = [];
  for (let day = 1; day <= lastDay; day++) {
    const d = new Date(y, m, day);
    ymds.push({ d, ymd: formatDate(d).ymd });
  }
  const results = await Promise.all(ymds.map((x) => fetchMealForDate(x.ymd)));

  const slots = [];
  for (let i = 0; i < startWeekday; i++) slots.push(null);
  for (let i = 0; i < lastDay; i++) slots.push({ obj: ymds[i], data: results[i] });
  const totalCells = Math.ceil(slots.length / 7) * 7;
  while (slots.length < totalCells) slots.push(null);

  const weeks = [];
  for (let w = 0; w < slots.length; w += 7) weeks.push(slots.slice(w, w + 7));

  function renderDayCard(slot) {
    if (!slot) return '<div class="month-day-card month-day-card--empty"></div>';
    const { d, ymd } = slot.obj;
    const data = slot.data;
    const isToday = formatDate(new Date()).ymd === ymd;
    const dayLabel = `${d.getDate()}일 (${getWeekday(d)})`;
    const b = renderMealContentHtml(data.breakfast, showAllergy);
    const l = renderMealContentHtml(data.lunch, showAllergy);
    const din = renderMealContentHtml(data.dinner, showAllergy);
    return `<article class="month-day-card ${isToday ? 'is-today' : ''}">
      <h3 class="month-day-title">${dayLabel}${isToday ? ' <span class="today-badge">오늘</span>' : ''}</h3>
      <div class="month-day-meals">
        <div class="month-meal"><span class="month-meal-label">🍚 아침</span><div class="meal-content">${b}</div></div>
        <div class="month-meal"><span class="month-meal-label">🍱 점심</span><div class="meal-content">${l}</div></div>
        <div class="month-meal"><span class="month-meal-label">🍽 저녁</span><div class="meal-content">${din}</div></div>
      </div>
    </article>`;
  }

  monthDaysEl.innerHTML = weeks.map((week) => `<div class="month-week-row">${week.map(renderDayCard).join('')}</div>`).join('');
}

function switchView(mode) {
  viewMode = mode;
  document.querySelectorAll('.view-tab').forEach((tab) => {
    const isActive = tab.dataset.view === mode;
    tab.classList.toggle('active', isActive);
    tab.setAttribute('aria-selected', isActive);
  });
  const viewDay = document.getElementById('viewDay');
  const viewWeek = document.getElementById('viewWeek');
  const viewMonth = document.getElementById('viewMonth');
  viewDay.hidden = mode !== 'day';
  viewWeek.hidden = mode !== 'week';
  viewMonth.hidden = mode !== 'month';
  if (mode === 'day') loadMeals();
  else if (mode === 'week') loadMealsWeek();
  else if (mode === 'month') loadMealsMonth();
}

function openSchoolModal() {
  modalSchool.showModal();
  inputSchoolName.value = '';
  schoolList.innerHTML = '';
}

function init() {
  initRegionSelect();
  currentSchool = getStoredSchool();

  if (currentSchool) {
    sectionWelcome.hidden = true;
    sectionMeal.hidden = false;
    schoolInfo.textContent = currentSchool.schoolName;
    loadMeals();
  } else {
    sectionWelcome.hidden = false;
    sectionMeal.hidden = true;
  }

  document.getElementById('btnSelectSchool').addEventListener('click', openSchoolModal);
  document.getElementById('btnSchool').addEventListener('click', openSchoolModal);
  if (datePicker) {
    datePicker.addEventListener('change', function () {
      const val = this.value;
      if (val) {
        currentDate = new Date(val + 'T12:00:00');
        if (viewMode === 'day') loadMeals();
        else if (viewMode === 'week') loadMealsWeek();
        else if (viewMode === 'month') loadMealsMonth();
      }
    });
  }
  document.querySelectorAll('.view-tab').forEach((tab) => {
    tab.addEventListener('click', function () {
      switchView(this.dataset.view);
    });
  });
  document.getElementById('toggleAllergy').addEventListener('change', (e) => {
    showAllergy = e.target.checked;
    if (lastMealData) {
      renderMealContent(mealBreakfast, lastMealData.breakfast, showAllergy);
      renderMealContent(mealLunch, lastMealData.lunch, showAllergy);
      renderMealContent(mealDinner, lastMealData.dinner, showAllergy);
    }
  });
  document.getElementById('btnCloseModal').addEventListener('click', () => modalSchool.close());
  document.getElementById('btnSearchSchool').addEventListener('click', searchSchools);
  document.getElementById('schoolForm').addEventListener('submit', (e) => {
    e.preventDefault();
    searchSchools();
  });

  modalSchool.addEventListener('click', (e) => {
    if (e.target === modalSchool) modalSchool.close();
  });

  const allergyPopover = document.getElementById('allergyPopover');

  document.getElementById('allergyPopoverClose').addEventListener('click', function () {
    hideAllergyDetail();
  });
  document.getElementById('allergyPopoverBackdrop').addEventListener('click', function () {
    hideAllergyDetail();
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && allergyPopover && allergyPopover.classList.contains('is-open')) {
      hideAllergyDetail();
    }
  });

  sectionMeal.addEventListener('click', (e) => {
    const btn = e.target.closest('.allergy-trigger');
    if (btn && btn.dataset.allergy) {
      e.preventDefault();
      showAllergyDetail(btn.dataset.allergy);
    }
  });
}

init();
