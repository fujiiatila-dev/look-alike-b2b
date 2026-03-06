import {
  ChangeDetectionStrategy,
  Component,
  Input,
  OnChanges,
  SimpleChanges
} from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { RunComparisonRow } from '../../../../shared/models/event-detail.models';

@Component({
  selector: 'app-metrics-table',
  standalone: true,
  imports: [MatCardModule, MatTableModule, MatPaginatorModule],
  templateUrl: './metrics-table.component.html',
  styleUrl: './metrics-table.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MetricsTableComponent implements OnChanges {
  @Input() runRows: RunComparisonRow[] = [];

  readonly displayedColumns = [
    'timestampLabel',
    'runLabel',
    'detectionsLabel',
    'overlapLabel',
    'delayLabel'
  ];

  pageIndex = 0;
  pageSize = 2;
  pagedRows: RunComparisonRow[] = [];

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['runRows']) {
      this.pageIndex = 0;
      this.updatePagedRows();
    }
  }

  onPageChange(event: PageEvent): void {
    this.pageIndex = event.pageIndex;
    this.pageSize = event.pageSize;
    this.updatePagedRows();
  }

  private updatePagedRows(): void {
    const start = this.pageIndex * this.pageSize;
    const end = start + this.pageSize;
    this.pagedRows = this.runRows.slice(start, end);
  }
}
