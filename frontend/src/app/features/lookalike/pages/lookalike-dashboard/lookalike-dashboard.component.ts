import { Component, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClientModule, HttpClient } from '@angular/common/http';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { MatProgressBarModule } from '@angular/material/progress-bar';

interface Empresa {
    id: number;
    nome_empresa: string;
    cnae: string;
    faturamento_ordinal: number;
    funcionarios_ordinal: number;
    porte_estimado?: number;
    distancia_score?: number;
}

@Component({
    selector: 'app-lookalike-dashboard',
    standalone: true,
    imports: [
        CommonModule, FormsModule, HttpClientModule,
        MatCardModule, MatButtonModule, MatSelectModule, MatFormFieldModule,
        MatIconModule, MatDividerModule, MatProgressBarModule
    ],
    templateUrl: './lookalike-dashboard.component.html',
    styleUrls: ['./lookalike-dashboard.component.scss']
})
export class LookalikeDashboardComponent implements OnInit {
    anchorId: number | null = null;
    empresasBase = signal<Empresa[]>([]);
    recomendacoes = signal<Empresa[]>([]);
    loading = signal<boolean>(false);
    error = signal<string | null>(null);

    private apiUrl = '/api';

    constructor(private http: HttpClient) { }

    ngOnInit() {
        this.carregarBase();
    }

    carregarBase() {
        this.http.get<Empresa[]>(`${this.apiUrl}/empresas`).subscribe({
            next: (data) => this.empresasBase.set(data),
            error: (err) => this.error.set('Erro ao carregar empresas.')
        });
    }

    buscar() {
        if (!this.anchorId) return;
        this.loading.set(true);
        this.error.set(null);

        this.http.post<Empresa[]>(`${this.apiUrl}/lookalike`, {
            anchor_id: this.anchorId,
            top_n: 3
        }).subscribe({
            next: (data) => {
                this.recomendacoes.set(data);
                this.loading.set(false);
            },
            error: (err) => {
                this.error.set('Erro ao gerar look-alike.');
                this.loading.set(false);
            }
        });
    }

    getSimilaridade(score?: number): number {
        if (score === undefined) return 0;
        // Score menor = mais parecido, conversão heurística para % 
        const val = 100 - (score * 50);
        return Math.max(0, Math.min(100, Math.round(val)));
    }
}
