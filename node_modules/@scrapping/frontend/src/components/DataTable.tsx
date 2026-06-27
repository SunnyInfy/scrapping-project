import { useState, useEffect } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  flexRender,
  type SortingState,
} from '@tanstack/react-table';

const PAGE_SIZE = 50;

interface DataTableProps {
  data: any[];
  columns: any[];
  storageKey?: string;
}

function loadFromStorage<T>(key: string, fallback: T): T {
  try {
    const saved = localStorage.getItem(key);
    return saved ? JSON.parse(saved) : fallback;
  } catch {
    return fallback;
  }
}

export function DataTable({ data, columns, storageKey }: DataTableProps) {
  const [sorting, setSorting] = useState<SortingState>(() =>
    storageKey ? loadFromStorage<SortingState>(`${storageKey}_sorting`, []) : []
  );
  const [pageIndex, setPageIndex] = useState(() =>
    storageKey ? loadFromStorage<number>(`${storageKey}_page`, 0) : 0
  );

  useEffect(() => {
    setPageIndex(0);
  }, [data]);

  useEffect(() => {
    if (storageKey) localStorage.setItem(`${storageKey}_sorting`, JSON.stringify(sorting));
  }, [sorting, storageKey]);

  useEffect(() => {
    if (storageKey) localStorage.setItem(`${storageKey}_page`, String(pageIndex));
  }, [pageIndex, storageKey]);

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      pagination: { pageIndex, pageSize: PAGE_SIZE },
    },
    onSortingChange: setSorting,
    onPaginationChange: (updater) => {
      const next = typeof updater === 'function' ? updater({ pageIndex, pageSize: PAGE_SIZE }) : updater;
      setPageIndex(next.pageIndex);
    },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  const pageCount = table.getPageCount();
  const rows = table.getRowModel().rows;

  return (
    <div>
      <div className="table-container">
        <table>
          <thead>
            {table.getHeaderGroups().map(headerGroup => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map(header => (
                  <th
                    key={header.id}
                    onClick={header.column.getCanSort() ? header.column.getToggleSortingHandler() : undefined}
                    className={header.column.getCanSort() ? 'sortable-col' : ''}
                  >
                    {header.isPlaceholder ? null : (
                      <span className="header-content">
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {header.column.getCanSort() && (
                          <span className="sort-icon">
                            {header.column.getIsSorted() === 'asc' ? ' ↑'
                              : header.column.getIsSorted() === 'desc' ? ' ↓'
                              : ' ↕'}
                          </span>
                        )}
                      </span>
                    )}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {rows.map(row => (
              <tr key={row.id}>
                {row.getVisibleCells().map(cell => (
                  <td key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {pageCount > 1 && (
        <div className="pagination">
          <button
            className="page-btn"
            onClick={() => setPageIndex(0)}
            disabled={pageIndex === 0}
          >«</button>
          <button
            className="page-btn"
            onClick={() => setPageIndex(i => Math.max(0, i - 1))}
            disabled={pageIndex === 0}
          >‹</button>
          <span className="page-info">
            Page {pageIndex + 1} of {pageCount}
            <span className="page-info-total"> ({data.length} total)</span>
          </span>
          <button
            className="page-btn"
            onClick={() => setPageIndex(i => Math.min(pageCount - 1, i + 1))}
            disabled={pageIndex >= pageCount - 1}
          >›</button>
          <button
            className="page-btn"
            onClick={() => setPageIndex(pageCount - 1)}
            disabled={pageIndex >= pageCount - 1}
          >»</button>
        </div>
      )}
    </div>
  );
}
