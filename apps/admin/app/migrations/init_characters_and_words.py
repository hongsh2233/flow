"""
캐릭터 및 주식 단어 초기 데이터 삽입 마이그레이션

서버 시작 시 기본 캐릭터 15개와 주식 관련 단어 120개를 데이터베이스에 삽입합니다.
"""
from app.database import SessionLocal
from app.models import Character, StockWord


def init_characters_and_words():
    """캐릭터 및 주식 단어 초기 데이터 삽입"""
    db = SessionLocal()
    try:
        # 1. 캐릭터 초기 데이터 (9개 - 실제 존재하는 이미지만)
        characters_data = [
            {"name": "🐂 황소", "image_url": "/static/image/characters/bull.png", "order_index": 0},
            {"name": "🐻 곰", "image_url": "/static/image/characters/bear.png", "order_index": 1},
            {"name": "🦅 독수리", "image_url": "/static/image/characters/eagle.png", "order_index": 2},
            {"name": "🐬 돌고래", "image_url": "/static/image/characters/dolphin.png", "order_index": 3},
            {"name": "🦁 사자", "image_url": "/static/image/characters/lion.png", "order_index": 4},
            {"name": "🐯 호랑이", "image_url": "/static/image/characters/tiger.png", "order_index": 5},
            {"name": "🐺 늑대", "image_url": "/static/image/characters/wolf.png", "order_index": 6},
            {"name": "🦊 여우", "image_url": "/static/image/characters/fox.png", "order_index": 7},
        ]
        
        # 이미 캐릭터가 있으면 스킵
        existing_chars = db.query(Character).count()
        if existing_chars == 0:
            for char_data in characters_data:
                char = Character(**char_data, is_active="active")
                db.add(char)
            print(f"✅ 캐릭터 {len(characters_data)}개 초기 데이터 삽입 완료")
        else:
            print(f"ℹ️ 캐릭터 데이터가 이미 존재합니다 ({existing_chars}개)")
        
        # 2. 주식 관련 단어 초기 데이터 (120개)
        stock_words_data = [
            "투자자", "거래자", "매수자", "매도자", "분석가", "트레이더", "증권가", "주식왕",
            "수익률", "수익성", "성장성", "안정성", "유동성", "시가총액", "상장사", "거래량",
            "종목", "지수", "코스피", "코스닥", "상승", "하락", "보합", "상한가", "하한가",
            "차익", "차손", "손익", "수익", "손실", "배당", "자산", "부채", "자본",
            "주가", "시가", "종가", "고가", "저가", "등락율", "변동성", "베타값", "알파값",
            "펀드", "ETF", "ELS", "채권", "파생상품", "선물", "옵션", "워런트", "신주인수권",
            "공시", "실적", "재무제표", "손익계산서", "재무상태표", "현금흐름표", "배당금", "자사주", "스톡옵션",
            "M&A", "인수합병", "기업공개", "상장폐지", "스플릿", "액면분할", "액면병합", "유상증자", "무상증자",
            "순이익", "영업이익", "매출액", "영업비용", "이자비용", "세금비용", "당기순이익", "자기자본",
            "ROE", "ROA", "PER", "PBR", "EPS", "BPS", "부채비율", "유동비율", "자기자본비율",
            "기술적분석", "기본분석", "차트분석", "봉도표", "이동평균선", "RSI", "MACD", "볼린저밴드", "일목균형표",
            "매수신호", "매도신호", "골든크로스", "데드크로스", "지지선", "저항선", "삼각수렴", "역삼각형", "더블톱",
            "배당성향", "배당수익률", "배당락일", "배당기준일", "시가배당률", "배당주", "성장주", "가치주", "우선주",
            "증권사", "증권거래소", "자동매매", "알고리즘", "HTS", "MTS", "온라인거래", "체결", "호가",
        ]
        
        # 이미 단어가 있으면 스킵
        existing_words = db.query(StockWord).count()
        if existing_words == 0:
            for idx, word in enumerate(stock_words_data):
                stock_word = StockWord(word=word, order_index=idx, is_active="active")
                db.add(stock_word)
            print(f"✅ 주식 단어 {len(stock_words_data)}개 초기 데이터 삽입 완료")
        else:
            print(f"ℹ️ 주식 단어 데이터가 이미 존재합니다 ({existing_words}개)")
        
        db.commit()
        
    except Exception as e:
        print(f"❌ 캐릭터 및 주식 단어 초기 데이터 삽입 실패: {e}")
        db.rollback()
    finally:
        db.close()


if __name__ == "__main__":
    print("캐릭터 및 주식 단어 초기 데이터 삽입 시작...")
    init_characters_and_words()
    print("초기 데이터 삽입 완료!")

