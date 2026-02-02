// 금융위원회 데이터 관련 JavaScript

// HTML 이스케이프
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// 컬럼명 포맷팅 (한글 변환)
function formatColumnName(key) {
  const columnMap = {
    // 금융위원회 주식시세정보 필드
    'basDt': '기준일자',
    'srtnCd': '단축코드',
    'isinCd': 'ISIN코드',
    'itmsNm': '종목명',
    'mrktCtg': '시장구분',
    'clpr': '종가',
    'vs': '대비',
    'fltRt': '등락율(%)',
    'mkp': '시가',
    'hipr': '고가',
    'lopr': '저가',
    'trqu': '거래량',
    'trPrc': '거래대금',
    'lstgStCnt': '상장주식수',
    'mrktTotAmt': '시가총액',
    // 기업정보 필드
    'corpNm': '법인명',
    'corpEngNm': '법인영문명',
    'enpRprFnm': '대표자명',
    'corpCls': '법인구분',
    'jurirNo': '법인등록번호',
    'bizrNo': '사업자등록번호',
    'adres': '주소',
    'hmUrl': '홈페이지',
    'enpPbanCmpyNm': '상장회사명',
    'enpEstbDt': '설립일자',
    'enpXchgLstgDt': '거래소상장일자',
    'enpXchgLstgAbolDt': '거래소상장폐지일자',
    'enpKoscLstgDt': '코스닥상장일자',
    'enpKoscLstgAbolDt': '코스닥상장폐지일자',
    'enpKosdaqLstgDt': '코스닥상장일자',
    'enpKosdaqLstgAbolDt': '코스닥상장폐지일자',
    'enpKrxLstgDt': 'KRX상장일자',
    'enpKrxLstgAbolDt': 'KRX상장폐지일자',
    'smenpYn': '중소기업여부',
    'enpMntrBnkNm': '주거래은행명',
    'enpEmpeCnt': '종업원수',
    'empeAvgCnwkTermCtt': '종업원평균근속년수',
    'enpBzC': '업종코드',
    'enpBzNm': '업종명',
    // 재무제표 필드
    'bizYear': '사업연도',
    'fnclDcd': '재무제표구분',
    'fnclDcdNm': '재무제표구분명',
    'enpSzNm': '기업규모명',
    'accnutFcltyTpcd': '회계기준유형코드',
    'accnutFcltyTpcdNm': '회계기준유형명',
    'accnutOblgPfmcRlncd': '회계의무수행관련코드',
    'accnutOblgPfmcRlncdNm': '회계의무수행관련명',
    'frmNm': '계정과목명',
    'amt': '금액',
    'frmCd': '계정과목코드',
    // 기존 필드
    'BAS_DD': '기준일자',
    'IDX_NM': '지수명',
    'CLSPRC_IDX': '종가',
    'CMPPREVDD_IDX': '대비',
    'FLUC_RT': '등락률(%)',
    'OPNPRC_IDX': '시가',
    'HGPRC_IDX': '고가',
    'LWPRC_IDX': '저가',
    'ACC_TRDVOL': '거래량',
    'ACC_TRDVAL': '거래대금',
    'MKTCAP': '상장시가총액',
    // 권리행사사유별일정조회 (API-OA-20.1)
    'basDt': '기준일자',
    'issuCmpyKsdCustNo': '발행회사한국예탁결제원고객번호',
    'stckIssuCmpyNm': '주식발행회사명',
    'crno': '법인등록번호',
    'scrsIssuMnbdCd': '유가증권발행주체코드',
    'scrsIssuMnbdCdNm': '유가증권발행주체코드명',
    'stckIssuRcd': '주식발행사유코드',
    'stckIssuRcdNm': '주식발행사유코드명',
    'rgtExertRcd': '권리행사사유코드',
    'rgtExertRcdNm': '권리행사사유코드명',
    'rgtExertSttgDt': '권리행사시작일자',
    'rgtExertEdDt': '권리행사종료일자',
    'trsnmDptyDcd': '명의개서대리인구분코드',
    'trsnmDptyDcdNm': '명의개서대리인구분코드명',
    'stckParPrc': '주식액면가',
    'stckStacMd': '주식결산월일',
    'nmlsLckSttgDt': '명부폐쇄시작일자',
    'nmlsLckEdDt': '명부폐쇄종료일자',
    // 현금흐름표 활동별 필드
    'acitId': '활동ID',
    'acitNm': '활동명',
    'thqrAcitAmt': '당기 활동 금액',
    'crtmAcitAmt': '당기 활동 금액',
    'lsqtAcitAmt': '전기 활동 금액',
    'pvtrAcitAmt': '전년 동기 활동 금액',
    'bpvtrAcitAmt': '전년 동기 전 활동 금액',
    'curCd': '통화 코드',
    // 재무제표 추가 필드
    'npSaleAmt': '순매출액',
    'enpBzopPft': '기업 영업이익',
    'iclsPalClcAmt': '포괄손익계산 금액',
    'enpCrtmNpf': '기업 당기 순이익',
    'enpTastAmt': '기업 총자산 금액',
    'enpTdbtAmt': '기업 총부채 금액',
    'enpTcptAmt': '기업 총자본 금액',
    'enpCptlAmt': '기업 자본금액',
    'fnclDebtRto': '재무 부채비율'
  };
  return columnMap[key] || key;
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
    case 'mktcap':
      fetchMktcapData();
      break;
    case 'rising-stocks':
      fetchRisingStocksData();
      break;
    case 'right-schedule':
      // 주식권리일정정보: 조회 버튼으로 수동 조회
      break;
    case 'fina-stat':
      // 재무제표: 조회 버튼으로 수동 조회
      break;
    case 'corp-info':
      // 기업정보는 수동 조회
      break;
    case 'financial':
      // 재무제표는 수동 조회
      break;
  }
}

