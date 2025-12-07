import React, { useState, useRef } from 'react';
import { FileText, Upload, Search, Download, Trash2, Tag, Eye } from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist';
import type { Document } from '../types';

 
// Set the worker source for pdfjs-dist once, when the module loads.
// This prevents errors with dynamically imported modules and ensures it matches the library version.
pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.js';


interface DocumentsHubProps {
  documents: Document[];
  setDocuments: React.Dispatch<React.SetStateAction<Document[]>>;
  setActivityLog: React.Dispatch<React.SetStateAction<string[]>>;
  onViewPdf: (doc: Document) => void;
}

const DocumentsHub: React.FC<DocumentsHubProps> = ({ documents, setDocuments, setActivityLog, onViewPdf }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    
    const target = event.target; // To reset the input value later

    let content = '';
    const fileExtension = file.name.split('.').pop()?.toLowerCase() || '';
    let fileData: ArrayBuffer | undefined;

    try {
      fileData = await file.arrayBuffer();
      
      if (fileExtension === 'pdf') {
        // Create a copy of the buffer for text extraction. This is critical because
        // pdf.js detaches the buffer when it sends it to a worker, making the original
        // unusable for the viewer. By creating a copy, we leave the original `fileData` intact.
        const bufferForExtraction = fileData.slice(0);
        const pdf = await pdfjsLib.getDocument({ data: bufferForExtraction }).promise;
        const textItems = [];
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          const pageText = textContent.items.map(item => ('str' in item ? item.str : '')).join(' ');
          textItems.push(pageText);
        }
        content = textItems.join('\n\n');
      } else if (['txt', 'md'].includes(fileExtension)) {
        content = await file.text();
      } else {
        alert(`Content reading is not currently supported for .${fileExtension} files. The document will be added, but its content will be empty.`);
      }
    } catch (error) {
      console.error('Error processing file:', error);
      alert('An error occurred while reading the file content. The document will be added with empty content.');
      content = ''; // Ensure content is empty on error
    }
    
    const newDoc: Document = {
      id: Date.now(),
      name: file.name,
      size: `${(file.size / (1024 * 1024)).toFixed(1)} MB`,
      type: fileExtension || 'file',
      uploadDate: new Date().toISOString().split('T')[0],
      tags: ['New Upload'],
      content,
      fileData, // This is the original, untouched buffer.
    };
    
    setDocuments(docs => [newDoc, ...docs]);
    
    // Auto-open PDF in viewer after upload
    if (newDoc.type === 'pdf' && newDoc.fileData) {
        onViewPdf(newDoc);
    }

    const today = new Date().toISOString().split('T')[0];
    setActivityLog(prev => Array.from(new Set([...prev, today])));


    // Reset file input so the same file can be re-uploaded
    if (target) {
        target.value = '';
    }
  };


  const deleteDocument = (id: number) => {
    setDocuments(docs => docs.filter(d => d.id !== id));
  };

  const filteredDocuments = documents.filter(doc =>
    doc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    doc.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="h-full flex flex-col space-y-6 animate-fadeIn">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-bold">Document Hub</h1>
          <p className="text-lg text-muted-text dark:text-dark-muted-text">Manage and organize your study materials.</p>
        </div>
        <button
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center space-x-2 px-5 py-3 bg-primary text-dark-text font-bold rounded-xl hover:bg-opacity-80 transition-all duration-300 shadow-lg hover:shadow-primary/30 transform hover:scale-105 active:scale-95"
        >
          <Upload className="w-5 h-5" />
          <span>Upload Document</span>
        </button>
        <input
          ref={fileInputRef}
          type="file"
          onChange={handleFileUpload}
          className="hidden"
          accept=".pdf,.doc,.docx,.ppt,.pptx,.txt,.md"
        />
      </div>

      <div className="relative">
        <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-muted-text dark:text-dark-muted-text w-5 h-5" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search by name or tag..."
          className="w-full pl-12 pr-4 py-3 glass-card rounded-xl focus:outline-none focus:ring-2 focus:ring-primary placeholder:text-muted-text dark:placeholder:text-dark-muted-text"
        />
      </div>

      <div className="flex-1 glass-card rounded-2xl overflow-hidden">
        <div className="overflow-y-auto h-full mobile-table">
          <table className="w-full text-sm text-left text-muted-text dark:text-dark-muted-text">
            <thead className="text-xs uppercase bg-white/30 dark:bg-dark-surface/80 sticky top-0 z-10 backdrop-blur-sm">
              <tr>
                <th scope="col" className="px-6 py-3">Name</th>
                <th scope="col" className="px-6 py-3">Tags</th>
                <th scope="col" className="px-6 py-3">Date</th>
                <th scope="col" className="px-6 py-3">Size</th>
                <th scope="col" className="px-6 py-3"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10 dark:divide-white/5 md:divide-y-0">
              {filteredDocuments.map(doc => (
                <tr key={doc.id} className="md:hover:bg-white/20 md:dark:hover:bg-white/5 transition-colors duration-200">
                  <td data-label="Name" className="px-6 py-4 font-medium whitespace-nowrap md:flex items-center gap-3 text-dark-text dark:text-light-text text-left md:text-right">
                    <FileText className="w-5 h-5 text-primary hidden md:inline" />
                    <span className="truncate">{doc.name}</span>
                  </td>
                  <td data-label="Tags" className="px-6 py-4">
                    <div className="flex items-center justify-end md:justify-start gap-2">
                      {doc.tags.map(tag => (
                        <span key={tag} className="px-2 py-1 text-xs font-medium text-primary-700 dark:text-primary-300 bg-primary/10 dark:bg-primary/20 rounded-full">{tag}</span>
                      ))}
                    </div>
                  </td>
                  <td data-label="Date" className="px-6 py-4">{doc.uploadDate}</td>
                  <td data-label="Size" className="px-6 py-4">{doc.size}</td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end space-x-3">
                      {doc.type === 'pdf' && (
                        <button 
                            onClick={() => onViewPdf(doc)}
                            className="text-muted-text dark:text-dark-muted-text hover:text-primary transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed" 
                            title="View PDF"
                            disabled={!doc.fileData}
                        >
                          <Eye className="w-5 h-5" />
                        </button>
                      )}
                      <button className="text-muted-text dark:text-dark-muted-text hover:text-primary transition-colors duration-200" title="Download">
                        <Download className="w-5 h-5" />
                      </button>
                      <button onClick={() => deleteDocument(doc.id)} className="text-muted-text dark:text-dark-muted-text hover:text-red-500 transition-colors duration-200" title="Delete">
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredDocuments.length === 0 && (
            <div className="text-center py-12">
              <p className="text-muted-text dark:text-dark-muted-text">No documents found.</p>
              <p className="text-sm text-muted-text/70 dark:text-dark-muted-text/70">Try adjusting your search or uploading a new document.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DocumentsHub;