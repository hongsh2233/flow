키움 Open API+ 코드를 키움 REST API로 바꾸고 싶어요

import sys
from PyQt5.QtWidgets import QApplication
from PyQt5.QAxContainer import QAxWidget

class KiwoomAPI:
    def __init__(self):
        self.app = QApplication(sys.argv)
        self.kiwoom = QAxWidget('KHOPENAPI.KHOpenAPICtrl.1')
        self.kiwoom.OnEventConnect.connect(self.login_callback)
        self.kiwoom.OnReceiveTrData.connect(self.receive_tr_data)

        self.login()

    def login(self):
        self.kiwoom.dynamicCall('CommConnect()')
        self.app.exec_()

    def login_callback(self, err_code):
        if err_code == 0:
            print('로그인 성공')
            self.request_stock_info('005930')  # 삼성전자 코드

    def request_stock_info(self, stock_code):
        self.kiwoom.dynamicCall('SetInputValue(QString, QString)', '종목코드', stock_code)
        self.kiwoom.dynamicCall('CommRqData(QString, QString, int, QString)', '주식기본정보요청', 'OPT10001', 0, '0101')

    def receive_tr_data(self, screen_no, rqname, tr_code, record_name, prev_next, data_len, err_code, msg1, msg2, msg3):
        if rqname == '주식기본정보요청':
            stock_name = self.kiwoom.dynamicCall('GetCommData(QString, QString, int, QString)', tr_code, rqname, 0, '종목명')
            current_price = self.kiwoom.dynamicCall('GetCommData(QString, QString, int, QString)', tr_code, rqname, 0, '현재가')
            print(f'종목명: {stock_name.strip()}, 현재가: {current_price.strip()}')

        # 종료 이벤트
        self.app.quit()

if __name__ == '__main__':
    KiwoomAPI()

키움 Open API+에서 REST API로 변환하기
키움 Open API+ 코드를 REST API로 변환하는 방법을 안내드립니다. 이 코드는 주식 기본 정보를 요청하고 응답을 처리하는 기능을 포함합니다.

✅ 요약
이 코드는 PyQt5를 사용하여 키움 Open API+를 통해 주식 기본 정보를 요청하는 기능을 구현합니다. REST API로 변환된 코드는 접근 토큰을 사용하여 주식 정보를 요청하고, 응답을 처리하는 흐름을 보여줍니다. Python 언어로 작성되었습니다.

💻 코드
python

             
import requests
import json

class KiwoomAPI:
    def __init__(self, access_token):
        self.access_token = access_token
        self.host = 'https://api.kiwoom.com'
        self.endpoint = '/api/dostk/stkinfo'

    def request_stock_info(self, stock_code):
        # 요청 데이터
        params = {
            'stk_cd': stock_code  # 종목코드
        }
        # API 요청
        response = self.send_request(params)
        self.process_response(response)

    def send_request(self, params):
        url = self.host + self.endpoint
        headers = {
            'Content-Type': 'application/json;charset=UTF-8',
            'authorization': f'Bearer {self.access_token}',
            'api-id': 'ka10001'
        }
        response = requests.post(url, headers=headers, json=params)
        return response.json()

    def process_response(self, response):
        if response.get('return_code') == 0:
            stock_name = response.get('stk_nm')
            current_price = response.get('cur_prc')
            print(f'종목명: {stock_name}, 현재가: {current_price}')
        else:
            print('주식 정보 요청 실패:', response.get('return_msg'))

if __name__ == '__main__':
    access_token = '[접근 토큰]'  # 발급받은 접근 토큰
    kiwoom_api = KiwoomAPI(access_token)
    kiwoom_api.request_stock_info('005930')  # 삼성전자 코드
         
📘 설명
이 코드는 KiwoomAPI 클래스를 정의하여 키움 REST API를 통해 주식 기본 정보를 요청합니다.

초기화: 클래스 초기화 시 접근 토큰과 API 호스트 및 엔드포인트를 설정합니다.
주식 정보 요청: request_stock_info 메서드는 종목 코드를 받아 API 요청을 수행합니다.
API 요청: send_request 메서드는 POST 요청을 보내고 응답을 JSON 형식으로 반환합니다.
응답 처리: process_response 메서드는 응답을 처리하여 주식명과 현재가를 출력합니다.
이 코드는 키움증권 REST API를 활용하여 주식 정보를 요청하는 기본적인 구조를 보여줍니다.

🔗 추천 API
API를 추천해드립니다. 필요한 기능에 맞게 선택하여 사용해보세요!

au10001: OAuth 인증 > 접근토큰발급 > 접근토큰 발급

ka10001: 국내주식 > 종목정보 > 주식기본정보요청

💡 TIP!
이런 질문은 어떠세요? 필요하다면 비슷한 예제를 바탕으로 코드를 생성해드릴 수 있어요!

접근토큰 발급(au10001) 방법을 python을 활용하여 구현해줘

주식기본정보요청(ka10001) 방법을 python을 활용하여 구현해줘

📍 참고자료
더 자세한 내용은 아래의 경로를 참고해주세요.

키움 REST API 홈페이지 > 서비스 소개 또는 API 가이드
