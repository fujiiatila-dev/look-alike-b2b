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

# Auth & Multi-tenant Models
class EmpresaInfo(BaseModel):
    nome_fantasia: str
    cnpj: str
    email_contato: str
    telefone: str
    linkedin: Optional[str] = None

class LoginRequest(BaseModel):
    email: str
    password: str

class UserResponse(BaseModel):
    id: str
    email: str
    name: str
    role: str # 'owner' (nós), 'admin_corp' (cliente), 'user' (equipe do cliente)
    empresa_id: Optional[str] = None

class LoginResponse(BaseModel):
    access_token: str
    user: UserResponse

class WhoamiResponse(BaseModel):
    sub: str
    role: str
    client_id: str
    solution_kind: str
    display_name: str
    empresa_id: Optional[str] = None

# Mock Database
USERS_DB = [
    {"id": "usr_owner", "email": "dono@saas.com", "name": "Proprietário SaaS", "role": "owner", "empresa_id": None},
    {"id": "usr_corp_admin", "email": "admin@corporacao.com", "name": "Admin Cliente 1", "role": "admin_corp", "empresa_id": "emp_01"}
]

EMPRESAS_DB = {
    "emp_01": {
        "nome_fantasia": "Corporação Exemplo Ltda",
        "cnpj": "00.000.000/0001-91",
        "email_contato": "contato@exemplo.com",
        "telefone": "(11) 99999-9999",
        "linkedin": "linkedin.com/company/exemplo"
    }
}

MOCK_TOKEN = "jwt_token_perm_val_123"

def get_current_user(authorization: Optional[str] = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Token inválido.")
    
    token = authorization.split(" ")[1]
    if token != MOCK_TOKEN:
        raise HTTPException(status_code=401, detail="Sessão expirada.")
    
    # Por simplicidade, retornamos o primeiro usuário do mock ou buscamos por lógica
    return UserResponse(**USERS_DB[0]) 

@app.post("/api/auth/login", response_model=LoginResponse)
def login(req: LoginRequest):
    for u in USERS_DB:
        if req.email == u["email"]:
            return LoginResponse(access_token=MOCK_TOKEN, user=UserResponse(**u))
    raise HTTPException(status_code=401, detail="Usuário não encontrado.")

@app.get("/api/auth/whoami", response_model=WhoamiResponse)
def whoami(user: UserResponse = Depends(get_current_user)):
    return WhoamiResponse(
        sub=user.email,
        role=user.role,
        client_id="lookalike_app",
        solution_kind="office",
        display_name=user.name,
        empresa_id=user.empresa_id
    )

@app.get("/api/empresa/perfil", response_model=EmpresaInfo)
def get_perfil_empresa(user: UserResponse = Depends(get_current_user)):
    if not user.empresa_id:
        raise HTTPException(status_code=404, detail="Usuário não vinculado a uma empresa.")
    return EmpresaInfo(**EMPRESAS_DB[user.empresa_id])

@app.put("/api/empresa/perfil")
def update_perfil_empresa(info: EmpresaInfo, user: UserResponse = Depends(get_current_user)):
    if user.role not in ['owner', 'admin_corp']:
        raise HTTPException(status_code=403, detail="Sem permissão.")
    EMPRESAS_DB[user.empresa_id] = info.dict()
    return {"status": "sucesso"}

@app.post("/api/admin/criar-usuario")
def criar_usuario(novo_user: UserResponse, user: UserResponse = Depends(get_current_user)):
    # Owner cria Admin_Corp. Admin_Corp cria User.
    if user.role == 'owner' or (user.role == 'admin_corp' and novo_user.role == 'user'):
        USERS_DB.append(novo_user.dict())
        return {"status": "usuário criado"}
    raise HTTPException(status_code=403, detail="Permissão negada para criar este nível de conta.")

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

