import pandas as pd
url = "https://kind.krx.co.kr/listinvstg/pubofrprogcom.do?method=download&searchType=13"
try:
    df_list = pd.read_html(url, encoding='cp949', header=0)
    print("Found tables:", len(df_list))
    if df_list:
        print(df_list[0].head(2))
except Exception as e:
    print(e)
