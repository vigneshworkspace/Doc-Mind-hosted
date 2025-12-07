

import React, { useState, useMemo, useEffect, useRef, useImperativeHandle, useCallback } from 'react';
import { GitFork, RefreshCw, ChevronRight, Brain, ArrowLeft, ZoomIn, ZoomOut } from 'lucide-react';
import { geminiService } from '../services/geminiService';
import type { MindMap, Document, MindMapNode, Settings } from '../types';

interface MindMapGeneratorProps {
  settings: Settings;
  documents: Document[];
  mindMaps: MindMap[];
  setMindMaps: React.Dispatch<React.SetStateAction<MindMap[]>>;
  setActivityLog: React.Dispatch<React.SetStateAction<string[]>>;
  activeMap: MindMap | null;
  setActiveMap: (map: MindMap | null) => void;
  theme: 'light' | 'dark';
}

const NODE_WIDTH = 160;
const MIN_NODE_HEIGHT = 50;
const HORIZONTAL_SPACING = 80;
const VERTICAL_SPACING = 30;
const LINE_HEIGHT = 16;
const PADDING_Y = 10;

const levelColorsLight = {
    bg: ['#3b82f6', '#22c55e', '#a855f7', '#f97316'], // blue, green, purple, orange
    text: '#ffffff',
    connector: '#8E7E70'
};

const levelColorsDark = {
    bg: ['#60a5fa', '#4ade80', '#c084fc', '#fb923c'],
    text: '#111827',
    connector: '#A89A8E'
};

const wrapText = (text: string, maxWidth: number) => {
    const words = text.split(/\s+/);
    const lines: string[] = [];
    let currentLine = '';
    
    words.forEach(word => {
        if ((currentLine.length + word.length + 1) * 7.5 > maxWidth && currentLine.length > 0) {
            lines.push(currentLine);
            currentLine = word;
        } else {
            currentLine = currentLine ? `${currentLine} ${word}` : word;
        }
    });
    lines.push(currentLine);
    return lines;
};

const getAllNodeIdsWithChildren = (node: MindMapNode): string[] => {
    let ids: string[] = [];
    if (node.children && node.children.length > 0) {
        ids.push(node.id);
        node.children.forEach(child => {
            ids = ids.concat(getAllNodeIdsWithChildren(child));
        });
    }
    return ids;
};


const useMindMapLayout = (rootNode: MindMapNode | undefined, collapsedNodes: Set<string>) => {
    return useMemo(() => {
        if (!rootNode) return { nodes: [], links: [], viewBox: '0 0 100 100', viewWidth: 100, viewHeight: 100 };

        type PositionedNode = MindMapNode & { height: number; y: number; };

        const positionedNodes: PositionedNode[] = [];
        const links: { id: string, source: PositionedNode, target: PositionedNode }[] = [];
        let currentLeafY = 0;

        const addLayoutProperties = (node: MindMapNode, level = 0, parent: PositionedNode | null = null): { y: number, height: number } => {
            const lines = wrapText(node.text, NODE_WIDTH - 20);
            const nodeHeight = Math.max(MIN_NODE_HEIGHT, (lines.length * LINE_HEIGHT) + (PADDING_Y * 2));

            const newNode = { ...node, x: level * (NODE_WIDTH + HORIZONTAL_SPACING), level, parent, height: nodeHeight } as PositionedNode;
            
            const isCollapsed = collapsedNodes.has(node.id);
            const childrenToLayout = (isCollapsed || !node.children) ? [] : node.children;

            if (childrenToLayout.length > 0) {
                const childrenLayouts = childrenToLayout.map(child => addLayoutProperties(child, level + 1, newNode));
                const firstChildY = childrenLayouts[0].y;
                const lastChildLayout = childrenLayouts[childrenLayouts.length - 1];
                newNode.y = (firstChildY + lastChildLayout.y) / 2;
            } else {
                newNode.y = currentLeafY + (nodeHeight / 2);
                currentLeafY += nodeHeight + VERTICAL_SPACING;
            }

            positionedNodes.push(newNode);

            if (parent) {
                links.push({ id: `${parent.id}-${newNode.id}`, source: parent, target: newNode });
            }

            return { y: newNode.y, height: newNode.height };
        };

        addLayoutProperties(rootNode);

        const rootFinalPos = positionedNodes.find(n => n.id === rootNode.id)!;
        const yOffset = rootFinalPos.y;
        positionedNodes.forEach(n => { n.y -= yOffset; });

        const finalLinks = links.map(link => ({
            ...link,
            source: positionedNodes.find(n => n.id === link.source.id)!,
            target: positionedNodes.find(n => n.id === link.target.id)!,
        }));
        
        const allX = positionedNodes.map(n => n.x!);
        const allYCenters = positionedNodes.map(n => n.y);
        const allHeights = positionedNodes.map(n => n.height);
        
        const minX = 0;
        const maxX = Math.max(...allX) + NODE_WIDTH;
        const minY = Math.min(...allYCenters.map((y, i) => y - allHeights[i] / 2));
        const maxY = Math.max(...allYCenters.map((y, i) => y + allHeights[i] / 2));
        
        const viewWidth = maxX - minX;
        const viewHeight = maxY - minY;
        const viewBox = `${minX - 20} ${minY - 20} ${viewWidth + 40} ${viewHeight + 40}`;

        return { nodes: positionedNodes, links: finalLinks, viewBox, viewWidth: viewWidth + 40, viewHeight: viewHeight + 40 };

    }, [rootNode, collapsedNodes]);
};

