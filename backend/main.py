from fastapi import FastAPI, HTTPException, Depends, Header
from pydantic import BaseModel
import pandas as pd
from typing import List, Optional
from lookalike_agent import B2BLookalikeEngine
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="B2B Look-alike API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Simulando um banco de dados real
# Normalmente usaríamos PostgreSQL ou Clickhouse aqui e leríamos os leads de lá.
DADOS_MOCK = pd.DataFrame({
    'id': [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
    'nome_empresa': [
        'Tech Alpha', 'Tech Beta', 'Construtora X', 'Tech Gamma', 'Padaria Z',
        'Fintech Y', 'Consultoria Max', 'Agropecuária Z', 'Varejo Beta', 'Startup Omega'
    ],
    'cnae': [
        '62.04-0-00', '62.04-0-00', '41.20-4-00', '62.01-5-01', '10.53-8-00', 
        '64.99-9-99', '70.20-4-00', '01.15-6-00', '47.11-3-02', '62.01-5-01'
    ],
    'faturamento_ordinal': [4, 4, 5, 2, 1, 5, 3, 4, 3, 2],
    'funcionarios_ordinal': [3, 4, 5, 2, 1, 4, 2, 5, 4, 2]
})

engine = B2BLookalikeEngine(w_cnae=1.5, w_fat=1.0, w_func=0.8)

class LookalikeRequest(BaseModel):
    anchor_id: int
    top_n: int = 5

class EmpresaResponse(BaseModel):
    id: int
    nome_empresa: str
    cnae: str
    faturamento_ordinal: int
    funcionarios_ordinal: int

# Auth Models
class LoginRequest(BaseModel):
    email: str
    password: str

class UserResponse(BaseModel):
    id: str
    email: str
    name: str
    role: str

class LoginResponse(BaseModel):
    access_token: str
    user: UserResponse

class WhoamiResponse(BaseModel):
    sub: str
    role: str
    client_id: str
    solution_kind: str
    display_name: str

MOCK_TOKEN = "jwt_token_mock_12345"
MOCK_USER = UserResponse(id="usr_01", email="admin@b2b.com", name="Administrador B2B", role="admin")

def get_current_user(authorization: Optional[str] = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Token não fornecido ou inválido.")
    
    token = authorization.split(" ")[1]
    if token != MOCK_TOKEN:
        raise HTTPException(status_code=401, detail="Token inválido.")
    return MOCK_USER

@app.post("/api/auth/login", response_model=LoginResponse)
def login(req: LoginRequest):
    # Mock para teste rápido. Qualquer senha serve para admin@b2b.com
    if req.email == "admin@b2b.com" and req.password:
        return LoginResponse(
            access_token=MOCK_TOKEN,
            user=MOCK_USER
        )
    raise HTTPException(status_code=401, detail="Credenciais inválidas. Use admin@b2b.com")

@app.get("/api/auth/me", response_model=UserResponse)
def get_me(user: UserResponse = Depends(get_current_user)):
    return user

@app.get("/api/auth/whoami", response_model=WhoamiResponse)
def whoami(user: UserResponse = Depends(get_current_user)):
    return WhoamiResponse(
        sub=user.email,
        role=user.role,
        client_id="lookalike_app",
        solution_kind="office", # Mudar solution_kind pra garantir navegação
        display_name=user.name
    )

@app.get("/api/empresas", response_model=List[EmpresaResponse])
def get_todas_empresas(user: UserResponse = Depends(get_current_user)):
    # Rota protegida (apenas para usuários com token)
    return DADOS_MOCK.to_dict(orient="records")

@app.post("/api/lookalike")
def do_lookalike(req: LookalikeRequest, user: UserResponse = Depends(get_current_user)):
    # Rota protegida
    try:
        resultado = engine.fit_predict(df=DADOS_MOCK, anchor_id=req.anchor_id, top_n=req.top_n)
        return resultado.to_dict(orient="records")
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

