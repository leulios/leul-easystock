import React, { useEffect, useRef, useState } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { X, Camera } from 'lucide-react';

export default function BarcodeScanner({ onScan, onClose }) {
    const scannerRef = useRef(null);
    const [error, setError] = useState('');

    useEffect(() => {
        // Initialize the scanner with optimized settings for retail barcodes
        const scanner = new Html5QrcodeScanner(
            "barcode-reader",
            { fps: 10, qrbox: { width: 250, height: 150 }, disableFlip: false },
            false
        );

        scanner.render(
            (decodedText) => {
                scanner.clear(); // Stop scanning on success
                onScan(decodedText);
                onClose();
            },
            (err) => {
                // Ignore frequent scan errors (expected while camera is focusing)
                // Only show persistent hardware/permission errors
                if (!err?.message?.includes('NotFound')) {
                    console.warn(err);
                }
            }
        );

        return () => {
            scanner.clear().catch(console.error);
        };
    }, [onScan, onClose]);

    return (
        <div className="modal-overlay" style={{ zIndex: 9999 }} onClick={e => e.target === e.currentTarget && onClose()}>
            <div className="modal modal-md">
                <div className="modal-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Camera size={18} style={{ color: 'var(--primary)' }} />
                        <h2 className="modal-title">Scan Barcode</h2>
                    </div>
                    <button className="icon-btn" onClick={onClose}><X size={16} /></button>
                </div>
                <div className="modal-body" style={{ padding: 0 }}>
                    <div style={{ background: '#000', minHeight: 300, position: 'relative' }}>
                        <div id="barcode-reader" style={{ width: '100%', border: 'none' }} />
                    </div>
                    <div style={{ padding: '16px 20px', fontSize: 13, color: 'var(--gray-500)', textAlign: 'center' }}>
                        Center the barcode within the frame. The scanner will automatically read it. You may be asked to grant Camera permissions.
                    </div>
                </div>
            </div>
        </div>
    );
}
