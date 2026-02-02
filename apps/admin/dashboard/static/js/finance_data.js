// 한국거래소 데이터 관련 JavaScript

// 날짜 포맷팅 함수
function formatDate(basDd) {
  const year = basDd.substring(0, 4);
  const month = basDd.substring(4, 6);
  const day = basDd.substring(6, 8);
  return `${year}년 ${parseInt(month)}월 ${parseInt(day)}일`;
}

// HTML 이스케이프
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// 탭 전환 함수
function switchTab(tabName) {
  // 모든 탭 버튼과 콘텐츠 비활성화
  document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));

  // 선택된 탭 활성화
  const tabButton = document.querySelector(`button[onclick="switchTab('${tabName}')"]`);
  if (tabButton) {
    tabButton.classList.add('active');
  }
  const tabContent = document.getElementById(`tab-${tabName}`);
  if (tabContent) {
    tabContent.classList.add('active');
  }

  // 데이터 자동 로드
  switch(tabName) {
    case 'kospi':
      fetchKospiIndex();
      break;
    case 'kosdaq':
      fetchKosdaqIndex();
      break;
    case 'etf':
      fetchEtfData();
      break;
  }
}

// 아코디언 토글 함수
function toggleAccordion(itemId) {
  const item = document.getElementById(itemId);
  if (!item) return;
  
  const header = item.querySelector('.accordion-header');
  const content = item.querySelector('.accordion-content');
  
  const isActive = header.classList.contains('active');
  
  // 모든 아코디언 닫기
  document.querySelectorAll('.accordion-item').forEach(accItem => {
    accItem.querySelector('.accordion-header').classList.remove('active');
    accItem.querySelector('.accordion-content').classList.remove('active');
  });
  
  // 클릭한 항목만 열기/닫기
  if (!isActive) {
    header.classList.add('active');
    content.classList.add('active');
    
    // 데이터가 아직 로드되지 않았으면 로드
    const dataContainer = content.querySelector('.accordion-body');
    if (dataContainer && dataContainer.dataset.loaded !== 'true') {
      const dataType = dataContainer.dataset.dataType;
      const basDd = dataContainer.dataset.basDd;
      loadAccordionData(dataType, basDd, dataContainer);
    }
  }
}

// 아코디언 데이터 로드
async function loadAccordionData(dataType, basDd, container) {
  container.innerHTML = '<div class="loading">데이터를 가져오는 중...</div>';

  try {
    const response = await fetch(`/api/krx-data-by-date?data_type=${dataType}&bas_dd=${basDd}`);
    const data = await response.json();

    if (response.ok) {
      if (data.error) {
        throw new Error(data.error);
      }

      // 데이터 타입에 따라 적절한 테이블 생성
      let items = Array.isArray(data) ? data : [];
      let html = '';
      if (items.length === 0) {
        html = '<div class="empty-message">데이터가 없습니다.</div>';
      } else {
        if (dataType === 'etf') {
          html = jsonToEtfTable(items);
        } else {
          html = jsonToKospiTable(items);
        }
      }

      container.innerHTML = html;
      container.dataset.loaded = 'true';
    } else {
      throw new Error(data.error || data.detail || '데이터를 가져오는데 실패했습니다.');
    }
  } catch (error) {
    container.innerHTML = `<div class="error">오류 발생: ${error.message}</div>`;
  }
}

// 아코디언 목록 생성
async function buildAccordion(dataType, containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  container.innerHTML = '<div class="loading">날짜 목록을 불러오는 중...</div>';

  try {
    // 날짜 목록 조회
    const datesResponse = await fetch(`/api/krx-dates?data_type=${dataType}`);
    const datesResult = await datesResponse.json();

    if (!datesResponse.ok || !datesResult.dates || datesResult.dates.length === 0) {
      // DB에 데이터가 없으면 API를 먼저 호출해서 데이터 저장
      container.innerHTML = '<div class="loading">최신 데이터를 가져오는 중...</div>';

      try {
        let apiResponse;
        if (dataType === 'kospi') {
          apiResponse = await fetch('/api/krx-kospi');
        } else if (dataType === 'kosdaq') {
          apiResponse = await fetch('/api/krx-kosdaq');
        } else if (dataType === 'etf') {
          apiResponse = await fetch('/api/krx-etf');
        }

        if (apiResponse && apiResponse.ok) {
          // API 호출 성공 후 다시 날짜 목록 조회
          const retryDatesResponse = await fetch(`/api/krx-dates?data_type=${dataType}`);
          const retryDatesResult = await retryDatesResponse.json();

          if (!retryDatesResponse.ok || !retryDatesResult.dates || retryDatesResult.dates.length === 0) {
            container.innerHTML = '<div class="empty-message">데이터를 가져올 수 없습니다.</div>';
            return;
          }

          // 성공적으로 데이터를 가져왔으면 아코디언 생성
          buildAccordionHTML(dataType, containerId, retryDatesResult.dates);
        } else {
          container.innerHTML = '<div class="empty-message">데이터를 가져올 수 없습니다.</div>';
        }
      } catch (error) {
        container.innerHTML = `<div class="error">데이터 조회 오류: ${error.message}</div>`;
      }
      return;
    }

    // 날짜 데이터가 있으면 바로 아코디언 생성
    buildAccordionHTML(dataType, containerId, datesResult.dates);
  } catch (error) {
    container.innerHTML = `<div class="error">오류 발생: ${error.message}</div>`;
  }
}

