
import React, { useState, useEffect, useRef } from 'react';

// New, thematic animations for the fox
const animations = [
    'animate-tail-wag',
    'animate-head-tilt',
    'animate-blink'
];

type Corner = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

const InteractiveCharacter: React.FC = () => {
    // State for position, dragging, and animations
    const [position, setPosition] = useState<Corner>('bottom-right');
    const [isDraggable, setIsDraggable] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const [isHovered, setIsHovered] = useState(false);
    const [activeAnimation, setActiveAnimation] = useState('');
    
    // Refs for DOM elements and drag calculations
    const characterRef = useRef<HTMLDivElement>(null);
    const dragOffset = useRef({ x: 0, y: 0 });

    // Triggers a random animation on hover
    const triggerRandomAnimation = () => {
        if (activeAnimation) return;
        const randomIndex = Math.floor(Math.random() * animations.length);
        setActiveAnimation(animations[randomIndex]);
    };

    // Event Handlers
    const handleMouseEnter = () => {
        setIsHovered(true);
        triggerRandomAnimation();
    };

    const handleMouseLeave = () => {
        setIsHovered(false);
    };

    const handleAnimationEnd = () => {
        setActiveAnimation('');
    };

    const handleDoubleClick = () => {
        setIsDraggable(prev => !prev);
    };
    
    const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!isDraggable || !characterRef.current) return;
        setIsDragging(true);
        const rect = characterRef.current.getBoundingClientRect();
        dragOffset.current = {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };
        // Prevent text selection while dragging
        e.preventDefault();
    };

    // Effect for handling drag and drop logic
    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!isDragging || !characterRef.current) return;
            const newX = e.clientX - dragOffset.current.x;
            const newY = e.clientY - dragOffset.current.y;
            characterRef.current.style.left = `${newX}px`;
            characterRef.current.style.top = `${newY}px`;
        };

        const handleMouseUp = () => {
            if (!isDragging || !characterRef.current) return;
            
            setIsDragging(false);
            
            const rect = characterRef.current.getBoundingClientRect();
            const viewWidth = window.innerWidth;
            const viewHeight = window.innerHeight;

            const centerX = rect.left + rect.width / 2;
            const centerY = rect.top + rect.height / 2;

            const isLeft = centerX < viewWidth / 2;
            const isTop = centerY < viewHeight / 2;

            let newCorner: Corner = 'bottom-right';
            if (isTop && isLeft) newCorner = 'top-left';
            else if (isTop && !isLeft) newCorner = 'top-right';
            else if (!isTop && isLeft) newCorner = 'bottom-left';
            
            setPosition(newCorner);
            setIsDraggable(false); // Relock after move
        };
        
        if (isDragging) {
            // Remove corner classes to allow free movement
            if (characterRef.current) {
                characterRef.current.classList.remove('top-5', 'bottom-5', 'left-8', 'right-8');
                // Ensure top/left are cleared for direct style manipulation
                characterRef.current.style.top = '';
                characterRef.current.style.left = '';
                characterRef.current.style.right = '';
                characterRef.current.style.bottom = '';
            }
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp, { once: true });
        }

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isDragging]);
    
    // Dynamic classes for positioning and state
    const positionClasses = !isDragging ? {
        'top-left': 'top-5 left-8',
        'top-right': 'top-5 right-8',
        'bottom-left': 'bottom-5 left-8',
        'bottom-right': 'bottom-5 right-8',
    }[position] : '';
    
    const dynamicClasses = [
        'fixed w-40 h-40 z-50',
        positionClasses,
        isDraggable ? 'cursor-move ring-4 ring-primary/50 rounded-full' : 'cursor-pointer',
        !isHovered && !isDraggable && !activeAnimation ? 'animate-float' : '',
        activeAnimation
    ].filter(Boolean).join(' ');

    return (
        <div
            ref={characterRef}
            className={dynamicClasses}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            onAnimationEnd={handleAnimationEnd}
            onDoubleClick={handleDoubleClick}
            onMouseDown={handleMouseDown}
        >
             <svg viewBox="0 0 200 200" className="w-full h-full">
                <g>
                    {/* Shadow */}
                    <ellipse cx="100" cy="185" rx="55" ry="10" fill="rgba(0,0,0,0.1)" />

                    {/* Tail */}
                    <g className="fox-tail">
                        <path d="M140,110 C190,90 200,160 150,170 C120,150 120,130 140,110 Z" fill="#F97316" />
                        <path d="M180,145 C195,150 190,165 180,165 C170,160 175,150 180,145 Z" fill="white"/>
                    </g>

                    {/* Body */}
                    <ellipse cx="100" cy="135" rx="55" ry="55" fill="#F97316" />
                    <ellipse cx="100" cy="140" rx="40" ry="40" fill="white" />

                    {/* Head */}
                    <g className="fox-head">
                        <path d="M70,50 C40,90 160,90 130,50 Q100,30 70,50 Z" fill="#F97316"/>
                        <path d="M75,90 C60,100 140,100 125,90 Q100,80 75,90 Z" fill="white"/>
                        <path d="M95,95 L105,95 L100,102 Z" fill="#1E293B" />

                        {/* Eyes */}
                        <g className="fox-eyes">
                            <circle cx="85" cy="80" r="8" fill="#1E293B" />
                            {/* Wink */}
                            <path d="M108,83 C113,78 120,83" stroke="#1E293B" strokeWidth="3" fill="none" strokeLinecap="round"/>
                        </g>
                         {/* Ears */}
                        <path d="M60,40 L70,15 L90,45 Z" fill="#F97316" />
                        <path d="M140,40 L130,15 L110,45 Z" fill="#F97316" />
                        <path d="M70,40 L75,25 L85,42 Z" fill="white" />
                        <path d="M130,40 L125,25 L115,42 Z" fill="white" />
                    </g>
                </g>
            </svg>
        </div>
    );
};

export default InteractiveCharacter;