const MindMapDisplay = React.forwardRef(({ root, theme, onNodeToggle, collapsedNodes } : { root: MindMapNode, theme: 'light' | 'dark', onNodeToggle: (nodeId: string) => void, collapsedNodes: Set<string> }, ref) => {
    const { nodes, links, viewWidth, viewHeight } = useMindMapLayout(root, collapsedNodes);
    const [transform, setTransform] = useState({ scale: 1, translateX: 0, translateY: 0 });
    const panState = useRef({ isPanning: false, startX: 0, startY: 0 });
    const svgRef = useRef<SVGSVGElement>(null);
    
    const resetTransform = useCallback(() => {
        if (!svgRef.current || !viewWidth || !viewHeight) return;
        const svgRect = svgRef.current.getBoundingClientRect();
        
        if (svgRect.width === 0 || svgRect.height === 0) return;
        
        const initialScale = Math.min(svgRect.width / viewWidth, svgRect.height / viewHeight) * 0.9;
        const initialTranslateX = (svgRect.width - viewWidth * initialScale) / 2;
        const initialTranslateY = (svgRect.height - viewHeight * initialScale) / 2;
        
        setTransform({
            scale: initialScale,
            translateX: initialTranslateX,
            translateY: initialTranslateY
        });
    }, [viewWidth, viewHeight]);
    
    const zoom = (factor: number, centerX?: number, centerY?: number) => {
        if (!svgRef.current) return;
        const svgRect = svgRef.current.getBoundingClientRect();
        const cX = centerX !== undefined ? centerX : svgRect.width / 2;
        const cY = centerY !== undefined ? centerY : svgRect.height / 2;
        
        const newScale = transform.scale * factor;
        const clampedScale = Math.max(0.1, Math.min(newScale, 5));
        
        const pointX = (cX - transform.translateX) / transform.scale;
        const pointY = (cY - transform.translateY) / transform.scale;
        
        const newTranslateX = cX - pointX * clampedScale;
        const newTranslateY = cY - pointY * clampedScale;

        setTransform({
            scale: clampedScale,
            translateX: newTranslateX,
            translateY: newTranslateY
        });
    }

    const handleWheel = (e: React.WheelEvent<SVGSVGElement>) => {
        e.preventDefault();
        const svgRect = e.currentTarget.getBoundingClientRect();
        const mouseX = e.clientX - svgRect.left;
        const mouseY = e.clientY - svgRect.top;
        zoom(e.deltaY < 0 ? 1.1 : 1 / 1.1, mouseX, mouseY);
    };

    const handleMouseDown = (e: React.MouseEvent<SVGSVGElement>) => {
        if ((e.target as HTMLElement).closest('.node-toggle')) return;
        panState.current = { isPanning: true, startX: e.clientX, startY: e.clientY };
        e.currentTarget.style.cursor = 'grabbing';
    };

    const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
        if (!panState.current.isPanning) return;
        const dx = e.clientX - panState.current.startX;
        const dy = e.clientY - panState.current.startY;
        panState.current.startX = e.clientX;
        panState.current.startY = e.clientY;

        setTransform(t => ({
            ...t,
            translateX: t.translateX + dx,
            translateY: t.translateY + dy,
        }));
    };
    
    const handleMouseUpOrLeave = (e: React.MouseEvent<SVGSVGElement>) => {
        if (panState.current.isPanning) {
            panState.current.isPanning = false;
            e.currentTarget.style.cursor = 'grab';
        }
    };
    
    useImperativeHandle(ref, () => ({
        zoomIn: () => zoom(1.2),
        zoomOut: () => zoom(1 / 1.2),
        reset: resetTransform
    }));

    const colors = theme === 'dark' ? levelColorsDark : levelColorsLight;

    const getPath = (source: any, target: any) => {
        const sx = source.x! + NODE_WIDTH;
        const sy = source.y!;
        const tx = target.x!;
        const ty = target.y!;
        return `M ${sx} ${sy} C ${sx + HORIZONTAL_SPACING / 2} ${sy}, ${tx - HORIZONTAL_SPACING / 2} ${ty}, ${tx} ${ty}`;
    };

    return (
        <svg
            ref={svgRef}
            width="100%"
            height="100%"
            onWheel={handleWheel}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUpOrLeave}
            onMouseLeave={handleMouseUpOrLeave}
            style={{ cursor: 'grab', userSelect: 'none' }}
        >
            <g transform={`translate(${transform.translateX}, ${transform.translateY}) scale(${transform.scale})`}>
                <g transform={`translate(${viewWidth / 2 - NODE_WIDTH / 2}, ${viewHeight / 2})`}>
                    {links.map(link => (
                        <path key={link.id} d={getPath(link.source, link.target)} fill="none" stroke={colors.connector} strokeWidth="2" style={{ transition: 'd 0.3s ease' }} />
                    ))}
                    {nodes.map(node => {
                        const nodeWithLayout = node as any;
                        const nodeHeight = nodeWithLayout.height;
                        const lines = wrapText(node.text, NODE_WIDTH - 20);
                        const textBlockHeight = lines.length * LINE_HEIGHT;
                        const textY = (nodeHeight - textBlockHeight) / 2 + (LINE_HEIGHT * 0.75);
                        
                        const hasChildren = node.children && node.children.length > 0;
                        const isCollapsed = collapsedNodes.has(node.id);
                        
                        return (
                            <g 
                                key={node.id} 
                                transform={`translate(${nodeWithLayout.x}, ${nodeWithLayout.y - nodeHeight / 2})`}
                                style={{ transition: 'transform 0.4s ease' }}
                            >
                                <rect 
                                    width={NODE_WIDTH} height={nodeHeight} rx="10" 
                                    fill={colors.bg[node.level! % colors.bg.length]} 
                                    style={{ transition: 'height 0.4s ease, fill 0.4s ease' }}
                                />
                                <text
                                    x={NODE_WIDTH / 2}
                                    y={textY}
                                    textAnchor="middle"
                                    style={{ fontSize: '14px', fontWeight: '600', fill: colors.text, pointerEvents: 'none', transition: 'y 0.4s ease' }}
                                >
                                    {lines.map((line, i) => (
                                        <tspan key={i} x={NODE_WIDTH / 2} dy={i === 0 ? 0 : LINE_HEIGHT}>
                                            {line}
                                        </tspan>
                                    ))}
                                </text>
                                {hasChildren && (
                                    <g 
                                        className="node-toggle"
                                        transform={`translate(${NODE_WIDTH}, ${nodeHeight / 2})`}
                                        onClick={(e) => { e.stopPropagation(); onNodeToggle(node.id); }}
                                        style={{ cursor: 'pointer' }}
                                    >
                                        <circle r="10" fill="rgba(0,0,0,0.3)" />
                                        <line x1="-4" y1="0" x2="4" y2="0" stroke="white" strokeWidth="2" strokeLinecap="round" />
                                        {isCollapsed && (
                                            <line x1="0" y1="-4" x2="0" y2="4" stroke="white" strokeWidth="2" strokeLinecap="round" />
                                        )}
                                    </g>
                                )}
                            </g>
                        );
                    })}
                </g>
            </g>
        </svg>
    );
});


