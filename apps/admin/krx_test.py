import requests
import urllib3
urllib3.disable_warnings()

url = "https://kind.krx.co.kr/corpgeneral/corpList.do?method=download&searchType=13"
try:
    resp = requests.get(url, verify=False)
    print("status:", resp.status_code)
    print(resp.text[:500])
except Exception as e:
    print(e)
