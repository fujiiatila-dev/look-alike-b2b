import { ChangeDetectionStrategy, Component, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { ApiService, EventListItem } from '../../services/api.service';
import { MatTableModule } from '@angular/material/table';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatSortModule } from '@angular/material/sort';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { R } from '../../shared/utils/client-routes';

@Component({
    selector: 'app-event-list',
    standalone: true,
    imports: [
        CommonModule, RouterModule,
        MatTableModule, MatPaginatorModule, MatSortModule,
        MatFormFieldModule, MatInputModule
    ],
    templateUrl: './event-list.component.html',
    styleUrls: ['./event-list.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class EventListComponent {
    readonly R = R;
    displayedColumns: string[] = ['event_id', 'created_at', 'type', 'source', 'risk_score', 'label', 'action'];
    readonly pageSizeOptions = [25, 50, 100];

    // Signals for reactive state
    readonly items = signal<EventListItem[]>([]);
    readonly total = signal(0);
    readonly loading = signal(true);
    readonly page = signal(1);
    readonly pageSize = signal(50);
    readonly filterType = signal<'all' | 'manual' | 'auto'>('all');
    readonly searchTerm = signal('');
    readonly sortBy = signal<string>('date_desc');

    private searchTimeout: ReturnType<typeof setTimeout> | null = null;

    constructor(private api: ApiService) {
        this.loadPage();
    }

    loadPage(): void {
        this.loading.set(true);
        const type = this.filterType() === 'all' ? undefined : this.filterType();
        const search = this.searchTerm() || undefined;
        const sort = this.sortBy() !== 'date_desc' ? this.sortBy() : undefined;

        this.api.getEvents(this.page(), this.pageSize(), type, search, sort).subscribe({
            next: (res) => {
                this.items.set(res.items);
                this.total.set(res.total);
                this.loading.set(false);
            },
            error: () => {
                this.loading.set(false);
            }
        });
    }

    onPageChange(event: PageEvent): void {
        this.page.set(event.pageIndex + 1);
        this.pageSize.set(event.pageSize);
        this.loadPage();
    }

    setFilterType(type: 'all' | 'manual' | 'auto'): void {
        this.filterType.set(type);
        this.page.set(1);
        this.loadPage();
    }

    setSort(sort: string): void {
        this.sortBy.set(sort);
        this.page.set(1);
        this.loadPage();
    }

    applyTextFilter(event: Event): void {
        const value = (event.target as HTMLInputElement).value.trim();
        if (this.searchTimeout) clearTimeout(this.searchTimeout);
        this.searchTimeout = setTimeout(() => {
            this.searchTerm.set(value);
            this.page.set(1);
            this.loadPage();
        }, 300);
    }

    trackByEventId(_index: number, event: EventListItem): string {
        return event.event_id;
    }
}
