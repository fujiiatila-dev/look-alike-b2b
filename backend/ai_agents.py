"""
====================================================================
CAMADA DE AGENTES DE IA (AI Agents Layer)
====================================================================
Esta camada define os contratos dos agentes de IA futuros.
Cada agente pode ser plugado sem alterar o core do sistema.
Hoje o agente de enriquecimento retorna dados mock.
Amanhã pode chamar a API da Receita Federal, OpenAI, etc.
====================================================================
"""

from abc import ABC, abstractmethod
from typing import Optional
import logging

logger = logging.getLogger(__name__)


# ──────────────────────────────────────────────────────────────────
# INTERFACE BASE DE AGENTE
# ──────────────────────────────────────────────────────────────────

class AIAgentInterface(ABC):
    """Contrato base que todo agente de IA deve implementar."""
    
    @property
    @abstractmethod
    def name(self) -> str:
        """Nome identificador do agente."""
        pass

    @abstractmethod
    def run(self, input_data: dict) -> dict:
        """Executa o agente com os dados de entrada e retorna o resultado."""
        pass


# ──────────────────────────────────────────────────────────────────
# AGENTE 1: ENRIQUECIMENTO DE LEADS
# Porta aberta para integração com Receita Federal / BigData / APIs externas
# ──────────────────────────────────────────────────────────────────

class LeadEnrichmentAgent(AIAgentInterface):
    """
    Enriquece os dados de um lead com informações adicionais.
    
    PORTA ABERTA: Para conectar a:
    - API da Receita Federal (dados de CNPJ)
    - Serviços como Serasa, SPC, BigDataCorp
    - Scraping de LinkedIn
    - Webhooks externos
    """
    
    @property
    def name(self) -> str:
        return "lead_enrichment"

    def run(self, input_data: dict) -> dict:
        cnpj = input_data.get("cnpj", "")
        nome = input_data.get("nome_empresa", "")
        
        logger.info(f"[LeadEnrichmentAgent] Enriquecendo dados para: {nome}")
        
        # MOCK: Retorna dados simulados
        # Para produção: chame self._fetch_receita_federal(cnpj) ou self._fetch_bigdata(cnpj)
        return {
            "cnpj": cnpj,
            "nome_empresa": nome,
            "situacao_especial": None,
            "data_abertura": "2015-03-10",
            "capital_social": "R$ 500.000,00",
            "socios": ["João Silva", "Maria Souza"],
            "source": "mock",  # será "receita_federal" em produção
        }


# ──────────────────────────────────────────────────────────────────
# AGENTE 2: SCORING DE PROPENSÃO
# Porta aberta para modelos de ML mais avançados (ex: XGBoost, GPT)
# ──────────────────────────────────────────────────────────────────

class PropensityScoreAgent(AIAgentInterface):
    """
    Calcula a propensão de conversão de um lead.

    PORTA ABERTA PARA:
    - Modelo XGBoost treinado nos seus clientes convertidos
    - Chamada a OpenAI GPT com contexto de vendas
    - Scored baseado em dados históricos do CRM (HubSpot, RD Station)
    """

    @property
    def name(self) -> str:
        return "propensity_score"

    def run(self, input_data: dict) -> dict:
        distancia = input_data.get("distancia_score", 1.0)
        
        # Lógica mock: converte distância em score de propensão
        propensity = round(max(0, min(100, (1.0 - distancia) * 80 + 20)), 1)

        return {
            "propensity_score": propensity,
            "tier": "HOT" if propensity > 70 else ("WARM" if propensity > 40 else "COLD"),
            "recommended_action": "Contato imediato" if propensity > 70 else "Nutrir com conteúdo",
            "model_version": "mock_v1",  # será "xgboost_v3" em produção
        }


# ──────────────────────────────────────────────────────────────────
# AGENTE 3: GERAÇÃO DE ABORDAGEM (IA GENERATIVA)
# Porta aberta para OpenAI, Claude, Gemini, etc.
# ──────────────────────────────────────────────────────────────────

class OutreachDraftAgent(AIAgentInterface):
    """
    Gera um texto de abordagem personalizado para o lead.

    PORTA ABERTA PARA:
    - Integração com OpenAI GPT-4o
    - Gemini 1.5 Pro
    - Claude
    Basta substituir o retorno mock por uma chamada real à API de LLM.
    """

    @property
    def name(self) -> str:
        return "outreach_draft"

    def run(self, input_data: dict) -> dict:
        lead_nome = input_data.get("nome_empresa", "empresa")
        cnae = input_data.get("cnae", "setor")

        # MOCK: Retorna template pré-definido
        # Para produção: chame openai.chat.completions.create(...)
        draft = (
            f"Olá, equipe da {lead_nome}!\n\n"
            f"Nossa análise de mercado identificou que vocês possuem um perfil altamente "
            f"compatível com os nossos clientes mais bem-sucedidos no setor {cnae}. "
            f"Acredito que nossa plataforma Freedom.ai pode gerar resultados expressivos para vocês.\n\n"
            f"Podemos agendar uma conversa rápida de 15 minutos?"
        )

        return {
            "subject": f"Uma oportunidade para {lead_nome}",
            "body": draft,
            "model_used": "mock_template",  # será "gpt-4o" em produção
        }


# ──────────────────────────────────────────────────────────────────
# ORCHESTRADOR DE AGENTES
# Permite encadear múltiplos agentes em pipelines
# ──────────────────────────────────────────────────────────────────

class AgentOrchestrator:
    """
    Coordena a execução de múltiplos agentes em sequência.
    Permite criar pipelines de IA modulares e extensíveis.

    Exemplo de pipeline futuro:
    orchestrator.run_pipeline([
        LeadEnrichmentAgent(),
        PropensityScoreAgent(),
        OutreachDraftAgent()
    ], input_data=lead)
    """

    def run_pipeline(self, agents: list, input_data: dict) -> dict:
        """Executa agentes em sequência, passando o output de cada um para o próximo."""
        context = input_data.copy()
        results = {}

        for agent in agents:
            logger.info(f"[Orchestrator] Executando agente: {agent.name}")
            try:
                result = agent.run(context)
                context.update(result)
                results[agent.name] = result
            except Exception as e:
                logger.error(f"[Orchestrator] Erro no agente {agent.name}: {e}")
                results[agent.name] = {"error": str(e)}

        return results
