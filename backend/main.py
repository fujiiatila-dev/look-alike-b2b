from fastapi import FastAPI, HTTPException, Depends, Header
from pydantic import BaseModel
from typing import List, Optional

from lookalike_agent import B2BLookalikeEngine
from repositories import get_empresa_repository, get_user_repository, get_empresa_info_repository
from ai_agents import (
    AgentOrchestrator, 
    LeadEnrichmentAgent,
    PropensityScoreAgent,
    OutreachDraftAgent
)
from fastapi.middleware.cors import CORSMiddleware

# ────────────────────────────────
# App Setup
# ────────────────────────────────
app = FastAPI(
    title="Freedom.ai - B2B Look-alike API",
    description="Motor de prospecção B2B baseado em similaridade de perfil empresarial.",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ────────────────────────────────
# Dependências (Injeção de repositórios e engine)
# ────────────────────────────────
engine = B2BLookalikeEngine(w_cnae=1.5, w_fat=1.0, w_func=0.8)
orchestrator = AgentOrchestrator()

# ────────────────────────────────
# Modelos (Schemas)
# ────────────────────────────────
class LookalikeRequest(BaseModel):
    anchor_id: int
    top_n: int = 5

class EmpresaResponse(BaseModel):
    id: int
    nome_empresa: str
    cnae: str
    faturamento_ordinal: int
    funcionarios_ordinal: int

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
    role: str  # 'owner' | 'admin_corp' | 'user'
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

# Token mock - substituir por JWT real (python-jose + HS256)
MOCK_TOKEN = "jwt_token_perm_val_123"

# ────────────────────────────────
# Autenticação (porta aberta para JWT real)
# ────────────────────────────────

def get_current_user(authorization: Optional[str] = Header(None)) -> UserResponse:
    """
    PORTA ABERTA: substituir MOCK_TOKEN por validação JWT real.
    Exemplo com python-jose:
        payload = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
        user_id = payload.get("sub")
        user = user_repo.get_by_id(user_id)
    """
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Token inválido.")

    token = authorization.split(" ")[1]
    if token != MOCK_TOKEN:
        raise HTTPException(status_code=401, detail="Sessão expirada.")

    user_repo = get_user_repository()
    # Aqui deveria buscar o user pelo token decodificado
    # Por enquanto retorna o primeiro user (owner) para o mock
    users = [user_repo.get_by_email("dono@saas.com")]
    if not users[0]:
        raise HTTPException(status_code=401, detail="Usuário não encontrado.")
    return UserResponse(**users[0])


def require_role(*roles):
    """Decorator de autorização por role."""
    def checker(user: UserResponse = Depends(get_current_user)):
        if user.role not in roles:
            raise HTTPException(status_code=403, detail=f"Requer um dos perfis: {roles}")
        return user
    return checker


# ────────────────────────────────
# ROTAS: Auth
# ────────────────────────────────

@app.post("/api/auth/login", response_model=LoginResponse, tags=["Auth"])
def login(req: LoginRequest):
    user_repo = get_user_repository()
    user = user_repo.get_by_email(req.email)
    if not user:
        raise HTTPException(status_code=401, detail="Usuário não encontrado.")
    # PORTA ABERTA: adicionar checagem de hash da senha (bcrypt.checkpw)
    return LoginResponse(access_token=MOCK_TOKEN, user=UserResponse(**user))


@app.get("/api/auth/me", response_model=UserResponse, tags=["Auth"])
def get_me(user: UserResponse = Depends(get_current_user)):
    return user


@app.get("/api/auth/whoami", response_model=WhoamiResponse, tags=["Auth"])
def whoami(user: UserResponse = Depends(get_current_user)):
    return WhoamiResponse(
        sub=user.email,
        role=user.role,
        client_id="lookalike_app",
        solution_kind="office",
        display_name=user.name,
        empresa_id=user.empresa_id
    )


# ────────────────────────────────
# ROTAS: Empresa / Perfil
# ────────────────────────────────

@app.get("/api/empresa/perfil", response_model=EmpresaInfo, tags=["Empresa"])
def get_perfil_empresa(user: UserResponse = Depends(get_current_user)):
    if not user.empresa_id:
        raise HTTPException(status_code=404, detail="Usuário não vinculado a uma empresa.")
    repo = get_empresa_info_repository()
    info = repo.get_by_id(user.empresa_id)
    if not info:
        raise HTTPException(status_code=404, detail="Perfil da empresa não encontrado.")
    return EmpresaInfo(**info)


@app.put("/api/empresa/perfil", tags=["Empresa"])
def update_perfil_empresa(info: EmpresaInfo, user: UserResponse = Depends(require_role("owner", "admin_corp"))):
    repo = get_empresa_info_repository()
    repo.update(user.empresa_id, info.dict())
    return {"status": "sucesso"}


# ────────────────────────────────
# ROTAS: Administração de Usuários
# ────────────────────────────────

@app.post("/api/admin/criar-usuario", tags=["Admin"])
def criar_usuario(novo_user: UserResponse, user: UserResponse = Depends(get_current_user)):
    if user.role == 'owner' or (user.role == 'admin_corp' and novo_user.role == 'user'):
        repo = get_user_repository()
        repo.create(novo_user.dict())
        return {"status": "usuário criado"}
    raise HTTPException(status_code=403, detail="Permissão negada para criar este nível de conta.")


# ────────────────────────────────
# ROTAS: Motor Look-alike
# ────────────────────────────────

@app.get("/api/empresas", response_model=List[EmpresaResponse], tags=["Lookalike"])
def get_todas_empresas(user: UserResponse = Depends(get_current_user)):
    """Lista as empresas disponíveis para seleção como âncora."""
    repo = get_empresa_repository()
    df = repo.get_all()
    return df.to_dict(orient="records")


@app.post("/api/lookalike", tags=["Lookalike"])
def do_lookalike(req: LookalikeRequest, user: UserResponse = Depends(get_current_user)):
    """Executa o motor de distância euclidiana e retorna os top-N leads mais similares."""
    repo = get_empresa_repository()
    df = repo.get_all()
    try:
        resultado = engine.fit_predict(df=df, anchor_id=req.anchor_id, top_n=req.top_n)
        return resultado.to_dict(orient="records")
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# ────────────────────────────────
# ROTAS: Agentes de IA (porta de extensão)
# ────────────────────────────────

@app.post("/api/agents/enrich", tags=["AI Agents"])
def enrich_lead(input_data: dict, user: UserResponse = Depends(get_current_user)):
    """
    Enriquece os dados de um lead com informações externas.
    PORTA ABERTA: plugar Receita Federal, BigDataCorp, LinkedIn, etc.
    """
    result = LeadEnrichmentAgent().run(input_data)
    return result


@app.post("/api/agents/score", tags=["AI Agents"])
def score_lead(input_data: dict, user: UserResponse = Depends(get_current_user)):
    """
    Calcula a propensão de conversão de um lead.
    PORTA ABERTA: plugar modelo XGBoost ou chamada GPT.
    """
    result = PropensityScoreAgent().run(input_data)
    return result


@app.post("/api/agents/outreach", tags=["AI Agents"])
def gerar_abordagem(input_data: dict, user: UserResponse = Depends(get_current_user)):
    """
    Gera um rascunho de mensagem de abordagem personalizada.
    PORTA ABERTA: plugar OpenAI GPT-4o, Claude ou Gemini.
    """
    result = OutreachDraftAgent().run(input_data)
    return result


@app.post("/api/agents/pipeline", tags=["AI Agents"])
def run_full_pipeline(input_data: dict, user: UserResponse = Depends(get_current_user)):
    """
    Executa o pipeline completo de IA:
    Enriquecimento → Scoring → Geração de Abordagem.
    """
    result = orchestrator.run_pipeline(
        agents=[LeadEnrichmentAgent(), PropensityScoreAgent(), OutreachDraftAgent()],
        input_data=input_data
    )
    return result