// 아코디언 HTML 생성 헬퍼 함수
function buildAccordionHTML(dataType, containerId, dates) {
  const container = document.getElementById(containerId);
  if (!container || !dates || dates.length === 0) return;

  // 아코디언 HTML 생성
  let html = '';
  dates.forEach((basDd, index) => {
    const dateStr = formatDate(basDd);
    const itemId = `accordion-${dataType}-${basDd}`;
    html += `
      <div class="accordion-item" id="${itemId}">
        <div class="accordion-header" onclick="toggleAccordion('${itemId}')">
          <div class="accordion-title">${dateStr} ${dataType === 'etf' ? 'ETF 정보' : '지수'}</div>
          <div class="accordion-icon">▼</div>
        </div>
        <div class="accordion-content">
          <div class="accordion-body" data-data-type="${dataType}" data-bas-dd="${basDd}">
            <div class="loading">상세 정보를 불러오는 중...</div>
          </div>
        </div>
      </div>
    `;
  });

  container.innerHTML = html;

  // 첫 번째 항목 자동 열기
  if (dates.length > 0) {
    const firstItemId = `accordion-${dataType}-${dates[0]}`;
    setTimeout(() => toggleAccordion(firstItemId), 100);
  }
}

// 코스피 지수 조회
async function fetchKospiIndex() {
  await buildAccordion('kospi', 'kospi-accordion');
}

// 코스닥 지수 조회
async function fetchKosdaqIndex() {
  await buildAccordion('kosdaq', 'kosdaq-accordion');
}

// ETF 데이터 조회
async function fetchEtfData() {
  await buildAccordion('etf', 'etf-accordion');
}

