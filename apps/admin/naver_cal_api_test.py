import requests

url = "https://m.stock.naver.com/api/json/sise/scheduleMonthly.nhn?month=202603"
headers = {"User-Agent": "Mozilla/5.0"}
resp = requests.get(url, headers=headers)
print("status:", resp.status_code)
if resp.status_code == 200:
    data = resp.json()
    print("keys:", data.keys() if isinstance(data, dict) else "not dict")
    if "result" in data:
        print("result keys:", data["result"].keys())
