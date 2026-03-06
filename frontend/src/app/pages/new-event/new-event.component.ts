import { ChangeDetectionStrategy, Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { ApiService, InboxFile } from '../../services/api.service';
import { MatButtonModule } from '@angular/material/button';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatTableModule } from '@angular/material/table';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { R } from '../../shared/utils/client-routes';

@Component({
    selector: 'app-new-event',
    standalone: true,
    imports: [
        CommonModule,
        RouterModule,
        MatButtonModule,
        MatInputModule,
        MatFormFieldModule,
        MatTableModule,
        MatSnackBarModule
    ],
    templateUrl: './new-event.component.html',
    styleUrls: ['./new-event.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class NewEventComponent implements OnInit {
    readonly R = R;
    files = signal<InboxFile[]>([]);
    filteredFiles = signal<InboxFile[]>([]);

    loading = signal(true);
    savingItem = signal<string | null>(null);
    searchTerm = signal('');

    displayedColumns: string[] = ['thumbnail', 'filename', 'size', 'date', 'action'];

    constructor(
        private api: ApiService,
        private router: Router,
        private snackBar: MatSnackBar
    ) { }

    ngOnInit() {
        this.api.getInboxFiles().subscribe({
            next: (data) => {
                this.files.set(data);
                this.filteredFiles.set(data);
                this.loading.set(false);
            },
            error: (e) => {
                console.error(e);
                this.snackBar.open('Falha ao carregar inbox', 'OK', { duration: 3000 });
                this.loading.set(false);
            }
        });
    }

    applyFilter(event: Event) {
        const filterValue = (event.target as HTMLInputElement).value.toLowerCase();
        this.searchTerm.set(filterValue);

        if (!filterValue) {
            this.filteredFiles.set(this.files());
            return;
        }

        this.filteredFiles.set(
            this.files().filter(f => f.filename.toLowerCase().includes(filterValue))
        );
    }

    getThumbUrl(filename: string): string {
        return `/api/video/thumb?path=data/${encodeURIComponent(filename)}&t=1.0&w=400`;
    }

    formatBytes(bytes: number, decimals = 2) {
        if (!+bytes) return '0 Bytes';
        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
    }

    createEvent(filename: string) {
        if (this.savingItem() !== null) return;
        this.savingItem.set(filename);

        this.api.createManualEvent(filename).subscribe({
            next: (res) => {
                this.snackBar.open('Evento criado com sucesso!', 'OK', { duration: 2000 });
                this.router.navigate([R.event(res.event_id)]);
            },
            error: (err) => {
                console.error(err);
                this.snackBar.open('Erro ao criar evento manual', 'Fechar', { duration: 4000 });
                this.savingItem.set(null);
            }
        });
    }
}