const MindMapGenerator: React.FC<MindMapGeneratorProps> = ({ settings, documents, mindMaps, setMindMaps, setActivityLog, activeMap, setActiveMap, theme }) => {
  const [sourceText, setSourceText] = useState('');
  const [title, setTitle] = useState('');
  const [selectedDocId, setSelectedDocId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mindMapDisplayRef = useRef<any>(null);
  const [collapsedNodes, setCollapsedNodes] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (activeMap?.root) {
      const allParentIds = getAllNodeIdsWithChildren(activeMap.root);
      const initialCollapsed = new Set(allParentIds);
      initialCollapsed.delete(activeMap.root.id);
      setCollapsedNodes(initialCollapsed);
      
      setTimeout(() => mindMapDisplayRef.current?.reset(), 50);
    }
  }, [activeMap]);


  const handleNodeToggle = (nodeId: string) => {
    setCollapsedNodes(prev => {
        const newSet = new Set(prev);
        if (newSet.has(nodeId)) {
            newSet.delete(nodeId);
        } else {
            newSet.add(nodeId);
        }
        return newSet;
    });
  };

  const handleDocSelection = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const docId = e.target.value;
    setSelectedDocId(docId);
    const selectedDoc = documents.find(doc => doc.id.toString() === docId);
    if (selectedDoc) {
      setSourceText(selectedDoc.content || '');
      setTitle(selectedDoc.name.replace(/\.[^/.]+$/, ""));
    } else {
      setSourceText('');
      setTitle('');
    }
  };

  const handleGenerate = async () => {
    const textToProcess = sourceText.trim();
    if (!textToProcess) {
      setError('Please provide some text or select a document.');
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const generatedData = await geminiService.generateMindMapFromText(settings, textToProcess, title || 'Generated Mind Map');
      const newMap: MindMap = {
        id: Date.now(),
        title: generatedData.title,
        root: generatedData.root,
        date: new Date().toISOString().split('T')[0],
        sourceDocumentId: selectedDocId ? parseInt(selectedDocId) : undefined,
      };
      setMindMaps(prev => [newMap, ...prev]);
      setActiveMap(newMap);

      const today = new Date().toISOString().split('T')[0];
      setActivityLog(prev => Array.from(new Set([...prev, today])));
    } catch (e: any) {
      setError(`Failed to generate mind map: ${e.message}. Please try again.`);
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };
  
  if (activeMap) {
    return (
      <div className="h-full flex flex-col animate-fadeIn">
        <div className="flex justify-between items-center mb-4 flex-shrink-0">
            <button onClick={() => setActiveMap(null)} className="flex items-center gap-2 text-muted-text dark:text-dark-muted-text hover:text-primary font-semibold transition-colors">
              <ArrowLeft className="w-5 h-5"/>
              Back to Generator
            </button>
            <h2 className="text-2xl font-bold text-right truncate pl-4">{activeMap.title}</h2>
        </div>
        <div className="relative flex-1 w-full glass-card rounded-2xl overflow-hidden">
            {error ? (
                <div className="text-red-500 p-4">{error}</div>
            ) : activeMap.root ? (
                <>
                    <MindMapDisplay 
                      ref={mindMapDisplayRef} 
                      root={activeMap.root} 
                      theme={theme} 
                      onNodeToggle={handleNodeToggle}
                      collapsedNodes={collapsedNodes}
                    />
                    <div className="absolute bottom-4 right-4 z-10 flex flex-col gap-2">
                        <button onClick={() => mindMapDisplayRef.current?.zoomIn()} className="p-2 glass-card rounded-full hover:shadow-lg hover:bg-white/20 dark:hover:bg-white/5 transition-all" aria-label="Zoom In">
                            <ZoomIn className="w-5 h-5"/>
                        </button>
                        <button onClick={() => mindMapDisplayRef.current?.zoomOut()} className="p-2 glass-card rounded-full hover:shadow-lg hover:bg-white/20 dark:hover:bg-white/5 transition-all" aria-label="Zoom Out">
                            <ZoomOut className="w-5 h-5"/>
                        </button>
                        <button onClick={() => mindMapDisplayRef.current?.reset()} className="p-2 glass-card rounded-full hover:shadow-lg hover:bg-white/20 dark:hover:bg-white/5 transition-all" aria-label="Reset View">
                            <RefreshCw className="w-5 h-5"/>
                        </button>
                    </div>
                </>
            ) : (
                 <div className="w-full h-full flex items-center justify-center text-muted-text dark:text-dark-muted-text">Invalid mind map data.</div>
            )}
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col space-y-8 max-w-3xl mx-auto animate-fadeIn">
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-20 h-20 bg-primary/20 dark:bg-primary/30 rounded-2xl mb-4">
          <GitFork className="w-10 h-10 text-primary" />
        </div>
        <h1 className="text-4xl font-bold">Mind Map Generator</h1>
        <p className="text-lg text-muted-text dark:text-dark-muted-text">Visualize concepts from your documents.</p>
      </div>
      
      <div className="p-8 glass-card rounded-2xl space-y-6">
        <div>
          <label htmlFor="doc-select" className="block text-sm font-medium text-muted-text dark:text-dark-muted-text mb-2">1. Choose a Document (Optional)</label>
          <select id="doc-select" value={selectedDocId} onChange={handleDocSelection} className="w-full px-4 py-3 bg-white/20 dark:bg-black/20 border border-white/20 dark:border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary">
            <option value="">-- Select a document --</option>
            {documents.map(doc => {
              const isProcessable = doc.content && doc.content.trim() !== '';
              return (
                <option 
                  key={doc.id} 
                  value={doc.id} 
                  disabled={!isProcessable} 
                  title={!isProcessable ? 'Text could not be extracted from this document. It might be an image-only PDF.' : ''}
                  className={!isProcessable ? 'text-muted-text/70 dark:text-dark-muted-text/70' : ''}
                >
                  {isProcessable ? doc.name : `[No text] ${doc.name}`}
                </option>
              );
            })}
          </select>
        </div>
        <div>
          <label htmlFor="source-text" className="block text-sm font-medium text-muted-text dark:text-dark-muted-text mb-2">2. Or Paste Your Text Here</label>
          <textarea id="source-text" rows={8} value={sourceText} onChange={(e) => { setSourceText(e.target.value); setSelectedDocId(''); }} placeholder="Paste your notes or any text here." className="w-full px-4 py-3 bg-white/20 dark:bg-black/20 border border-white/20 dark:border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary placeholder:text-muted-text dark:placeholder:text-dark-muted-text" />
        </div>
        <div>
          <label htmlFor="map-title" className="block text-sm font-medium text-muted-text dark:text-dark-muted-text mb-2">3. Give your mind map a title</label>
          <input id="map-title" type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g., Key Concepts in Quantum Physics" className="w-full px-4 py-3 bg-white/20 dark:bg-black/20 border border-white/20 dark:border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary placeholder:text-muted-text dark:placeholder:text-dark-muted-text" />
        </div>
        {error && <p className="text-red-500 text-sm">{error}</p>}
        <button onClick={handleGenerate} disabled={isLoading} className="w-full flex items-center justify-center space-x-2 px-6 py-4 bg-primary text-dark-text text-lg font-bold rounded-xl hover:bg-opacity-80 disabled:bg-opacity-50 disabled:bg-light-border disabled:text-muted-text disabled:cursor-not-allowed transition-all duration-300 shadow-lg hover:shadow-primary/30 transform hover:scale-105 active:scale-95">
          {isLoading ? (
            <><RefreshCw className="w-5 h-5 animate-spin" /><span>Generating...</span></>
          ) : (
            <><Brain className="w-6 h-6" /><span>Generate Mind Map</span></>
          )}
        </button>
      </div>

       <div className="flex-1 flex flex-col space-y-4 min-h-0">
        <h2 className="text-2xl font-bold">Your Mind Maps</h2>
        <div className="flex-1 overflow-y-auto pr-2 space-y-3">
            {mindMaps.length > 0 ? (
            <>
                {mindMaps.map(map => (
                <div key={map.id} onClick={() => setActiveMap(map)} className="p-4 glass-card rounded-xl flex justify-between items-center cursor-pointer hover:shadow-primary/20 hover:-translate-y-px transition-all">
                    <div>
                    <h3 className="font-semibold">{map.title}</h3>
                    <p className="text-sm text-muted-text dark:text-dark-muted-text">Created on {map.date}</p>
                    </div>
                    <ChevronRight className="w-5 h-5 text-muted-text dark:text-dark-muted-text" />
                </div>
                ))}
            </>
            ) : (
            <p className="text-center text-muted-text dark:text-dark-muted-text py-4">You haven't created any mind maps yet.</p>
            )}
        </div>
      </div>
    </div>
  );
};

export default MindMapGenerator;