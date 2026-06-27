'use client'
import { useRef, useCallback, useEffect } from 'react';

interface SpinWheelProps {
    options: Array<{ key: string; label: string; weight: number }>;
    targetAngle: number | null;
    spinAt: number | null;
    isSpinning: boolean;
    onComplete: () => void;
}

export function SpinWheel({ options, targetAngle, spinAt, isSpinning, onComplete }: SpinWheelProps) {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const requestRef = useRef<number | null>(null);
    const completeTriggeredRef = useRef<boolean>(false);

    const easeOutQuart = (t: number) => 1 - Math.pow(1 - t, 4);

    const drawWheel = useCallback((currentAngle: number) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const width = canvas.width;
        const height = canvas.height;
        const cx = width / 2;
        const cy = height / 2;
        const r = Math.min(cx, cy) - 15;

        ctx.clearRect(0, 0, width, height);

        const totalWeight = options.reduce((sum, o) => sum + o.weight, 0);
        if (totalWeight === 0 || options.length === 0) {
            ctx.beginPath();
            ctx.arc(cx, cy, r, 0, 2 * Math.PI);
            ctx.fillStyle = '#1c1917';
            ctx.fill();
            ctx.strokeStyle = 'rgba(255,255,255,0.1)';
            ctx.lineWidth = 2;
            ctx.stroke();
            ctx.fillStyle = 'rgba(255,255,255,0.4)';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.font = 'bold 12px sans-serif';
            ctx.fillText("No options selected", cx, cy);
            return;
        }

        let startAngle = currentAngle;
        const colors = [
            '#a855f7', '#3b82f6', '#10b981', '#f59e0b', '#ef4444',
            '#ec4899', '#6366f1', '#14b8a6', '#84cc16', '#eab308'
        ];

        options.forEach((opt, idx) => {
            const angleVal = (opt.weight / totalWeight) * 2 * Math.PI;
            const endAngle = startAngle + angleVal;

            ctx.beginPath();
            ctx.moveTo(cx, cy);
            ctx.arc(cx, cy, r, startAngle, endAngle);
            ctx.closePath();
            ctx.fillStyle = colors[idx % colors.length];
            ctx.fill();

            ctx.strokeStyle = 'rgba(24, 24, 27, 0.4)';
            ctx.lineWidth = 2;
            ctx.stroke();

            ctx.save();
            ctx.translate(cx, cy);
            ctx.rotate(startAngle + angleVal / 2);
            ctx.textAlign = 'right';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 10px sans-serif';
            const labelText = opt.label.length > 15 ? opt.label.slice(0, 12) + '...' : opt.label;
            ctx.fillText(labelText, r - 10, 0);
            ctx.restore();

            startAngle = endAngle;
        });

        // Center Pin
        ctx.beginPath();
        ctx.arc(cx, cy, 18, 0, 2 * Math.PI);
        ctx.fillStyle = '#18181b';
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.2)';
        ctx.lineWidth = 3;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(cx, cy, 6, 0, 2 * Math.PI);
        ctx.fillStyle = '#a855f7';
        ctx.fill();

        // Arrow Pointer
        ctx.beginPath();
        ctx.moveTo(cx, 8);
        ctx.lineTo(cx - 10, 22);
        ctx.lineTo(cx + 10, 22);
        ctx.closePath();
        ctx.fillStyle = '#f43f5e';
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.stroke();
    }, [options]);

    useEffect(() => {
        if (!isSpinning || spinAt === null || targetAngle === null) {
            drawWheel(0);
            completeTriggeredRef.current = false;
            return;
        }

        const duration = 5000;
        const animate = () => {
            const now = Date.now();
            const elapsed = now - spinAt;

            if (elapsed < duration) {
                const t = elapsed / duration;
                const easedT = easeOutQuart(t);
                const currentAngle = easedT * targetAngle;
                drawWheel(currentAngle);
                requestRef.current = requestAnimationFrame(animate);
            } else {
                drawWheel(targetAngle);
                if (!completeTriggeredRef.current) {
                    completeTriggeredRef.current = true;
                    onComplete();
                }
            }
        };

        requestRef.current = requestAnimationFrame(animate);
        return () => {
            if (requestRef.current) cancelAnimationFrame(requestRef.current);
        };
    }, [isSpinning, spinAt, targetAngle, drawWheel, onComplete]);

    return (
        <div className="relative w-64 h-64 mx-auto flex items-center justify-center">
            <canvas ref={canvasRef} width={256} height={256} className="rounded-full shadow-2xl bg-zinc-950 border border-white/10" />
        </div>
    );
}
