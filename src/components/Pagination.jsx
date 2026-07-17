import React from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';

export default function Pagination({ currentPage, totalPages, onPageChange, totalItems, itemsPerPage }) {
    if (totalPages <= 1) return null;

    const startItem = (currentPage - 1) * itemsPerPage + 1;
    const endItem = Math.min(currentPage * itemsPerPage, totalItems);

    return (
        <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '12px 20px', borderTop: '1px solid var(--gray-100)',
            background: 'white', borderRadius: '0 0 var(--radius-lg) var(--radius-lg)'
        }}>
            <div style={{ fontSize: 12, color: 'var(--gray-500)' }}>
                Showing <strong>{startItem}-{endItem}</strong> of <strong>{totalItems}</strong> entries
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <button
                    onClick={() => onPageChange(1)}
                    disabled={currentPage === 1}
                    style={btnStyle(currentPage === 1)}
                    title="First Page"
                >
                    <ChevronsLeft size={14} />
                </button>
                <button
                    onClick={() => onPageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                    style={btnStyle(currentPage === 1)}
                    title="Previous Page"
                >
                    <ChevronLeft size={14} />
                </button>

                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--gray-700)', padding: '0 8px' }}>
                    Page {currentPage} of {totalPages}
                </div>

                <button
                    onClick={() => onPageChange(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    style={btnStyle(currentPage === totalPages)}
                    title="Next Page"
                >
                    <ChevronRight size={14} />
                </button>
                <button
                    onClick={() => onPageChange(totalPages)}
                    disabled={currentPage === totalPages}
                    style={btnStyle(currentPage === totalPages)}
                    title="Last Page"
                >
                    <ChevronsRight size={14} />
                </button>
            </div>
        </div>
    );
}

const btnStyle = (disabled) => ({
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    width: 28, height: 28, borderRadius: 6,
    border: '1px solid var(--gray-200)',
    background: disabled ? 'var(--gray-50)' : 'white',
    color: disabled ? 'var(--gray-300)' : 'var(--gray-600)',
    cursor: disabled ? 'not-allowed' : 'pointer',
    transition: 'all 0.2s',
});
