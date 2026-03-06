import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClientModule, HttpClient } from '@angular/common/http';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

interface EmpresaPerfil {
  nome_fantasia: string;
  cnpj: string;
  email_contato: string;
  telefone: string;
  linkedin?: string;
}

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [
    CommonModule, FormsModule, HttpClientModule,
    MatCardModule, MatFormFieldModule, MatInputModule,
    MatButtonModule, MatIconModule, MatSnackBarModule
  ],
  templateUrl: './profile.component.html',
  styleUrls: ['./profile.component.scss']
})
export class ProfileComponent implements OnInit {
  perfil = signal<EmpresaPerfil>({
    nome_fantasia: '',
    cnpj: '',
    email_contato: '',
    telefone: '',
    linkedin: ''
  });

  loading = signal(false);

  constructor(private http: HttpClient, private snack: MatSnackBar) { }

  ngOnInit() {
    this.carregarPerfil();
  }

  carregarPerfil() {
    this.http.get<EmpresaPerfil>('/api/empresa/perfil').subscribe({
      next: (data) => this.perfil.set(data),
      error: () => this.snack.open('Erro ao carregar perfil', 'Fechar', { duration: 3000 })
    });
  }

  salvar() {
    this.loading.set(true);
    this.http.put('/api/empresa/perfil', this.perfil()).subscribe({
      next: () => {
        this.loading.set(false);
        this.snack.open('Perfil atualizado com sucesso!', 'OK', { duration: 3000 });
      },
      error: () => {
        this.loading.set(false);
        this.snack.open('Erro ao salvar dados', 'Fechar', { duration: 3000 });
      }
    });
  }
}
