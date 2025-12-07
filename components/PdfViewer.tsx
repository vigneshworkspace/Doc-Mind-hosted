import React, { useEffect, useRef, useState } from 'react';
import { X, Loader2, ZoomIn, ZoomOut } from 'lucide-react';
import type { Document } from '../types';
import * as pdfjsLib from 'pdfjs-dist';

interface PdfViewerProps {
  pdf: Document;
  onClose: () => void;
}

const PdfViewer: React.FC<PdfViewerProps> = ({ pdf, onClose }) => {
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // renderScale is the scale for crisp rendering. Updates after zoom is finished.
  const [renderScale, setRenderScale] = useState(1.5);
  // viewScale is for the immediate, smooth CSS transform. Updates instantly.
  const [viewScale, setViewScale] = useState(1.5);

  const debounceTimeoutRef = useRef<number | null>(null);

  // Main effect to render the PDF canvas
  useEffect(() => {
    const renderPdf = async () => {
      setLoading(true);
      setError(null);
      if (canvasContainerRef.current) {
        canvasContainerRef.current.innerHTML = ''; // Clear previous content
      }

      if (!pdf.fileData) {
        setError('No file data available for this document. Viewing is only available for newly uploaded PDFs.');
        setLoading(false);
        return;
      }

      try {
        const bufferCopy = pdf.fileData.slice(0);
        const pdfDoc = await pdfjsLib.getDocument({ data: bufferCopy }).promise;
        
        for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
          const page = await pdfDoc.getPage(pageNum);
          // Render at the target renderScale for crispness
          const viewport = page.getViewport({ scale: renderScale });
          const canvas = document.createElement('canvas');
          const context = canvas.getContext('2d');
          
          canvas.height = viewport.height;
          canvas.width = viewport.width;
          canvas.style.marginBottom = '1rem';
          canvas.style.borderRadius = '8px';
          canvas.style.boxShadow = '0 4px 15px rgba(0,0,0,0.1)';
          
          if (context && canvasContainerRef.current) {
            await page.render({
              canvasContext: context,
              viewport: viewport,
            } as any).promise;
            canvasContainerRef.current.appendChild(canvas);
          }
        }
      } catch (e) {
        console.error('Error rendering PDF', e);
        setError('Failed to render the PDF. The file may be corrupted.');
      } finally {
        setLoading(false);
      }
    };

    renderPdf();
  }, [pdf, renderScale]); // Re-render only when pdf or the target renderScale changes

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, []);
  
  const handleZoom = (newScaleValue: number) => {
    // Clamp the scale to prevent zooming too far in or out
    const newScale = Math.max(0.2, Math.min(newScaleValue, 5));
    
    // Update the visual scale immediately for a smooth CSS transform
    setViewScale(newScale);

    // Debounce the high-quality re-render
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }

    debounceTimeoutRef.current = window.setTimeout(() => {
      // After 200ms of inactivity, update the renderScale to trigger a crisp re-render
      setRenderScale(newScale);
    }, 200);
  };

  const handleZoomIn = () => handleZoom(viewScale + 0.2);
  const handleZoomOut = () => handleZoom(viewScale - 0.2);

  const handleWheel = (e: React.WheelEvent) => {
    // Use ctrlKey to detect pinch-to-zoom gestures on trackpads.
    if (e.ctrlKey) {
      e.preventDefault();
      // Adjust scale based on the wheel's deltaY.
      handleZoom(viewScale - e.deltaY * 0.01);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-light-bg dark:bg-dark-bg 
                   md:relative md:w-2/5 md:flex-shrink-0 md:glass-card md:rounded-l-3xl md:flex md:flex-col md:transition-all md:duration-300 md:my-4 md:ml-0 md:bg-transparent md:dark:bg-transparent md:z-auto animate-fadeIn">
      <header className="p-4 flex justify-between items-center border-b border-white/20 dark:border-white/10 flex-shrink-0 z-10 bg-light-surface/80 dark:bg-dark-surface/80 backdrop-blur-sm md:bg-transparent md:dark:bg-transparent md:backdrop-blur-none">
        <h3 className="font-bold truncate pr-2" title={pdf.name}>{pdf.name}</h3>
        <div className="flex items-center gap-2">
            <button onClick={handleZoomOut} className="p-2 rounded-full hover:bg-white/20 dark:hover:bg-white/10 transition-colors" aria-label="Zoom out"><ZoomOut className="w-5 h-5" /></button>
            <span className="text-sm font-semibold w-12 text-center">{Math.round(viewScale * 100)}%</span>
            <button onClick={handleZoomIn} className="p-2 rounded-full hover:bg-white/20 dark:hover:bg-white/10 transition-colors" aria-label="Zoom in"><ZoomIn className="w-5 h-5" /></button>
            <button 
                onClick={onClose} 
                className="p-2 rounded-full hover:bg-white/20 dark:hover:bg-white/10 transition-colors ml-2"
                aria-label="Close PDF viewer"
            >
              <X className="w-5 h-5" />
            </button>
        </div>
      </header>
      <div className="flex-1 overflow-auto p-4 relative" onWheel={handleWheel}>
        {loading && (
          <div className="absolute inset-0 flex justify-center items-center bg-light-surface/50 dark:bg-dark-surface/50 z-20 backdrop-blur-sm">
            <div>
              <Loader2 className="animate-spin w-8 h-8 text-primary mx-auto" />
              <p className="mt-2 text-muted-text dark:text-dark-muted-text">Rendering PDF...</p>
            </div>
          </div>
        )}
        {error && <div className="text-center text-red-500 p-4">{error}</div>}
        <div 
          ref={canvasContainerRef} 
          className="flex flex-col items-center origin-top"
          style={{ 
            transform: `scale(${viewScale / renderScale})`,
            transition: 'transform 50ms linear'
          }}
        >
        </div>
      </div>
    </div>
  );
};

export default PdfViewer;