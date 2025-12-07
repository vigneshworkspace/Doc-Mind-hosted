

import React, { useState } from 'react';
import { Atom, Zap, Clipboard, Download, RefreshCw } from 'lucide-react';
import { geminiService } from '../services/geminiService';
import type { Settings } from '../types';

interface ConceptVisualizerProps {
    settings: Settings;
}

const exampleConcepts = [
    { name: 'Pythagorean Theorem', prompt: 'Demonstrate the Pythagorean theorem with an animated right-angled triangle and squares on each side.' },
    { name: 'Quadratic Function', prompt: 'Visualize a quadratic function, showing its roots, vertex, and axis of symmetry with animation.' },
    { name: 'Trigonometry', prompt: 'Show how sine and cosine are related on the unit circle with an animated angle and corresponding line segments.' },
    { name: '3D Surface Plot', prompt: 'Create a 3D surface plot showing z = sin(x) + cos(y) and animate the camera rotating around it.' },
    { name: 'Derivatives', prompt: 'Visualize a derivative as the slope of a tangent line moving along a curve.' },
    { name: 'Integration', prompt: 'Show how integration finds the area under a curve by animating the summation of thin rectangles.' },
    { name: 'Matrix Operations', prompt: 'Demonstrate a 2D matrix transformation (e.g., shear or rotation) on a grid.' },
    { name: 'Complex Numbers', prompt: 'Show how complex number multiplication results in rotation and scaling in the complex plane.' },
];

const ConceptVisualizer: React.FC<ConceptVisualizerProps> = ({ settings }) => {
    const [concept, setConcept] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [result, setResult] = useState<{ code: string } | null>(null);
    const [copySuccess, setCopySuccess] = useState(false);

    const setExample = (prompt: string) => {
        setConcept(prompt);
    };

    const handleGenerate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!concept.trim()) {
            setError('Please describe a concept to visualize.');
            return;
        }

        setIsLoading(true);
        setError(null);
        setResult(null);

        try {
            const manimCode = await geminiService.generateManimCode(settings, concept);
            setResult({ code: manimCode });
        } catch (err: any) {
            console.error(err);
            setError(`An error occurred while generating the animation code: ${err.message}. Please try again.`);
        } finally {
            setIsLoading(false);
        }
    };

    const handleCopyCode = () => {
        if (!result) return;
        navigator.clipboard.writeText(result.code).then(() => {
            setCopySuccess(true);
            setTimeout(() => setCopySuccess(false), 2000);
        }, (err) => {
            console.error('Failed to copy code: ', err);
            setError('Failed to copy code to clipboard.');
        });
    };

    return (
        <div className="space-y-8 max-w-7xl mx-auto animate-fadeIn">
            <div className="text-center">
                <h1 className="text-4xl md:text-5xl font-bold">
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-secondary">Create Animations</span>
                </h1>
                <p className="text-xl text-muted-text dark:text-dark-muted-text max-w-3xl mx-auto mt-4">
                    Transform concepts into stunning animations. Describe what you want to visualize, and we'll generate the Manim code for you.
                </p>
            </div>

            <div className="max-w-4xl mx-auto">
                <div className="glass-card rounded-2xl p-6 mb-8">
                    <form onSubmit={handleGenerate} className="space-y-6">
                        <div>
                            <label htmlFor="concept" className="block text-sm font-medium text-muted-text dark:text-dark-muted-text mb-2">Describe Your Animation</label>
                            <textarea
                                id="concept"
                                rows={4}
                                value={concept}
                                onChange={(e) => setConcept(e.target.value)}
                                className="w-full px-4 py-3 bg-white/20 dark:bg-black/20 border border-white/20 dark:border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary placeholder:text-muted-text dark:placeholder:text-dark-muted-text transition-all"
                                placeholder="e.g., Visualize the relationship between sine and cosine on the unit circle..."
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-muted-text dark:text-dark-muted-text mb-2">Or Try an Example</label>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                                {exampleConcepts.map(ex => (
                                    <button
                                        key={ex.name}
                                        type="button"
                                        onClick={() => setExample(ex.prompt)}
                                        className="px-3 py-2 text-sm bg-white/20 dark:bg-black/20 hover:bg-white/30 dark:hover:bg-black/30 rounded-lg text-dark-text dark:text-light-text transition-all text-left"
                                    >
                                        {ex.name}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="flex justify-center pt-4">
                            <button
                                type="submit"
                                disabled={isLoading}
                                className="px-8 py-3 rounded-lg text-dark-text font-bold text-lg shadow-lg flex items-center space-x-2 bg-primary hover:bg-opacity-80 disabled:bg-opacity-50 transition-all transform hover:scale-105 active:scale-95 disabled:cursor-not-allowed"
                            >
                                {isLoading ? (
                                    <>
                                        <RefreshCw className="w-6 h-6 animate-spin" />
                                        <span>Generating...</span>
                                    </>
                                ) : (
                                    <>
                                        <Atom className="w-6 h-6" />
                                        <span>Generate Code</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </form>
                </div>

                {error && (
                    <div className="glass-card rounded-xl p-4 border border-red-500/50 text-red-500">
                        <p>{error}</p>
                    </div>
                )}

                {result && (
                    <div id="results" className="space-y-8 animate-fadeIn">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="glass-card rounded-xl p-4 h-[400px] flex flex-col">
                                <div className="flex items-center justify-between mb-4 flex-shrink-0">
                                    <h3 className="text-lg font-semibold">Generated Manim Code</h3>
                                    <button onClick={handleCopyCode} className="text-primary hover:opacity-80 flex items-center space-x-2 text-sm">
                                        <Clipboard className="w-5 h-5" />
                                        <span>{copySuccess ? 'Copied!' : 'Copy Code'}</span>
                                    </button>
                                </div>
                                <div className="flex-1 overflow-auto bg-dark-bg/50 rounded-lg p-4">
                                    <pre className="h-full"><code className="language-python text-sm font-mono whitespace-pre-wrap">
                                        {result.code}
                                    </code></pre>
                                </div>
                            </div>
                            
                            <div className="glass-card rounded-xl p-4 h-[400px] flex flex-col">
                                <h3 className="text-lg font-semibold mb-4 flex-shrink-0">Animation Preview</h3>
                                <div className="flex-1 bg-black rounded-lg overflow-hidden flex items-center justify-center text-center p-4">
                                    <div>
                                        <p className="text-muted-text dark:text-dark-muted-text">Video generation is not available in this demo.</p>
                                        <p className="text-sm text-muted-text/80 dark:text-dark-muted-text/80 mt-2">Copy the code and run it with Manim to see your animation!</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="flex justify-center space-x-4">
                            <button
                                disabled
                                className="px-6 py-2 rounded-lg text-dark-text font-medium flex items-center space-x-2 bg-primary disabled:bg-opacity-50 cursor-not-allowed"
                            >
                                <Download className="w-5 h-5" />
                                <span>Download MP4</span>
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ConceptVisualizer;