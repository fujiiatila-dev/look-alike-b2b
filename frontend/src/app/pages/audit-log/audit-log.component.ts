import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { ApiService } from '../../services/api.service';
import { R } from '../../shared/utils/client-routes';

@Component({
    selector: 'app-audit-log',
    standalone: true,
    imports: [CommonModule, RouterModule],
    templateUrl: './audit-log.component.html',
    styleUrls: ['./audit-log.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class AuditLogComponent implements OnInit {
    readonly R = R;
    exports: any[] = [];
    loading = true;

    constructor(private api: ApiService) { }

    ngOnInit() {
        this.api.getExports().subscribe({
            next: (data) => {
                this.exports = data;
                this.loading = false;
            },
            error: (e) => {
                console.error(e);
                this.loading = false;
            }
        });
    }

    getShortId(id: string): string {
        return id.split('_').pop() || id;
    }

    getRelativePath(path: string): string {
        return path.includes('data_v1/') ? path.split('data_v1/')[1] : path;
    }

    getShortHash(hash: string): string {
        return hash ? hash.substring(0, 16) + '...' : '--';
    }
}
