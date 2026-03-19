
import requests
import json

BASE_URL = "https://codonto.aplicativo.net"
LOGIN_URL = f"{BASE_URL}/Plataforma/AuthThisLocal"
SEARCH_URL = f"{BASE_URL}/Patrimonios/ShowPesquisa"

# Credenciais
payload = {
    "Login": "Rafael.brasileiro",
    "Senha": "Rafael @irb2025"
}

session = requests.Session()

print(f"Tentando login em {LOGIN_URL}...")
response = session.post(LOGIN_URL, data=payload)

print(f"Status Code: {response.status_code}")
print(f"Response URL: {response.url}")
# print(f"Response Text: {response.text[:500]}")

if response.status_code == 200:
    print("Login parece ter tido sucesso (ou pelo menos nao falhou o request).")
    
    print(f"Tentando acessar {SEARCH_URL}...")
    # ShowPesquisa usually expects some data for filtering, or empty for all
    search_payload = {} 
    search_response = session.post(SEARCH_URL, data=search_payload)
    
    print(f"Search Status Code: {search_response.status_code}")
    with open("search_response.html", "w") as f:
        f.write(search_response.text)
    print("Resposta da pesquisa salva em search_response.html")
else:
    print("Falha no login.")
