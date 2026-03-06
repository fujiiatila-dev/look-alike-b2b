"""
====================================================================
REPOSITÓRIO DE DADOS (Repository Pattern)
====================================================================
Esta camada abstrai TODA a lógica de acesso a dados.
Para trocar de Mock para um banco real (PostgreSQL, etc.),
basta implementar as mesmas interfaces aqui. O main.py NÃO muda.
====================================================================
"""

from abc import ABC, abstractmethod
from typing import List, Optional, Dict
import pandas as pd


# ──────────────────────────────────────────────────────────────────
# INTERFACES (Contratos) - Definem o que cada repositório deve fazer
# ──────────────────────────────────────────────────────────────────

class EmpresaRepositoryInterface(ABC):
    @abstractmethod
    def get_all(self) -> pd.DataFrame:
        """Retorna todas as empresas da base como DataFrame."""
        pass

    @abstractmethod
    def get_by_id(self, empresa_id: int) -> Optional[dict]:
        """Retorna os dados de uma empresa pelo ID."""
        pass


class UserRepositoryInterface(ABC):
    @abstractmethod
    def get_by_email(self, email: str) -> Optional[dict]:
        pass

    @abstractmethod
    def create(self, user: dict) -> dict:
        pass


class EmpresaInfoRepositoryInterface(ABC):
    @abstractmethod
    def get_by_id(self, empresa_id: str) -> Optional[dict]:
        pass

    @abstractmethod
    def update(self, empresa_id: str, data: dict) -> None:
        pass


# ──────────────────────────────────────────────────────────────────
# IMPLEMENTAÇÕES MOCK (em memória - para MVP e testes)
# Para produção, substitua por implementações PostgreSQL, Supabase, etc.
# ──────────────────────────────────────────────────────────────────

class MockEmpresaRepository(EmpresaRepositoryInterface):
    """
    PORTA ABERTA: Substitua esta classe por PostgreSQLEmpresaRepository
    que executa: SELECT * FROM empresas WHERE deleted_at IS NULL
    """
    _DATA = pd.DataFrame({
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

    def get_all(self) -> pd.DataFrame:
        return self._DATA.copy()

    def get_by_id(self, empresa_id: int) -> Optional[dict]:
        result = self._DATA[self._DATA['id'] == empresa_id]
        return result.iloc[0].to_dict() if not result.empty else None


class MockUserRepository(UserRepositoryInterface):
    """
    PORTA ABERTA: Substitua por PostgreSQLUserRepository com bcrypt e JWT real.
    Integra nativamente com Supabase Auth, Auth0 ou Keycloak.
    """
    _USERS: List[dict] = [
        {"id": "usr_owner", "email": "dono@saas.com", "name": "Proprietário SaaS", "role": "owner", "empresa_id": None},
        {"id": "usr_corp_admin", "email": "admin@corporacao.com", "name": "Admin Cliente 1", "role": "admin_corp", "empresa_id": "emp_01"}
    ]

    def get_by_email(self, email: str) -> Optional[dict]:
        return next((u for u in self._USERS if u["email"] == email), None)

    def create(self, user: dict) -> dict:
        self._USERS.append(user)
        return user


class MockEmpresaInfoRepository(EmpresaInfoRepositoryInterface):
    """
    PORTA ABERTA: Substitua por PostgreSQLEmpresaInfoRepository com
    UPDATE companies SET ... WHERE id = %s
    """
    _INFOS: Dict[str, dict] = {
        "emp_01": {
            "nome_fantasia": "Corporação Exemplo Ltda",
            "cnpj": "00.000.000/0001-91",
            "email_contato": "contato@exemplo.com",
            "telefone": "(11) 99999-9999",
            "linkedin": "linkedin.com/company/exemplo"
        }
    }

    def get_by_id(self, empresa_id: str) -> Optional[dict]:
        return self._INFOS.get(empresa_id)

    def update(self, empresa_id: str, data: dict) -> None:
        self._INFOS[empresa_id] = data


# ──────────────────────────────────────────────────────────────────
# FACTORY - Decide qual implementação usar (mock ou real)
# Controle pelo arquivo .env: DB_MODE=mock | postgres | supabase
# ──────────────────────────────────────────────────────────────────

import os

def get_empresa_repository() -> EmpresaRepositoryInterface:
    mode = os.getenv("DB_MODE", "mock")
    if mode == "mock":
        return MockEmpresaRepository()
    # elif mode == "postgres":
    #     from repositories.postgres import PostgreSQLEmpresaRepository
    #     return PostgreSQLEmpresaRepository()
    raise ValueError(f"DB_MODE inválido: {mode}")


def get_user_repository() -> UserRepositoryInterface:
    mode = os.getenv("DB_MODE", "mock")
    if mode == "mock":
        return MockUserRepository()
    raise ValueError(f"DB_MODE inválido: {mode}")


def get_empresa_info_repository() -> EmpresaInfoRepositoryInterface:
    mode = os.getenv("DB_MODE", "mock")
    if mode == "mock":
        return MockEmpresaInfoRepository()
    raise ValueError(f"DB_MODE inválido: {mode}")