// 지수 테이블 생성 헬퍼 함수
function createIndexTable(items) {
  if (!items || !Array.isArray(items) || items.length === 0) {
    return '<div class="empty-message">데이터가 없습니다.</div>';
  }
  
  const displayFields = [
    { key: 'BAS_DD', label: '기준일자' },
    { key: 'IDX_NM', label: '지수명' },
    { key: 'CLSPRC_IDX', label: '종가' },
    { key: 'CMPPREVDD_IDX', label: '대비' },
    { key: 'FLUC_RT', label: '등락률(%)' },
    { key: 'OPNPRC_IDX', label: '시가' },
    { key: 'HGPRC_IDX', label: '고가' },
    { key: 'LWPRC_IDX', label: '저가' },
    { key: 'ACC_TRDVOL', label: '거래량' },
    { key: 'ACC_TRDVAL', label: '거래대금' }
  ];

  let html = '<table class="data-table"><thead><tr>';
  displayFields.forEach(field => {
    html += `<th>${field.label}</th>`;
  });
  html += '</tr></thead><tbody>';

  // 100개 미만일 때는 전체 표시, 100개 이상일 때는 100개만 표시
  const maxRows = items.length < 100 ? items.length : 100;
  const displayItems = items.slice(0, maxRows);
  
  displayItems.forEach((item) => {
    if (!item || typeof item !== 'object') {
      return;
    }
    
    html += '<tr>';
    displayFields.forEach(field => {
      let value = item[field.key];
      let cellStyle = '';
      
      if (value === null || value === undefined || value === '') {
        value = '-';
      } else {
        // 대비는 +, - 기호와 색상 적용
        if (field.key === 'CMPPREVDD_IDX') {
          const numValue = parseFloat(value);
          if (!isNaN(numValue)) {
            if (numValue > 0) {
              value = '+' + numValue.toLocaleString('ko-KR');
              cellStyle = 'color: #e74c3c; font-weight: 600;'; // 빨간색
            } else if (numValue < 0) {
              value = numValue.toLocaleString('ko-KR'); // 이미 마이너스 포함
              cellStyle = 'color: #3498db; font-weight: 600;'; // 파란색
            } else {
              value = numValue.toLocaleString('ko-KR');
            }
          }
        } else if (['CLSPRC_IDX', 'OPNPRC_IDX', 'HGPRC_IDX', 'LWPRC_IDX', 'ACC_TRDVOL', 'MKTCAP'].includes(field.key)) {
          const numValue = parseFloat(value);
          if (!isNaN(numValue)) {
            value = numValue.toLocaleString('ko-KR');
          }
        }
        
        // 거래대금은 억원 단위로 표시 (천단위 콤마 포함)
        if (field.key === 'ACC_TRDVAL') {
          const numValue = parseFloat(value);
          if (!isNaN(numValue)) {
            const eokValue = (numValue / 100000000).toFixed(2);
            value = parseFloat(eokValue).toLocaleString('ko-KR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '억원';
          }
        }
        
        // 등락률은 +, - 기호와 색상 적용
        if (field.key === 'FLUC_RT') {
          const numValue = parseFloat(value);
          if (!isNaN(numValue)) {
            if (numValue > 0) {
              value = '+' + numValue.toFixed(2) + '%';
              cellStyle = 'color: #e74c3c; font-weight: 600;'; // 빨간색
            } else if (numValue < 0) {
              value = numValue.toFixed(2) + '%'; // 이미 마이너스 포함
              cellStyle = 'color: #3498db; font-weight: 600;'; // 파란색
            } else {
              value = numValue.toFixed(2) + '%';
            }
          }
        }
      }
      
      if (cellStyle) {
        html += `<td style="${cellStyle}">${escapeHtml(String(value))}</td>`;
      } else {
        html += `<td>${escapeHtml(String(value))}</td>`;
      }
    });
    html += '</tr>';
  });

  html += '</tbody></table>';
  
  // 100개 이상일 때만 제한 메시지 표시
  if (items.length >= 100) {
    html += `<div class="info-message" style="margin-top: 10px; color: #666;">
      총 ${items.length}개의 데이터 중 ${maxRows}개만 표시됩니다.
    </div>`;
  }
  
  return html;
}

// 코스피 지수 데이터를 테이블로 변환
function jsonToKospiTable(data) {
  try {
    let items = [];

    if (Array.isArray(data)) {
      items = data;
    } else if (data && typeof data === 'object') {
      if (data.OutBlock_1) {
        items = Array.isArray(data.OutBlock_1) ? data.OutBlock_1 : [data.OutBlock_1];
      } else if (data.items) {
        items = Array.isArray(data.items) ? data.items : [data.items];
      } else if (data.data) {
        items = Array.isArray(data.data) ? data.data : [data.data];
      } else {
        items = [data];
      }
    } else {
      return '<div class="empty-message">데이터 구조를 인식할 수 없습니다.</div>';
    }

    if (!items || items.length === 0) {
      return '<div class="empty-message">데이터가 없습니다.</div>';
    }

    return createIndexTable(items);
  } catch (error) {
    return `<div class="error">데이터 파싱 오류: ${error.message}</div>`;
  }
}

// ETF 데이터를 테이블로 변환
function jsonToEtfTable(data) {
  try {
    let items = [];

    if (Array.isArray(data)) {
      items = data;
    } else if (data && typeof data === 'object') {
      if (data.OutBlock_1) {
        items = Array.isArray(data.OutBlock_1) ? data.OutBlock_1 : [data.OutBlock_1];
      } else if (data.items) {
        items = Array.isArray(data.items) ? data.items : [data.items];
      } else if (data.data) {
        items = Array.isArray(data.data) ? data.data : [data.data];
      } else {
        items = [data];
      }
    } else {
      return '<div class="empty-message">데이터 구조를 인식할 수 없습니다.</div>';
    }

    if (!items || items.length === 0) {
      return '<div class="empty-message">데이터가 없습니다.</div>';
    }

    return createEtfTable(items);
  } catch (error) {
    return `<div class="error">데이터 파싱 오류: ${error.message}</div>`;
  }
}

// ETF 테이블 생성 함수
function createEtfTable(items) {
  if (!items || !Array.isArray(items) || items.length === 0) {
    return '<div class="empty-message">데이터가 없습니다.</div>';
  }

  const displayFields = [
    { key: 'BAS_DD', label: '기준일자' },
    { key: 'ISU_SRT_CD', label: '종목코드' },
    { key: 'ISU_ABBRV', label: 'ETF명' },
    { key: 'CLSPRC', label: '종가' },
    { key: 'CMPPREVDD_PRC', label: '대비' },
    { key: 'FLUC_RT', label: '등락률(%)' },
    { key: 'OPNPRC', label: '시가' },
    { key: 'HGPRC', label: '고가' },
    { key: 'LWPRC', label: '저가' },
    { key: 'ACC_TRDVOL', label: '거래량' },
    { key: 'ACC_TRDVAL', label: '거래대금' },
    { key: 'MKTCAP', label: '시가총액' }
  ];

  let html = '<table class="data-table"><thead><tr>';
  displayFields.forEach(field => {
    html += `<th>${field.label}</th>`;
  });
  html += '</tr></thead><tbody>';

  // 100개 미만일 때는 전체 표시, 100개 이상일 때는 100개만 표시
  const maxRows = items.length < 100 ? items.length : 100;
  const displayItems = items.slice(0, maxRows);

  displayItems.forEach((item) => {
    if (!item || typeof item !== 'object') {
      return;
    }

    html += '<tr>';
    displayFields.forEach(field => {
      let value = item[field.key];
      let cellStyle = '';

      if (value === null || value === undefined || value === '') {
        value = '-';
      } else {
        // 대비는 +, - 기호와 색상 적용
        if (field.key === 'CMPPREVDD_PRC') {
          const numValue = parseFloat(value);
          if (!isNaN(numValue)) {
            if (numValue > 0) {
              value = '+' + numValue.toLocaleString('ko-KR');
              cellStyle = 'color: #e74c3c; font-weight: 600;'; // 빨간색
            } else if (numValue < 0) {
              value = numValue.toLocaleString('ko-KR'); // 이미 마이너스 포함
              cellStyle = 'color: #3498db; font-weight: 600;'; // 파란색
            } else {
              value = numValue.toLocaleString('ko-KR');
            }
          }
        } else if (['CLSPRC', 'OPNPRC', 'HGPRC', 'LWPRC', 'ACC_TRDVOL', 'MKTCAP'].includes(field.key)) {
          const numValue = parseFloat(value);
          if (!isNaN(numValue)) {
            value = numValue.toLocaleString('ko-KR');
          }
        }

        // 거래대금은 억원 단위로 표시 (천단위 콤마 포함)
        if (field.key === 'ACC_TRDVAL') {
          const numValue = parseFloat(value);
          if (!isNaN(numValue)) {
            const eokValue = (numValue / 100000000).toFixed(2);
            value = parseFloat(eokValue).toLocaleString('ko-KR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '억원';
          }
        }

        // 등락률은 +, - 기호와 색상 적용
        if (field.key === 'FLUC_RT') {
          const numValue = parseFloat(value);
          if (!isNaN(numValue)) {
            if (numValue > 0) {
              value = '+' + numValue.toFixed(2) + '%';
              cellStyle = 'color: #e74c3c; font-weight: 600;'; // 빨간색
            } else if (numValue < 0) {
              value = numValue.toFixed(2) + '%'; // 이미 마이너스 포함
              cellStyle = 'color: #3498db; font-weight: 600;'; // 파란색
            } else {
              value = numValue.toFixed(2) + '%';
            }
          }
        }
      }

      if (cellStyle) {
        html += `<td style="${cellStyle}">${escapeHtml(String(value))}</td>`;
      } else {
        html += `<td>${escapeHtml(String(value))}</td>`;
      }
    });
    html += '</tr>';
  });

  html += '</tbody></table>';

  // 100개 이상일 때만 제한 메시지 표시
  if (items.length >= 100) {
    html += `<div class="info-message" style="margin-top: 10px; color: #666;">
      총 ${items.length}개의 데이터 중 ${maxRows}개만 표시됩니다.
    </div>`;
  }

  return html;
}

// 페이지 로드 시 초기 데이터 자동 로드
document.addEventListener('DOMContentLoaded', function() {
  // 코스피 데이터 자동 로드
  fetchKospiIndex();
});

