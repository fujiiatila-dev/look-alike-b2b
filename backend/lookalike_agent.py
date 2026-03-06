import pandas as pd
import numpy as np
from sklearn.preprocessing import MinMaxScaler

class B2BLookalikeEngine:
    """
    Motor de Recomendação (Look-alike) para prospecção B2B.
    Encontra empresas semelhantes com base no CNAE, Faturamento e Número de Funcionários.
    """
    
    def __init__(self, w_cnae=1.0, w_fat=1.0, w_func=1.0):
        """
        Inicializa o motor com os pesos para o cálculo da distância Euclidiana ponderada.
        """
        self.weights = {
            'cnae': w_cnae,
            'faturamento': w_fat,
            'funcionarios': w_func
        }
        self.scaler = MinMaxScaler()
        
    def _limpar_cnae(self, cnae):
        """
        Remove pontuações do CNAE, retornando apenas os números em formato string.
        (Ex: de '62.04-0-00' para '6204000')
        """
        return str(cnae).replace('.', '').replace('-', '').replace('/', '').strip()

    def _calcular_distancia_cnae(self, cnae_a, cnae_b):
        """
        Constrói a métrica de distância (0 a 1) baseada na hierarquia estrutural do CNAE.
        Lembrando que Distância = 1 - Similaridade.
        
        Estrutura (7 dígitos numéricos no formato padrão):
        - Subclasse: 7 dígitos (score 1.0 -> dist 0.0)
        - Classe: 5 dígitos (score 0.75 -> dist 0.25)
        - Grupo: 3 dígitos (score 0.5 -> dist 0.5)
        - Divisão: 2 dígitos (score 0.25 -> dist 0.75)
        - Nenhum: score 0.0 -> dist 1.0
        """
        c1 = self._limpar_cnae(cnae_a)
        c2 = self._limpar_cnae(cnae_b)
        
        if not c1 or not c2:
            return 1.0 # Considera totalmente distante em caso de erro/falta
            
        if c1 == c2:
            return 0.0                      # Mesma Subclasse
        elif c1[:5] == c2[:5]:
            return 0.25                     # Mesma Classe
        elif c1[:3] == c2[:3]:
            return 0.50                     # Mesmo Grupo
        elif c1[:2] == c2[:2]:
            return 0.75                     # Mesma Divisão
        else:
            return 1.0                      # Categoria diferente

    def _pre_processamento(self, df):
        """
        Realiza as etapas de limpeza, tratamento e normalização dos dados.
        """
        # Cria uma cópia para não alterar o DataFrame original
        df_clean = df.copy()
        
        # 1. Tratar dados faltantes nas métricas numéricas
        # Preenchendo NaNs com a mediana ou zero (neste exemplo usamos 0 ou um valor base para categorias)
        df_clean['faturamento_ordinal'] = df_clean['faturamento_ordinal'].fillna(0)
        df_clean['funcionarios_ordinal'] = df_clean['funcionarios_ordinal'].fillna(0)
        
        # 2. Normalização de 0 a 1 em variáveis de escalas diferentes
        df_clean[['faturamento_norm', 'funcionarios_norm']] = self.scaler.fit_transform(
            df_clean[['faturamento_ordinal', 'funcionarios_ordinal']]
        )
        
        # 3. Estimativa de Porte (Cruzamento para evitar clusters genéricos)
        # O Porte Estimado cruza Faturamento e Funcionários (média ponderada ou produto)
        df_clean['porte_estimado'] = (df_clean['faturamento_norm'] * 0.6) + (df_clean['funcionarios_norm'] * 0.4)
        
        return df_clean

    def fit_predict(self, df, anchor_id, top_n=10):
        """
        Retorna as empresas mais parecidas com a empresa âncora (look-alike).
        
        Parâmetros:
        df: DataFrame contendo as bases das empresas.
            Espera-se as colunas: ['id', 'cnae', 'faturamento_ordinal', 'funcionarios_ordinal']
        anchor_id: O identificador único da empresa de referência.
        top_n: Quantidade de leads "gêmeos" a retornar.
        """
        
        # Aplica a Pipeline de limpeza e normalização
        df_processed = self._pre_processamento(df)
        
        # Validação da âncora
        anchor_data = df_processed[df_processed['id'] == anchor_id]
        if anchor_data.empty:
            raise ValueError(f"Empresa âncora ID={anchor_id} não encontrada na base de dados.")
            
        # Pega a primeira ocorrência (Series)
        anchor_row = anchor_data.iloc[0]
        
        # 1. Limpeza: Remover a empresa âncora da base de candidatos
        df_candidates = df_processed[df_processed['id'] != anchor_id].copy()
        
        # Calcula distâncias para cada candidato
        distancias = []
        for _, row in df_candidates.iterrows():
            
            # (CNAE_a - CNAE_b) representado aqui por nossa função de distância hierárquica
            dist_cnae = self._calcular_distancia_cnae(anchor_row['cnae'], row['cnae'])
            
            # Distâncias numéricas normalizadas
            dist_fat = abs(anchor_row['faturamento_norm'] - row['faturamento_norm'])
            dist_func = abs(anchor_row['funcionarios_norm'] - row['funcionarios_norm'])
            
            # Distância Euclidiana Ponderada
            d_squared = (
                self.weights['cnae'] * (dist_cnae ** 2) +
                self.weights['faturamento'] * (dist_fat ** 2) +
                self.weights['funcionarios'] * (dist_func ** 2)
            )
            distancia_total = np.sqrt(d_squared)
            distancias.append(distancia_total)
            
        df_candidates['distancia_score'] = distancias
        
        # Ordena da menor distância (mais parecido/quente) para a maior
        recomendacoes = df_candidates.sort_values(by='distancia_score', ascending=True)
        
        return recomendacoes.head(top_n)

# ==========================================
# Exemplo de Uso
# ==========================================
if __name__ == "__main__":
    # Base mock para testes:
    dados = pd.DataFrame({
        'id': [1, 2, 3, 4, 5],
        'nome_empresa': ['Tech Alpha', 'Tech Beta', 'Construtora X', 'Tech Gamma', 'Padaria Z'],
        'cnae': ['62.04-0-00', '62.04-0-00', '41.20-4-00', '62.01-5-01', '10.53-8-00'], # 62040 = Consultoria em TI
        'faturamento_ordinal': [4, 4, 5, 2, 1],   # Ex: 1=MEI, 2=ME, 3=EPP, 4=Medio, 5=Grande
        'funcionarios_ordinal': [3, 4, 5, 2, 1]   # Ex: 1 (1-9), 2 (10-49), 3 (50-99), 4 (100-499)
    })
    
    # Instanciando o agente
    agente = B2BLookalikeEngine(w_cnae=1.5, w_fat=1.0, w_func=0.8)
    
    # Empresa Âncora será a ID 1 (Tech Alpha)
    try:
        leads_recomendados = agente.fit_predict(df=dados, anchor_id=1, top_n=3)
        print("====== LEADS RECOMENDADOS ======")
        print(leads_recomendados[['id', 'nome_empresa', 'cnae', 'porte_estimado', 'distancia_score']])
    except Exception as e:
        print(f"Erro: {e}")