// JSON 데이터를 테이블로 변환 (필터링 옵션 포함)
function jsonToTable(data, options = {}) {
  try {
    // API 응답 구조에 따라 items 추출
    let items = [];
    
    if (data.response && data.response.body && data.response.body.items) {
      const itemsObj = data.response.body.items;
      if (itemsObj.item) {
        items = Array.isArray(itemsObj.item) ? itemsObj.item : [itemsObj.item];
      }
    } else if (Array.isArray(data)) {
      items = data;
    } else if (data.items) {
      items = Array.isArray(data.items) ? data.items : [data.items];
    }

    if (!items || items.length === 0) {
      return '<div class="empty-message">데이터가 없습니다.</div>';
    }

    // 필터링 옵션 적용
    if (options.filterFlucRt !== undefined) {
      items = items.filter(item => {
        const flucRt = parseFloat(item.fltRt || item.FLUC_RT || item.fluc_rt || 0);
        return flucRt >= options.filterFlucRt;
      });
    }

    if (options.filterMktcap !== undefined) {
      items = items.filter(item => {
        const mktcap = parseFloat(item.mrktTotAmt || item.MKTCAP || item.mktcap || 0);
        return mktcap >= options.filterMktcap;
      });
    }

    // 첫 번째 아이템에서 모든 키 추출
    const allKeys = new Set();
    items.forEach(item => {
      if (typeof item === 'object' && item !== null) {
        Object.keys(item).forEach(key => allKeys.add(key));
      }
    });

    const columns = Array.from(allKeys);

    // 테이블 생성
    let html = '<table class="data-table"><thead><tr>';
    
    // 헤더
    columns.forEach(key => {
      html += `<th>${formatColumnName(key)}</th>`;
    });
    html += '</tr></thead><tbody>';

    // 데이터 행
    items.forEach(item => {
      html += '<tr>';
      columns.forEach(key => {
        let value = item[key] !== null && item[key] !== undefined ? item[key] : '-';
        let cellStyle = '';
        
        // 등락율 색상 적용 (상승: 빨간색, 하락: 파란색)
        if ((key === 'fltRt' || key === 'FLUC_RT' || key === 'fluc_rt') && value !== '-') {
          const numValue = parseFloat(value);
          if (!isNaN(numValue)) {
            value = numValue.toFixed(2) + '%';
            if (numValue > 0) {
              cellStyle = 'color: #e74c3c; font-weight: 600;'; // 빨간색 (상승)
            } else if (numValue < 0) {
              cellStyle = 'color: #3498db; font-weight: 600;'; // 파란색 (하락)
            }
          }
        }
        
        // 금액 필드 억원 단위로 변환 (천 단위 구분자 포함)
        const amountFields = ['clpr', 'vs', 'mkp', 'hipr', 'lopr', 'trPrc', 'mrktTotAmt', 
                              'CLSPRC_IDX', 'CMPPREVDD_IDX', 'OPNPRC_IDX', 'HGPRC_IDX', 
                              'LWPRC_IDX', 'ACC_TRDVAL', 'MKTCAP',
                              'thqrAcitAmt', 'crtmAcitAmt', 'lsqtAcitAmt', 'pvtrAcitAmt', 'bpvtrAcitAmt',
                              'amt', 'npSaleAmt', 'enpBzopPft', 'iclsPalClcAmt', 'enpCrtmNpf', 
                              'enpTastAmt', 'enpTdbtAmt', 'enpTcptAmt', 'enpCptlAmt', 'fnclDebtRto']; // 재무제표 금액 필드 포함
        if (amountFields.includes(key) && value !== '-') {
          const numValue = parseFloat(value);
          if (!isNaN(numValue) && numValue !== 0) {
            // 현금흐름표 활동 금액 필드는 항상 억원 단위로 표시
            if (key === 'thqrAcitAmt' || key === 'crtmAcitAmt' || key === 'lsqtAcitAmt' || 
                key === 'pvtrAcitAmt' || key === 'bpvtrAcitAmt') {
              const eokValue = numValue / 100000000;
              value = eokValue.toLocaleString('ko-KR', { 
                minimumFractionDigits: 2, 
                maximumFractionDigits: 2 
              }) + '억원';
            }
            // 시가총액, 거래대금은 억원 단위
            else if (key === 'mrktTotAmt' || key === 'trPrc' || key === 'MKTCAP' || key === 'ACC_TRDVAL') {
              const eokValue = numValue / 100000000;
              value = eokValue.toLocaleString('ko-KR', { 
                minimumFractionDigits: 2, 
                maximumFractionDigits: 2 
              }) + '억원';
            }
            // 재무제표 금액 필드들(amt, npSaleAmt, enpBzopPft 등)은 억원 단위로 표시
            else if (key === 'amt' || key === 'npSaleAmt' || key === 'enpBzopPft' || 
                     key === 'iclsPalClcAmt' || key === 'enpCrtmNpf' || key === 'enpTastAmt' || 
                     key === 'enpTdbtAmt' || key === 'enpTcptAmt' || key === 'enpCptlAmt' || 
                     key === 'fnclDebtRto') {
              const eokValue = numValue / 100000000;
              value = eokValue.toLocaleString('ko-KR', { 
                minimumFractionDigits: 2, 
                maximumFractionDigits: 2 
              }) + '억원';
            }
            // 종가, 대비, 시가, 고가, 저가는 원 단위로 표시하거나 억원 단위로 변환
            else {
              if (numValue >= 100000000) {
                const eokValue = numValue / 100000000;
                value = eokValue.toLocaleString('ko-KR', { 
                  minimumFractionDigits: 2, 
                  maximumFractionDigits: 2 
                }) + '억원';
              } else {
                value = numValue.toLocaleString('ko-KR') + '원';
              }
            }
          }
        }
        
        // 거래량 천단위 콤마
        if ((key === 'trqu' || key === 'ACC_TRDVOL') && value !== '-') {
          const numValue = parseFloat(value);
          if (!isNaN(numValue)) {
            value = numValue.toLocaleString('ko-KR');
          }
        }
        
        // 상장주식수 천단위 콤마
        if (key === 'lstgStCnt' && value !== '-') {
          const numValue = parseFloat(value);
          if (!isNaN(numValue)) {
            value = numValue.toLocaleString('ko-KR');
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
    
    // 필터링 정보 표시
    if (options.filterFlucRt !== undefined || options.filterMktcap !== undefined) {
      let filterInfo = [];
      if (options.filterFlucRt !== undefined) {
        filterInfo.push(`등락률 ${options.filterFlucRt}% 이상`);
      }
      if (options.filterMktcap !== undefined) {
        filterInfo.push(`시가총액 ${(options.filterMktcap / 100000000).toFixed(0)}억원 이상`);
      }
      html += `<div class="info-message" style="margin-top: 10px; color: #666; padding: 10px; background: #f8f9fa; border-radius: 4px;">
        필터: ${filterInfo.join(', ')} | 총 ${items.length}개 항목
      </div>`;
    }
    
    return html;

  } catch (error) {
    return `<div class="error">데이터 파싱 오류: ${error.message}</div>`;
  }
}

// 날짜 포맷팅
function formatFscDate(dateStr) {
  if (!dateStr || dateStr.length !== 8) return dateStr;
  return `${dateStr.substring(0,4)}년 ${parseInt(dateStr.substring(4,6))}월 ${parseInt(dateStr.substring(6,8))}일`;
}

// 아코디언 토글
function toggleFscAccordion(itemId) {
  const item = document.getElementById(itemId);
  if (!item) return;
  
  const header = item.querySelector('.accordion-header');
  const content = item.querySelector('.accordion-content');
  
  if (!header || !content) return;
  
  const isActive = header.classList.contains('active');
  
  // 모든 아코디언 닫기
  document.querySelectorAll('.accordion-item').forEach(accItem => {
    const accHeader = accItem.querySelector('.accordion-header');
    const accContent = accItem.querySelector('.accordion-content');
    const accIcon = accItem.querySelector('.accordion-icon');
    if (accHeader && accContent) {
      accHeader.classList.remove('active');
      accContent.classList.remove('active');
      if (accIcon) accIcon.textContent = '▼';
    }
  });
  
  // 클릭한 항목만 열기/닫기
  if (!isActive) {
    header.classList.add('active');
    content.classList.add('active');
    const icon = header.querySelector('.accordion-icon');
    if (icon) icon.textContent = '▲';
    
    // 데이터 로드 (아직 로드되지 않은 경우)
    const body = content.querySelector('.accordion-body');
    if (body && body.dataset.loaded !== 'true') {
      loadFscDateData(body);
    }
  }
}

// 특정 날짜의 데이터 로드 (코스피/코스닥 구분)
async function loadFscDateData(bodyElement) {
  const basDt = bodyElement.dataset.basDt;
  if (!basDt) return;
  
  bodyElement.innerHTML = '<div class="loading">데이터를 불러오는 중...</div>';
  
  try {
    // 코스피와 코스닥을 각각 가져오기
    const [kospiResponse, kosdaqResponse] = await Promise.all([
      fetch(`/api/stock-price?bas_dt=${basDt}&num_of_rows=200&mrkt_ctg=KOSPI`),
      fetch(`/api/stock-price?bas_dt=${basDt}&num_of_rows=200&mrkt_ctg=KOSDAQ`)
    ]);
    
    const kospiResult = await kospiResponse.json();
    const kosdaqResult = await kosdaqResponse.json();
    
    const formattedDate = formatFscDate(basDt);
    let html = `<div style="margin-bottom: 15px; padding: 10px; background: #e8f4fd; border-radius: 4px; color: #2980b9; font-weight: 500;">
      📅 데이터 기준일자: ${formattedDate}
    </div>`;
    
    html += '<div class="accordion">';
    
    // 코스피 아코디언
    if (kospiResponse.ok && kospiResult.data && kospiResult.data.length > 0) {
      html += `
        <div class="accordion-item" id="accordion-kospi-${basDt}">
          <div class="accordion-header" onclick="toggleMarketAccordion('accordion-kospi-${basDt}')">
            <div class="accordion-title">💹 코스피 200 (${kospiResult.count || kospiResult.data.length}건)</div>
            <div class="accordion-icon">▼</div>
          </div>
          <div class="accordion-content">
            <div class="accordion-body">
              ${jsonToTable(kospiResult.data)}
            </div>
          </div>
        </div>
      `;
    }
    
    // 코스닥 아코디언
    if (kosdaqResponse.ok && kosdaqResult.data && kosdaqResult.data.length > 0) {
      html += `
        <div class="accordion-item" id="accordion-kosdaq-${basDt}">
          <div class="accordion-header" onclick="toggleMarketAccordion('accordion-kosdaq-${basDt}')">
            <div class="accordion-title">🚀 코스닥 200 (${kosdaqResult.count || kosdaqResult.data.length}건)</div>
            <div class="accordion-icon">▼</div>
          </div>
          <div class="accordion-content">
            <div class="accordion-body">
              ${jsonToTable(kosdaqResult.data)}
            </div>
          </div>
        </div>
      `;
    }
    
    html += '</div>';
    bodyElement.innerHTML = html;
    bodyElement.dataset.loaded = 'true';
    
    // 첫 번째 항목 자동 열기
    if (kospiResponse.ok && kospiResult.data && kospiResult.data.length > 0) {
      setTimeout(() => {
        toggleMarketAccordion(`accordion-kospi-${basDt}`);
      }, 200);
    } else if (kosdaqResponse.ok && kosdaqResult.data && kosdaqResult.data.length > 0) {
      setTimeout(() => {
        toggleMarketAccordion(`accordion-kosdaq-${basDt}`);
      }, 200);
    }
  } catch (error) {
    bodyElement.innerHTML = `<div class="error">오류 발생: ${error.message}</div>`;
  }
}

// 코스피/코스닥 아코디언 토글
function toggleMarketAccordion(itemId) {
  const item = document.getElementById(itemId);
  if (!item) return;
  
  const header = item.querySelector('.accordion-header');
  const content = item.querySelector('.accordion-content');
  
  if (!header || !content) return;
  
  const isActive = header.classList.contains('active');
  
  // 토글
  if (!isActive) {
    header.classList.add('active');
    content.classList.add('active');
    const icon = header.querySelector('.accordion-icon');
    if (icon) icon.textContent = '▲';
  } else {
    header.classList.remove('active');
    content.classList.remove('active');
    const icon = header.querySelector('.accordion-icon');
    if (icon) icon.textContent = '▼';
  }
}

// 아코디언 빌드
async function buildFscAccordion() {
  const container = document.getElementById('mktcap-data');
  if (!container) {
    console.error('❌ mktcap-data 요소를 찾을 수 없습니다.');
    return;
  }
  
  container.innerHTML = '<div class="loading">데이터를 불러오는 중...</div>';
  
  try {
    // 먼저 날짜 목록 조회
    const datesResponse = await fetch('/api/fsc-dates');
    const datesResult = await datesResponse.json();
    
    // DB에 날짜가 없으면 API에서 바로 가져와서 표시 (아코디언 없이)
    if (!datesResponse.ok || !datesResult.dates || datesResult.dates.length === 0) {
      // 코스피와 코스닥을 각각 가져오기
      const [kospiResponse, kosdaqResponse] = await Promise.all([
        fetch('/api/stock-price?num_of_rows=200&mrkt_ctg=KOSPI'),
        fetch('/api/stock-price?num_of_rows=200&mrkt_ctg=KOSDAQ')
      ]);
      
      const kospiResult = await kospiResponse.json();
      const kosdaqResult = await kosdaqResponse.json();
      
      if ((kospiResponse.ok && kospiResult.data && kospiResult.data.length > 0) || 
          (kosdaqResponse.ok && kosdaqResult.data && kosdaqResult.data.length > 0)) {
        const basDt = kospiResult.bas_dt || kosdaqResult.bas_dt;
        const dateStr = formatFscDate(basDt);
        
        let html = `<div style="margin-bottom: 15px; padding: 10px; background: #e8f4fd; border-radius: 4px; color: #2980b9; font-weight: 500;">
          📅 데이터 기준일자: ${dateStr}
        </div>`;
        
        html += '<div class="accordion">';
        
        // 코스피 아코디언
        if (kospiResponse.ok && kospiResult.data && kospiResult.data.length > 0) {
          html += `
            <div class="accordion-item" id="accordion-kospi-${basDt}">
              <div class="accordion-header" onclick="toggleMarketAccordion('accordion-kospi-${basDt}')">
                <div class="accordion-title">💹 코스피 200 (${kospiResult.count}건)</div>
                <div class="accordion-icon">▼</div>
              </div>
              <div class="accordion-content">
                <div class="accordion-body">
                  ${jsonToTable(kospiResult.data)}
                </div>
              </div>
            </div>
          `;
        }
        
        // 코스닥 아코디언
        if (kosdaqResponse.ok && kosdaqResult.data && kosdaqResult.data.length > 0) {
          html += `
            <div class="accordion-item" id="accordion-kosdaq-${basDt}">
              <div class="accordion-header" onclick="toggleMarketAccordion('accordion-kosdaq-${basDt}')">
                <div class="accordion-title">🚀 코스닥 200 (${kosdaqResult.count}건)</div>
                <div class="accordion-icon">▼</div>
              </div>
              <div class="accordion-content">
                <div class="accordion-body">
                  ${jsonToTable(kosdaqResult.data)}
                </div>
              </div>
            </div>
          `;
        }
        
        html += '</div>';
        container.innerHTML = html;
        
        // 첫 번째 항목 자동 열기
        if (kospiResponse.ok && kospiResult.data && kospiResult.data.length > 0) {
          setTimeout(() => {
            toggleMarketAccordion(`accordion-kospi-${basDt}`);
          }, 200);
        } else if (kosdaqResponse.ok && kosdaqResult.data && kosdaqResult.data.length > 0) {
          setTimeout(() => {
            toggleMarketAccordion(`accordion-kosdaq-${basDt}`);
          }, 200);
        }
        return;
      }
      
      container.innerHTML = '<div class="empty-message">데이터를 찾을 수 없습니다.</div>';
      return;
    }
    
    // DB에 날짜가 있으면 아코디언으로 표시
    let html = '<div class="accordion">';
    datesResult.dates.forEach((basDt) => {
      const dateStr = formatFscDate(basDt);
      const itemId = `accordion-fsc-${basDt}`;
      html += `
        <div class="accordion-item" id="${itemId}">
          <div class="accordion-header" onclick="toggleFscAccordion('${itemId}')">
            <div class="accordion-title">${dateStr}</div>
            <div class="accordion-icon">▼</div>
          </div>
          <div class="accordion-content">
            <div class="accordion-body" data-bas-dt="${basDt}">
              <div class="loading">상세 정보를 불러오는 중...</div>
            </div>
          </div>
        </div>
      `;
    });
    html += '</div>';
    
    container.innerHTML = html;
    
    // 첫 번째 항목 자동 열기
    if (datesResult.dates.length > 0) {
      const firstItemId = `accordion-fsc-${datesResult.dates[0]}`;
      setTimeout(() => {
        toggleFscAccordion(firstItemId);
      }, 200);
    }
  } catch (error) {
    console.error('❌ buildFscAccordion 오류:', error);
    container.innerHTML = `<div class="error">오류 발생: ${error.message}</div>`;
  }
}

// 시가총액 상위 200종목 조회 (아코디언 형태)
async function fetchMktcapData() {
  await buildFscAccordion();
}

// 상승종목 아코디언 빌드 (별도 테이블 fsc_rising_stock에서 조회)
async function buildRisingStocksAccordion() {
  const container = document.getElementById('rising-stocks-data');
  if (!container) {
    console.error('❌ rising-stocks-data 요소를 찾을 수 없습니다.');
    return;
  }

  container.innerHTML = '<div class="loading">데이터를 불러오는 중...</div>';

  try {
    // 상승종목 전용 날짜 목록 조회
    const datesResponse = await fetch('/api/fsc-rising-dates');
    const datesResult = await datesResponse.json();

    // DB에 날짜가 없으면 안내 메시지
    if (!datesResponse.ok || !datesResult.dates || datesResult.dates.length === 0) {
      container.innerHTML = '<div class="empty-message">상승종목 데이터가 없습니다. 상승종목 수집 버튼을 클릭하여 데이터를 수집해주세요.</div>';
      return;
    }

    // DB에 날짜가 있으면 아코디언으로 표시
    let html = '<div class="accordion">';
    datesResult.dates.forEach((basDt) => {
      const dateStr = formatFscDate(basDt);
      const itemId = `accordion-rising-${basDt}`;
      html += `
        <div class="accordion-item" id="${itemId}">
          <div class="accordion-header" onclick="toggleRisingStocksAccordion('${itemId}')">
            <div class="accordion-title">${dateStr}</div>
            <div class="accordion-icon">▼</div>
          </div>
          <div class="accordion-content">
            <div class="accordion-body" data-bas-dt="${basDt}">
              <div class="loading">상세 정보를 불러오는 중...</div>
            </div>
          </div>
        </div>
      `;
    });
    html += '</div>';

    container.innerHTML = html;

    // 첫 번째 항목 자동 열기
    if (datesResult.dates.length > 0) {
      const firstItemId = `accordion-rising-${datesResult.dates[0]}`;
      setTimeout(() => {
        toggleRisingStocksAccordion(firstItemId);
      }, 200);
    }
  } catch (error) {
    console.error('❌ buildRisingStocksAccordion 오류:', error);
    container.innerHTML = `<div class="error">오류 발생: ${error.message}</div>`;
  }
}

// 상승종목 아코디언 토글
function toggleRisingStocksAccordion(itemId) {
  const item = document.getElementById(itemId);
  if (!item) return;
  
  const header = item.querySelector('.accordion-header');
  const content = item.querySelector('.accordion-content');
  
  if (!header || !content) return;
  
  const isActive = header.classList.contains('active');
  
  // 모든 아코디언 닫기
  document.querySelectorAll('.accordion-item').forEach(accItem => {
    const accHeader = accItem.querySelector('.accordion-header');
    const accContent = accItem.querySelector('.accordion-content');
    const accIcon = accItem.querySelector('.accordion-icon');
    if (accHeader && accContent) {
      accHeader.classList.remove('active');
      accContent.classList.remove('active');
      if (accIcon) accIcon.textContent = '▼';
    }
  });
  
  // 클릭한 항목만 열기/닫기
  if (!isActive) {
    header.classList.add('active');
    content.classList.add('active');
    const icon = header.querySelector('.accordion-icon');
    if (icon) icon.textContent = '▲';
    
    // 데이터 로드 (아직 로드되지 않은 경우)
    const body = content.querySelector('.accordion-body');
    if (body && body.dataset.loaded !== 'true') {
      loadRisingStocksDateData(body);
    }
  }
}

// 특정 날짜의 상승종목 데이터 로드 (별도 테이블에서 조회)
async function loadRisingStocksDateData(bodyElement) {
  const basDt = bodyElement.dataset.basDt;
  if (!basDt) return;

  bodyElement.innerHTML = '<div class="loading">데이터를 불러오는 중...</div>';

  try {
    const response = await fetch(`/api/rising-stock-price?bas_dt=${basDt}&order_by=flt_rt&order_direction=desc&num_of_rows=1000`);
    const result = await response.json();
    
    if (response.ok && result.success && result.data) {
      const data = result.data;
      const count = result.count || data.length;
      const formattedDate = formatFscDate(basDt);
      
      if (data.length === 0) {
        bodyElement.innerHTML = '<div class="empty-message">해당 날짜에 상승종목 데이터가 없습니다.</div>';
        bodyElement.dataset.loaded = 'true';
        return;
      }
      
      const dateInfo = `<div style="margin-bottom: 15px; padding: 10px; background: #e8f4fd; border-radius: 4px; color: #2980b9; font-weight: 500;">
        📅 데이터 기준일자: ${formattedDate} (총 ${count}건)
      </div>`;
      
      const tableHtml = jsonToTable(data);
      bodyElement.innerHTML = dateInfo + tableHtml;
      bodyElement.dataset.loaded = 'true';
    } else {
      // 응답은 성공했지만 데이터가 없는 경우
      if (response.ok && result.success && result.data && result.data.length === 0) {
        bodyElement.innerHTML = '<div class="empty-message">해당 날짜에 상승종목 데이터가 없습니다. 상승종목 수집 버튼을 클릭하여 데이터를 수집해주세요.</div>';
        bodyElement.dataset.loaded = 'true';
      } else {
        const errorMsg = result.error || result.message || result.detail || '데이터를 불러올 수 없습니다.';
        bodyElement.innerHTML = `<div class="error">오류 발생: ${errorMsg}</div>`;
      }
    }
  } catch (error) {
    console.error('❌ loadRisingStocksDateData 오류:', error);
    bodyElement.innerHTML = `<div class="error">오류 발생: ${error.message}</div>`;
  }
}

// 상승종목 조회 (아코디언 형태)
async function fetchRisingStocksData() {
  await buildRisingStocksAccordion();
}

// 전체 FSC 데이터 삭제
async function deleteAllFscData() {
  if (!confirm('⚠️ 정말로 모든 FSC 데이터를 삭제하시겠습니까?\n\n이 작업은 되돌릴 수 없습니다.')) {
    return;
  }
  
  if (!confirm('⚠️ 다시 한번 확인합니다. 모든 데이터가 삭제됩니다. 계속하시겠습니까?')) {
    return;
  }
  
  // 모든 삭제 버튼 찾기
  const btn1 = document.getElementById('btn-delete-all-data');
  const btn2 = document.getElementById('btn-delete-all-data-mktcap');
  const btn = btn1 || btn2;
  
  if (!btn) return;
  
  const originalText = btn.textContent;
  btn.disabled = true;
  if (btn1) btn1.textContent = '⏳ 삭제 중...';
  if (btn2) btn2.textContent = '⏳ 삭제 중...';
  
  try {
    const response = await fetch('/api/fsc-delete-all-data', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    const result = await response.json();
    
    if (response.ok && result.success) {
      alert(`✅ ${result.message}`);
      // 데이터 새로고침
      await fetchRisingStocksData();
      await fetchMktcapData();
    } else {
      alert(`❌ 삭제 실패: ${result.error || '알 수 없는 오류'}`);
    }
  } catch (error) {
    console.error('❌ 데이터 삭제 오류:', error);
    alert(`❌ 데이터 삭제 중 오류가 발생했습니다: ${error.message}`);
  } finally {
    if (btn1) {
      btn1.disabled = false;
      btn1.textContent = originalText;
    }
    if (btn2) {
      btn2.disabled = false;
      btn2.textContent = originalText;
    }
  }
}

// 권리행사사유별일정조회 (API-OA-20.1) - 회사명 또는 법인등록번호, 전체 호출 후 최신일 20건
async function fetchRightScheduleData() {
  const container = document.getElementById('right-schedule-data');
  const btn = document.getElementById('btn-right-schedule-fetch');
  if (!container || !btn) return;

  const query = (document.getElementById('right-schedule-query') || {}).value?.trim() || null;
  if (!query) {
    container.innerHTML = '<div class="empty-message">주식발행회사명 또는 법인등록번호를 입력한 뒤 조회해 주세요.</div>';
    return;
  }

  const params = new URLSearchParams();
  params.set('page_no', '1');
  params.set('num_of_rows', '1000');
  // 숫자만 있으면 법인등록번호, 아니면 회사명
  if (/^\d+$/.test(query)) {
    params.set('crno', query);
  } else {
    params.set('stck_issu_cmpy_nm', query);
  }

  container.innerHTML = '<div class="loading">조회 중...</div>';
  btn.disabled = true;

  try {
    const response = await fetch(`/api/right-schedule?${params.toString()}`);
    const result = await response.json();

    if (response.ok && result.data !== undefined) {
      const data = result.data;
      const latestBasDt = result.latest_bas_dt;
      const totalCount = result.total_count;
      const count = result.count || data.length;

      if (!data || data.length === 0) {
        container.innerHTML = '<div class="empty-message">조회 결과가 없습니다. 회사명 또는 법인등록번호를 확인해 보세요.</div>';
      } else {
        const info = latestBasDt
          ? `최신일(${latestBasDt}) 기준 ${count}건 표시` + (totalCount != null ? ` (전체 ${totalCount}건 중)` : '')
          : `${count}건`;
        const infoHtml = `<div style="margin-bottom: 15px; padding: 10px; background: #e8f4fd; border-radius: 4px; color: #2980b9; font-weight: 500;">${info}</div>`;
        container.innerHTML = infoHtml + jsonToTable(data);
      }
    } else {
      container.innerHTML = `<div class="error">${escapeHtml(result.error || '조회에 실패했습니다.')}</div>`;
    }
  } catch (error) {
    container.innerHTML = `<div class="error">오류: ${escapeHtml(error.message)}</div>`;
  } finally {
    btn.disabled = false;
  }
}

// 재무제표 조회 (GetFinaStatInfoService_V2: 체크된 항목만 호출)
async function fetchFinaStatData() {
  const container = document.getElementById('fina-stat-data');
  const btn = document.getElementById('btn-fina-stat-fetch');
  if (!container || !btn) return;

  const crno = (document.getElementById('fina-stat-crno') || {}).value?.trim() || '';
  const bizYear = (document.getElementById('fina-stat-biz-year') || {}).value?.trim() || '';
  const types = [];
  if ((document.getElementById('fina-stat-type-summ') || {}).checked) types.push('summ');
  if ((document.getElementById('fina-stat-type-bs') || {}).checked) types.push('bs');
  if ((document.getElementById('fina-stat-type-inco') || {}).checked) types.push('inco');

  if (!crno || !bizYear) {
    container.innerHTML = '<div class="empty-message">법인등록번호와 사업연도를 입력해 주세요.</div>';
    return;
  }
  if (types.length === 0) {
    container.innerHTML = '<div class="empty-message">조회할 항목(요약재무제표, 재무상태표, 손익계산서)을 하나 이상 체크해 주세요.</div>';
    return;
  }

  const params = new URLSearchParams();
  params.set('crno', crno);
  params.set('biz_year', bizYear);
  params.set('types', types.join(','));

  container.innerHTML = '<div class="loading">조회 중...</div>';
  btn.disabled = true;

  try {
    const response = await fetch(`/api/fina-stat?${params.toString()}`);
    const result = await response.json();

    if (response.ok && result.result) {
      const labels = { summ: '요약재무제표', bs: '재무상태표', inco: '손익계산서' };
      let html = '';
      for (const key of ['summ', 'bs', 'inco']) {
        if (!result.result[key] || !result.result[key].data || result.result[key].data.length === 0) continue;
        const block = result.result[key];
        const count = block.count || block.data.length;
        html += `<div style="margin-bottom: 24px;">`;
        html += `<h4 style="color: #2c3e50; margin-bottom: 10px; padding-bottom: 6px; border-bottom: 2px solid #3498db;">${labels[key]} (${count}건)</h4>`;
        html += jsonToTable(block.data);
        html += `</div>`;
      }
      container.innerHTML = html || '<div class="empty-message">선택한 항목에 대한 데이터가 없습니다.</div>';
    } else {
      container.innerHTML = `<div class="error">${escapeHtml(result.error || '조회에 실패했습니다.')}</div>`;
    }
  } catch (error) {
    container.innerHTML = `<div class="error">오류: ${escapeHtml(error.message)}</div>`;
  } finally {
    btn.disabled = false;
  }
}

// 공시정보 타입 한글명 매핑
const disclosureTypeNames = {
  "dividend": "배당공시",
  "paid_increase": "유상증자결정공시",
  "bonus": "무상증자결정공시",
  "paid_bonus": "유무상증자결정공시",
  "shareholders": "주주총회소집공고공시"
};

// 공시정보 날짜별 데이터 로드
async function loadDisclosureDateData(bodyElement) {
  const basDt = bodyElement.dataset.basDt;
  if (!basDt) return;
  
  bodyElement.innerHTML = '<div class="loading">공시정보를 불러오는 중...</div>';
  
  try {
    console.log('📡 공시정보 로드:', basDt);
    const response = await fetch(`/api/disclosure-info-by-date?bas_dt=${basDt}`);
    const result = await response.json();
    
    console.log('📦 공시정보 응답:', result);
    
    if (response.ok && result.data) {
      const allData = result.data;
      let html = '';
      
      // 각 공시정보 타입별로 표시
      Object.keys(disclosureTypeNames).forEach(type => {
        if (allData[type] && Array.isArray(allData[type]) && allData[type].length > 0) {
          console.log(`✅ ${disclosureTypeNames[type]}: ${allData[type].length}건`);
          html += `<div style="margin-bottom: 20px;">`;
          html += `<h4 style="color: #2c3e50; margin-bottom: 10px; padding-bottom: 5px; border-bottom: 2px solid #3498db;">${disclosureTypeNames[type]}</h4>`;
          html += jsonToTable(allData[type]);
          html += `</div>`;
        }
      });
      
      if (!html) {
        console.warn('⚠️ 표시할 공시정보가 없습니다.');
        html = '<div class="empty-message">해당 날짜에 공시정보가 없습니다.</div>';
      }
      
      bodyElement.innerHTML = html;
      bodyElement.dataset.loaded = 'true';
    } else {
      console.error('❌ API 오류:', result);
      throw new Error(result.error || '공시정보를 불러올 수 없습니다.');
    }
  } catch (error) {
    console.error('❌ loadDisclosureDateData 오류:', error);
    bodyElement.innerHTML = `<div class="error">오류 발생: ${error.message}</div>`;
  }
}

// 공시정보 아코디언 빌드
async function buildDisclosureAccordion() {
  const container = document.getElementById('disclosure-data');
  if (!container) return;
  
  container.innerHTML = '<div class="loading">공시정보를 불러오는 중...</div>';
  
  try {
    // 최근 7일간의 공시정보 날짜 수집
    const today = new Date();
    const dates = [];
    
    // 최근 7일간 날짜 생성
    for (let i = 0; i < 7; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const dateStr = `${year}${month}${day}`;
      dates.push(dateStr);
    }
    
    console.log('📅 확인할 날짜 목록:', dates);
    
    // 각 날짜별로 공시정보 확인
    const datesWithData = [];
    for (const basDt of dates) {
      try {
        const response = await fetch(`/api/disclosure-info-by-date?bas_dt=${basDt}`);
        const result = await response.json();
        
        console.log(`📊 ${basDt} 응답:`, result);
        
        if (response.ok && result.data) {
          const hasData = Object.values(result.data).some(arr => arr && arr.length > 0);
          console.log(`✅ ${basDt} 데이터 존재:`, hasData);
          if (hasData) {
            datesWithData.push(basDt);
          }
        }
      } catch (error) {
        console.error(`❌ ${basDt} 조회 오류:`, error);
      }
    }
    
    console.log('📋 데이터가 있는 날짜:', datesWithData);
    
    if (datesWithData.length === 0) {
      container.innerHTML = '<div class="empty-message">최근 7일간 공시정보가 없습니다.</div>';
      return;
    }
    
    // 아코디언 HTML 생성
    let html = '<div class="accordion">';
    datesWithData.forEach((basDt) => {
      const dateStr = formatFscDate(basDt);
      const itemId = `accordion-disclosure-${basDt}`;
      html += `
        <div class="accordion-item" id="${itemId}">
          <div class="accordion-header" onclick="toggleDisclosureAccordion('${itemId}')">
            <div class="accordion-title">${dateStr}</div>
            <div class="accordion-icon">▼</div>
          </div>
          <div class="accordion-content">
            <div class="accordion-body" data-bas-dt="${basDt}">
              <div class="loading">공시정보를 불러오는 중...</div>
            </div>
          </div>
        </div>
      `;
    });
    html += '</div>';
    
    container.innerHTML = html;
    
    // 첫 번째 항목 자동 열기
    if (datesWithData.length > 0) {
      const firstItemId = `accordion-disclosure-${datesWithData[0]}`;
      setTimeout(() => {
        toggleDisclosureAccordion(firstItemId);
      }, 200);
    }
  } catch (error) {
    console.error('❌ buildDisclosureAccordion 오류:', error);
    container.innerHTML = `<div class="error">오류 발생: ${error.message}</div>`;
  }
}

// 공시정보 아코디언 토글
function toggleDisclosureAccordion(itemId) {
  const item = document.getElementById(itemId);
  if (!item) return;
  
  const header = item.querySelector('.accordion-header');
  const content = item.querySelector('.accordion-content');
  
  if (!header || !content) return;
  
  const isActive = header.classList.contains('active');
  
  // 모든 아코디언 닫기
  document.querySelectorAll('.accordion-item').forEach(accItem => {
    const accHeader = accItem.querySelector('.accordion-header');
    const accContent = accItem.querySelector('.accordion-content');
    const accIcon = accItem.querySelector('.accordion-icon');
    if (accHeader && accContent) {
      accHeader.classList.remove('active');
      accContent.classList.remove('active');
      if (accIcon) accIcon.textContent = '▼';
    }
  });
  
  // 클릭한 항목만 열기/닫기
  if (!isActive) {
    header.classList.add('active');
    content.classList.add('active');
    const icon = header.querySelector('.accordion-icon');
    if (icon) icon.textContent = '▲';
    
    // 데이터 로드 (아직 로드되지 않은 경우)
    const body = content.querySelector('.accordion-body');
    if (body && body.dataset.loaded !== 'true') {
      loadDisclosureDateData(body);
    }
  }
}

// 공시정보 조회
async function fetchDisclosureInfo() {
  await buildDisclosureAccordion();
}


// 수동 데이터 수집 (시가총액 상위 200종목)
async function collectMktcapData() {
  const btn = document.getElementById('btn-mktcap-collect');
  const container = document.getElementById('mktcap-data');
  if (!btn) return;
  
  const originalText = btn.textContent;
  btn.disabled = true;
  btn.textContent = '⏳ 수집 중...';
  
  if (container) {
    container.innerHTML = '<div class="loading">시가총액 데이터를 수집하는 중...</div>';
  }
  
  try {
    const response = await fetch('/api/fsc-collect-manual', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    const result = await response.json();
    
    if (response.ok && result.success) {
      alert('✅ 시가총액 데이터 수집이 완료되었습니다.');
      // 데이터 새로고침
      await fetchMktcapData();
    } else {
      alert(`❌ 데이터 수집 실패: ${result.error || '알 수 없는 오류'}`);
    }
  } catch (error) {
    console.error('❌ 시가총액 데이터 수집 오류:', error);
    alert(`❌ 데이터 수집 중 오류가 발생했습니다: ${error.message}`);
  } finally {
    btn.disabled = false;
    btn.textContent = originalText;
  }
}

// 수동 데이터 수집 (기존 함수 유지 - 호환성)
async function manualCollectData() {
  await collectMktcapData();
}

// 상승종목 수집
async function collectRisingStocks() {
  const btn = document.getElementById('btn-rising-stocks-collect');
  const container = document.getElementById('rising-stocks-data');
  if (!btn || !container) return;
  
  const originalText = btn.textContent;
  btn.disabled = true;
  btn.textContent = '⏳ 수집 중...';
  container.innerHTML = '<div class="loading">상승종목을 수집하는 중...</div>';
  
  try {
    const response = await fetch('/api/fsc-collect-rising-stocks', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    const result = await response.json();
    
    if (response.ok && result.success) {
      container.innerHTML = `<div style="margin-bottom: 15px; padding: 15px; background: #d4edda; border-radius: 4px; color: #155724; font-weight: 500;">
        ✅ ${result.message}
      </div>`;
      
      // 수집된 데이터 표시
      if (result.count > 0) {
        // 수집된 데이터를 별도 테이블에서 조회하여 표시
        const dataResponse = await fetch(`/api/rising-stock-price?bas_dt=${result.bas_dt}&order_by=flt_rt&order_direction=desc&num_of_rows=1000`);
        const dataResult = await dataResponse.json();
        
        if (dataResponse.ok && dataResult.success && dataResult.data) {
          const tableHtml = jsonToTable(dataResult.data);
          container.innerHTML += tableHtml;
        }
      }
      
      // 데이터 새로고침
      await fetchRisingStocksData();
      
      alert('✅ 상승종목 수집이 완료되었습니다.');
    } else {
      container.innerHTML = `<div class="error">❌ 수집 실패: ${result.error || '알 수 없는 오류'}</div>`;
      alert(`❌ 상승종목 수집 실패: ${result.error || '알 수 없는 오류'}`);
    }
  } catch (error) {
    console.error('❌ 상승종목 수집 오류:', error);
    container.innerHTML = `<div class="error">❌ 오류 발생: ${error.message}</div>`;
    alert(`❌ 상승종목 수집 중 오류가 발생했습니다: ${error.message}`);
  } finally {
    btn.disabled = false;
    btn.textContent = originalText;
  }
}

// 과거 데이터 수집 (1-30일)
async function collectPastDays() {
  const btn = document.getElementById('btn-past-days-collect');
  if (!btn) return;
  
  const daysInput = document.getElementById('past-days-count');
  const typeSelect = document.getElementById('past-days-type');
  
  const days = parseInt(daysInput?.value || 30);
  const collectType = typeSelect?.value || 'mktcap';
  
  if (days < 1 || days > 30) {
    alert('1일부터 30일까지만 수집할 수 있습니다.');
    return;
  }
  
  const originalText = btn.textContent;
  btn.disabled = true;
  btn.textContent = '⏳ 수집 중...';
  
  try {
    const params = new URLSearchParams();
    params.set('days', days.toString());
    params.set('collect_type', collectType);
    
    const response = await fetch(`/api/fsc-collect-past-days?${params.toString()}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    const result = await response.json();
    
    if (response.ok && result.success) {
      const message = `${result.message}\n\n성공: ${result.total_collected}일\n실패: ${result.total_failed}일`;
      if (result.failed_dates && result.failed_dates.length > 0) {
        alert(message + `\n\n실패한 날짜: ${result.failed_dates.slice(0, 10).join(', ')}${result.failed_dates.length > 10 ? '...' : ''}`);
      } else {
        alert(message);
      }
    } else {
      alert(`❌ 과거 데이터 수집 실패: ${result.error || '알 수 없는 오류'}`);
    }
  } catch (error) {
    console.error('❌ 과거 데이터 수집 오류:', error);
    alert(`❌ 과거 데이터 수집 중 오류가 발생했습니다: ${error.message}`);
  } finally {
    btn.disabled = false;
    btn.textContent = originalText;
  }
}

// 페이지 로드 시: 초기 데이터 로드 + 재무제표 버튼 클릭 바인딩 (inline onclick 대신)
document.addEventListener('DOMContentLoaded', function() {
  // 시가총액 200 데이터 자동 로드
  fetchMktcapData();
  // 재무제표 조회 버튼 (전역 함수 의존 없이 리스너로 연결)
  var btnFinaStat = document.getElementById('btn-fina-stat-fetch');
  if (btnFinaStat) btnFinaStat.addEventListener('click', fetchFinaStatData);
});

